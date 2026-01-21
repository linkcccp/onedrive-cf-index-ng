/**
 * Linkcccp_BookGridLayout - 书籍竖版网格布局
 * 展示从上到下：封面 → 书名 → 作者
 */
import type { OdFolderChildren } from '../types'
import type { BookMetadata } from './Linkcccp_Sidebar'

import Link from 'next/link'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useClipboard } from 'use-clipboard-copy'

import { getBaseUrl } from '../utils/getBaseUrl'
import { getStoredToken } from '../utils/protectedRouteHandler'
import { Checkbox, Downloading } from './FileListing'
import { getExtension } from '../utils/getFileIcon'

interface BookGridItemProps {
  c: OdFolderChildren
  path: string
  bookMeta?: BookMetadata
}

const BookGridItem = ({ c, path, bookMeta }: BookGridItemProps) => {
  const hashedToken = getStoredToken(path)
  // 使用 thumbnail API 获取封面
  const thumbnailUrl = `/api/thumbnail?path=${path === '/' ? '' : path}/${encodeURIComponent(c.name)}&size=large${hashedToken ? `&odpt=${hashedToken}` : ''}`
  const [brokenThumbnail, setBrokenThumbnail] = useState(false)

  // 从 index.json 获取书名和作者，如果没有则用文件名
  const bookTitle = bookMeta?.title || c.name.replace(/\.(epub|cbz|pdf)$/i, '')
  const bookAuthor = bookMeta?.author || ''
  const fileExt = getExtension(c.name).toUpperCase()

  return (
    <div className="flex flex-col">
      {/* 封面区域 - 固定比例 3:4 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-fluent-lg bg-gray-100 dark:bg-gray-800">
        {!brokenThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            src={thumbnailUrl}
            alt={bookTitle}
            onError={() => setBrokenThumbnail(true)}
            loading="lazy"
          />
        ) : (
          // 无封面时显示占位图标
          <div className="flex h-full w-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <FontAwesomeIcon icon="book" className="mb-2 h-12 w-12" />
            <span className="text-xs font-medium">{fileExt}</span>
          </div>
        )}
        
        {/* 格式标签 */}
        <div className="absolute bottom-2 right-2 rounded-fluent-sm bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {fileExt}
        </div>
      </div>

      {/* 书名 */}
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-tight text-gray-800 dark:text-gray-100" title={bookTitle}>
        {bookTitle}
      </h3>

      {/* 作者 */}
      {bookAuthor && (
        <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400" title={bookAuthor}>
          {bookAuthor}
        </p>
      )}
    </div>
  )
}

interface BookGridLayoutProps {
  path: string
  folderChildren: OdFolderChildren[]
  bookMetadataMap?: Map<string, BookMetadata>
  selected: { [key: string]: boolean }
  toggleItemSelected: (id: string) => void
  totalSelected: 0 | 1 | 2
  toggleTotalSelected: () => void
  totalGenerating: boolean
  handleSelectedDownload: () => void
  folderGenerating: { [key: string]: boolean }
  handleSelectedPermalink: (baseUrl: string) => string
  handleFolderDownload: (path: string, id: string, name?: string) => () => void
  toast: any
}

const Linkcccp_BookGridLayout = ({
  path,
  folderChildren,
  bookMetadataMap,
  selected,
  toggleItemSelected,
  totalSelected,
  toggleTotalSelected,
  totalGenerating,
  handleSelectedDownload,
  folderGenerating,
  handleSelectedPermalink,
  handleFolderDownload,
  toast,
}: BookGridLayoutProps) => {
  const clipboard = useClipboard()
  const hashedToken = getStoredToken(path)

  // Get item path from item name
  const getItemPath = (name: string) => `${path === '/' ? '' : path}/${encodeURIComponent(name)}`

  return (
    <div className="rounded-fluent-lg bg-fluent-surface-card shadow-fluent-sm dark:bg-fluent-surface-card">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-fluent-border px-4 py-3 dark:border-fluent-border">
        <div className="text-sm font-medium text-fluent-text-secondary dark:text-fluent-text-secondary">
          {`${folderChildren.length} 本书`}
        </div>
        <div className="flex items-center gap-1 text-fluent-text-secondary dark:text-fluent-text-secondary">
          <Checkbox
            checked={totalSelected}
            onChange={toggleTotalSelected}
            indeterminate={true}
            title={'全选'}
          />
          <button
            title={'复制选中文件链接'}
            className="cursor-pointer rounded-fluent-md p-1.5 hover:bg-fluent-surface-panel disabled:cursor-not-allowed disabled:text-fluent-text-disabled disabled:hover:bg-fluent-surface dark:hover:bg-fluent-surface-panel"
            disabled={totalSelected === 0}
            onClick={() => {
              clipboard.copy(handleSelectedPermalink(getBaseUrl()))
              toast.success('已复制链接')
            }}
          >
            <FontAwesomeIcon icon={['far', 'copy']} size="lg" />
          </button>
          {totalGenerating ? (
            <Downloading title={'正在下载，刷新页面可取消'} style="p-1.5" />
          ) : (
            <button
              title={'下载选中文件'}
              className="cursor-pointer rounded-fluent-md p-1.5 hover:bg-fluent-surface-panel disabled:cursor-not-allowed disabled:text-fluent-text-disabled disabled:hover:bg-fluent-surface dark:hover:bg-fluent-surface-panel"
              disabled={totalSelected === 0}
              onClick={handleSelectedDownload}
            >
              <FontAwesomeIcon icon={['far', 'arrow-alt-circle-down']} size="lg" />
            </button>
          )}
        </div>
      </div>

      {/* 书籍网格 - 响应式列数 */}
      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {folderChildren.map((c: OdFolderChildren) => {
          const bookMeta = bookMetadataMap?.get(c.name)
          
          return (
            <div
              key={c.id}
              className="group relative rounded-fluent-lg p-2 transition-all duration-200 hover:bg-fluent-surface-panel dark:hover:bg-fluent-surface-panel"
            >
              {/* 悬停操作按钮 */}
              <div className="absolute right-1 top-1 z-10 flex gap-1 rounded-fluent-md bg-fluent-surface-card/80 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 dark:bg-fluent-surface-card/80">
                <Checkbox
                  checked={selected[c.id] ? 2 : 0}
                  onChange={() => toggleItemSelected(c.id)}
                  title={'选择'}
                />
                <span
                  title={'复制链接'}
                  className="cursor-pointer rounded-fluent-md p-1.5 hover:bg-fluent-surface-panel dark:hover:bg-fluent-surface-panel"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    clipboard.copy(
                      `${getBaseUrl()}/api/raw?path=${getItemPath(c.name)}${hashedToken ? `&odpt=${hashedToken}` : ''}`
                    )
                    toast.success('已复制链接')
                  }}
                >
                  <FontAwesomeIcon icon={['far', 'copy']} className="h-3.5 w-3.5" />
                </span>
                <a
                  title={'下载'}
                  className="cursor-pointer rounded-fluent-md p-1.5 hover:bg-fluent-surface-panel dark:hover:bg-fluent-surface-panel"
                  href={`/api/raw?path=${getItemPath(c.name)}${hashedToken ? `&odpt=${hashedToken}` : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FontAwesomeIcon icon={['far', 'arrow-alt-circle-down']} className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* 点击跳转到阅读页 */}
              <Link
                href={`${path === '/' ? '' : path}/${encodeURIComponent(c.name)}`}
                className="block"
              >
                <BookGridItem c={c} path={path} bookMeta={bookMeta} />
              </Link>

              {/* 选中状态指示 */}
              {selected[c.id] && (
                <div className="absolute inset-0 rounded-fluent-lg border-2 border-blue-500 pointer-events-none" />
              )}
            </div>
          )
        })}
      </div>

      {/* 空状态 */}
      {folderChildren.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <FontAwesomeIcon icon="book-open" className="mb-4 h-16 w-16 opacity-50" />
          <p className="text-lg font-medium">没有找到书籍</p>
          <p className="mt-1 text-sm">尝试调整筛选条件</p>
        </div>
      )}
    </div>
  )
}

export default Linkcccp_BookGridLayout

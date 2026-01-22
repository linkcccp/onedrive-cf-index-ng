import type { OdFileObject, OdFolderChildren, OdFolderObject } from '../types'
import { ParsedUrlQuery } from 'querystring'
import { FC, MouseEventHandler, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import toast, { Toaster } from 'react-hot-toast'
import emojiRegex from 'emoji-regex'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import useSWR from 'swr'

import useLocalStorage from '../utils/useLocalStorage'
import { getPreviewType, preview } from '../utils/getPreviewType'
import { useProtectedSWRInfinite } from '../utils/fetchWithSWR'
import { getExtension, getRawExtension, getFileIcon } from '../utils/getFileIcon'
import { getStoredToken } from '../utils/protectedRouteHandler'
import {
  DownloadingToast,
  downloadMultipleFiles,
  downloadTreelikeMultipleFiles,
  traverseFolder,
} from './MultiFileDownloader'
import { prefetchCovers } from '../utils/Linkcccp_coverUtils'

import { layouts } from './SwitchLayout'
import Loading, { LoadingIcon } from './Loading'
import FourOhFour from './FourOhFour'
import Auth from './Auth'
import TextPreview from './previews/TextPreview'
import MarkdownPreview from './previews/MarkdownPreview'
import CodePreview from './previews/CodePreview'
import OfficePreview from './previews/OfficePreview'
import AudioPreview from './previews/AudioPreview'
import VideoPreview from './previews/VideoPreview'
import PDFPreview from './previews/PDFPreview'
import URLPreview from './previews/URLPreview'
import ImagePreview from './previews/ImagePreview'
import DefaultPreview from './previews/DefaultPreview'
import { PreviewContainer } from './previews/Containers'

import FolderListLayout from './FolderListLayout'
import Linkcccp_BookGridLayout from './Linkcccp_BookGridLayout'
import Linkcccp_Sidebar, { SidebarFilters, filterBooks, BookMetadata } from './Linkcccp_Sidebar'
import siteConfig from '../../config/site.config'
import {
  isHiddenContentUnlocked,
  setHiddenContentUnlocked,
  verifyPassword,
  hasHiddenTag,
} from '../utils/Linkcccp_hashPassword'

// Disabling SSR for some previews
const EPUBPreview = dynamic(() => import('./previews/EPUBPreview'), {
  ssr: false,
})
const Linkcccp_CBZPreview = dynamic(() => import('./previews/Linkcccp_CBZPreview'), {
  ssr: false,
})

/**
 * Convert url query into path string
 *
 * @param query Url query property
 * @returns Path string
 */
const queryToPath = (query?: ParsedUrlQuery) => {
  if (query) {
    const { path } = query
    if (!path) return '/'
    if (typeof path === 'string') return `/${encodeURIComponent(path)}`
    return `/${path.map(p => encodeURIComponent(p)).join('/')}`
  }
  return '/'
}

// Render the icon of a folder child (may be a file or a folder), use emoji if the name of the child contains emoji
const renderEmoji = (name: string) => {
  const emoji = emojiRegex().exec(name)
  return { render: emoji && !emoji.index, emoji }
}
const formatChildName = (name: string) => {
  const { render, emoji } = renderEmoji(name)
  return render ? name.replace(emoji ? emoji[0] : '', '').trim() : name
}
export const ChildName: FC<{ name: string; folder?: boolean }> = ({ name, folder }) => {
  const original = formatChildName(name)
  const extension = folder ? '' : getRawExtension(original)
  const prename = folder ? original : original.substring(0, original.length - extension.length)
  return (
    <span className="truncate before:float-right before:content-[attr(data-tail)]" data-tail={extension}>
      {prename}
    </span>
  )
}
export const ChildIcon: FC<{ child: OdFolderChildren }> = ({ child }) => {
  const { render, emoji } = renderEmoji(child.name)
  return render ? (
    <span>{emoji ? emoji[0] : '📁'}</span>
  ) : (
    <FontAwesomeIcon icon={child.file ? getFileIcon(child.name, { video: Boolean(child.video) }) : ['far', 'folder']} />
  )
}

export const Checkbox: FC<{
  checked: 0 | 1 | 2
  onChange: () => void
  title: string
  indeterminate?: boolean
}> = ({ checked, onChange, title, indeterminate }) => {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.checked = Boolean(checked)
      if (indeterminate) {
        ref.current.indeterminate = checked == 1
      }
    }
  }, [ref, checked, indeterminate])

  const handleClick: MouseEventHandler = e => {
    if (ref.current) {
      if (e.target === ref.current) {
        e.stopPropagation()
      } else {
        ref.current.click()
      }
    }
  }

  return (
    <span
      title={title}
      className="inline-flex cursor-pointer items-center rounded p-1.5 hover:bg-gray-300 dark:hover:bg-gray-600"
      onClick={handleClick}
    >
      <input
        className="form-check-input cursor-pointer"
        type="checkbox"
        value={checked ? '1' : ''}
        ref={ref}
        aria-label={title}
        onChange={onChange}
      />
    </span>
  )
}

export const Downloading: FC<{ title: string; style: string }> = ({ title, style }) => {
  return (
    <span title={title} className={`${style} rounded`} role="status">
      <LoadingIcon
        // Use fontawesome far theme via class `svg-inline--fa` to get style `vertical-align` only
        // for consistent icon alignment, as class `align-*` cannot satisfy it
        className="svg-inline--fa inline-block h-4 w-4 animate-spin"
      />
    </span>
  )
}

const FileListing: FC<{ query?: ParsedUrlQuery }> = ({ query }) => {
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({})
  const [totalSelected, setTotalSelected] = useState<0 | 1 | 2>(0)
  const [totalGenerating, setTotalGenerating] = useState<boolean>(false)
  const [folderGenerating, setFolderGenerating] = useState<{
    [key: string]: boolean
  }>({})
  const [flatFiles, setFlatFiles] = useState<OdFolderChildren[]>([])
  const [loadingFlat, setLoadingFlat] = useState(false)

  // Sidebar 状态
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>({
    authors: [],
    tags: [],
    series: [],
    languages: [],
    publishers: [],
    formats: [],
  })

  // 隐私内容解锁状态
  const [hiddenContentUnlocked, setHiddenUnlocked] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [verifying, setVerifying] = useState(false)

  // 初始化时检查是否已解锁
  useEffect(() => {
    setHiddenUnlocked(isHiddenContentUnlocked())
  }, [])

  // 初始挂载时，如果在移动端则默认关闭
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [])

  // 获取 index.json 元数据用于筛选
  const { data: bookIndexData } = useSWR(
    '/api/Linkcccp_bookIndex',
    (url: string) => fetch(url).then(res => res.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  const router = useRouter()
  const hashedToken = getStoredToken(router.asPath)
  const [layout, _] = useLocalStorage('preferredLayout', layouts[1])

  const path = queryToPath(query)
  console.log('FileListing query:', query, 'path:', path)
  const isRoot = path === '/'

  const { data, error, size, setSize } = useProtectedSWRInfinite(path)

  // 处理筛选条件变化
  const handleFilterChange = useCallback((filters: SidebarFilters) => {
    setSidebarFilters(filters)
  }, [])

  // 切换 Sidebar 显示
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  // 处理密码验证
  const handlePasswordSubmit = useCallback(async () => {
    if (!passwordInput.trim()) {
      setPasswordError('请输入密码')
      return
    }
    setVerifying(true)
    setPasswordError('')
    try {
      const isValid = await verifyPassword(passwordInput, (siteConfig as any).Linkcccp_hiddenTagsPasswordHash || '')
      if (isValid) {
        setHiddenContentUnlocked(true)
        setHiddenUnlocked(true)
        setShowPasswordModal(false)
        setPasswordInput('')
        toast.success('解锁成功！隐藏内容已显示')
      } else {
        setPasswordError('密码错误')
      }
    } catch (err) {
      setPasswordError('验证失败，请重试')
    } finally {
      setVerifying(false)
    }
  }, [passwordInput])

  // 锁定隐私内容
  const handleLockContent = useCallback(() => {
    setHiddenContentUnlocked(false)
    setHiddenUnlocked(false)
    toast.success('已重新锁定隐藏内容')
  }, [])

  // Recursively fetch all files in subfolders when the current path is a folder
  useEffect(() => {
    const folderData = data?.[0]?.folder
    if (folderData) {
      let isMounted = true
      const fetchFlatFiles = async () => {
        setLoadingFlat(true)
        const files: OdFolderChildren[] = []
        try {
          for await (const { meta, isFolder, error } of traverseFolder(path)) {
            if (error) continue
            if (!isFolder) {
              const ext = getExtension(meta.name).toLowerCase()
              if (['cbz', 'epub', 'pdf'].includes(ext)) {
                files.push(meta)
              }
            }
          }
          if (isMounted) {
            setFlatFiles(files)
            setLoadingFlat(false)
          }
        } catch (err) {
          console.error('Failed to traverse folder:', err)
          if (isMounted) setLoadingFlat(false)
        }
      }
      fetchFlatFiles()
      return () => {
        isMounted = false
      }
    } else {
      // Not a folder, reset flat files
      setFlatFiles([])
      setLoadingFlat(false)
    }
  }, [path, data])

  const responses: any[] = data ? [].concat(...data) : []
  // 预取封面
  useEffect(() => {
    if (responses.length > 0 && 'folder' in responses[0]) {
      const folderChildren = [].concat(...responses.map(r => r.folder.value)) as OdFolderChildren[]
      // 构建书籍元数据映射
      const bookMetadataMap = new Map<string, BookMetadata>()
      if (bookIndexData?.books) {
        for (const book of bookIndexData.books as BookMetadata[]) {
          bookMetadataMap.set(book.name, book)
        }
      }
      // 静默预取，不阻塞 UI
      prefetchCovers(folderChildren, path, hashedToken, bookMetadataMap).catch(() => {})
    }
  }, [responses, path, hashedToken, bookIndexData])
  if (error) {
    // If error includes 403 which means the user has not completed initial setup, redirect to OAuth page
    if (error.status === 403) {
      router.push('/onedrive-oauth/step-1')
      return <div />
    }

    return (
      <PreviewContainer>
        {error.status === 401 ? <Auth redirect={path} /> : <FourOhFour errorMsg={JSON.stringify(error.message)} />}
      </PreviewContainer>
    )
  }
  if (!data) {
    return (
      <PreviewContainer>
        <Loading loadingText={'Loading ...'} />
      </PreviewContainer>
    )
  }
  console.log('FileListing debug:', { path, responses, data })

  const isLoadingInitialData = !data && !error
  const isLoadingMore = isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === 'undefined')
  const isEmpty = data?.[0]?.length === 0
  const isReachingEnd = isEmpty || (data && typeof data[data.length - 1]?.next === 'undefined')
  const onlyOnePage = data && typeof data[0].next === 'undefined'

  console.log(
    'responses[0] keys:',
    Object.keys(responses[0]),
    'has folder?',
    'folder' in responses[0],
    'has file?',
    'file' in responses[0]
  )
  if ('folder' in responses[0]) {
    // Expand list of API returns into flattened file data
    const folderChildren = [].concat(...responses.map(r => r.folder.value)) as OdFolderObject['value']

    // Find README.md file to render
    const readmeFile = folderChildren.find(c => c.name.toLowerCase() === 'readme.md')

    // Filtered file list helper - use flatFiles if available, otherwise fallback to current folder children
    const getFiles = () => {
      const source = loadingFlat ? folderChildren : flatFiles.length > 0 ? flatFiles : folderChildren
      let files = source.filter(
        c => !c.folder && c.name !== '.password' && ['cbz', 'epub', 'pdf'].includes(getExtension(c.name).toLowerCase())
      )

      // 如果有筛选条件且有 index.json 数据，应用筛选
      const hasFilters = Object.values(sidebarFilters).some(arr => arr.length > 0)
      if (hasFilters && bookIndexData?.books) {
        // 将 index.json 中的书籍数据转换为可筛选的格式
        const bookMetadataMap = new Map<string, BookMetadata>()
        for (const book of bookIndexData.books as BookMetadata[]) {
          bookMetadataMap.set(book.name, book)
        }

        // 根据筛选条件过滤
        const filteredBookNames = new Set(
          filterBooks(bookIndexData.books as BookMetadata[], sidebarFilters).map(b => b.name)
        )

        files = files.filter(f => filteredBookNames.has(f.name))
      }

      // 隐私标签过滤：如果未解锁，隐藏包含隐私标签的文件
      const hiddenTags = (siteConfig as any).Linkcccp_hiddenTags || []
      if (hiddenTags.length > 0 && !hiddenContentUnlocked && bookIndexData?.books) {
        const bookMetaMap = new Map<string, BookMetadata>()
        for (const book of bookIndexData.books as BookMetadata[]) {
          bookMetaMap.set(book.name, book)
        }
        files = files.filter(f => {
          const meta = bookMetaMap.get(f.name)
          return !hasHiddenTag(meta?.tags, hiddenTags)
        })
      }

      return files
    }

    // File selection
    const genTotalSelected = (selected: { [key: string]: boolean }) => {
      const selectInfo = getFiles().map(c => Boolean(selected[c.id]))
      const [hasT, hasF] = [selectInfo.some(i => i), selectInfo.some(i => !i)]
      return hasT && hasF ? 1 : !hasF ? 2 : 0
    }

    const toggleItemSelected = (id: string) => {
      let val: SetStateAction<{ [key: string]: boolean }>
      if (selected[id]) {
        val = { ...selected }
        delete val[id]
      } else {
        val = { ...selected, [id]: true }
      }
      setSelected(val)
      setTotalSelected(genTotalSelected(val))
    }

    const toggleTotalSelected = () => {
      if (genTotalSelected(selected) == 2) {
        setSelected({})
        setTotalSelected(0)
      } else {
        setSelected(Object.fromEntries(getFiles().map(c => [c.id, true])))
        setTotalSelected(2)
      }
    }

    // Selected file download
    const handleSelectedDownload = () => {
      const folderName = path.substring(path.lastIndexOf('/') + 1)
      const folder = folderName ? decodeURIComponent(folderName) : undefined
      const files = getFiles()
        .filter(c => selected[c.id])
        .map(c => ({
          name: c.name,
          url: `/api/raw?path=${path}/${encodeURIComponent(c.name)}${hashedToken ? `&odpt=${hashedToken}` : ''}`,
        }))

      if (files.length == 1) {
        const el = document.createElement('a')
        el.style.display = 'none'
        document.body.appendChild(el)
        el.href = files[0].url
        el.click()
        el.remove()
      } else if (files.length > 1) {
        setTotalGenerating(true)

        const toastId = toast.loading(<DownloadingToast router={router} />)
        downloadMultipleFiles({ toastId, router, files, folder })
          .then(() => {
            setTotalGenerating(false)
            toast.success('Finished downloading selected files.', {
              id: toastId,
            })
          })
          .catch(() => {
            setTotalGenerating(false)
            toast.error('Failed to download selected files.', { id: toastId })
          })
      }
    }

    // Get selected file permalink
    const handleSelectedPermalink = (baseUrl: string) => {
      return getFiles()
        .filter(c => selected[c.id])
        .map(
          c =>
            `${baseUrl}/api/raw?path=${path}/${encodeURIComponent(c.name)}${hashedToken ? `&odpt=${hashedToken}` : ''}`
        )
        .join('\n')
    }

    // Folder recursive download
    const handleFolderDownload = (path: string, id: string, name?: string) => () => {
      const files = (async function* () {
        for await (const { meta: c, path: p, isFolder, error } of traverseFolder(path)) {
          if (error) {
            toast.error(`Failed to download folder ${p}: ${error.status} ${error.message} Skipped it to continue.`)
            continue
          }
          const hashedTokenForPath = getStoredToken(p)
          yield {
            name: c?.name,
            url: `/api/raw?path=${p}${hashedTokenForPath ? `&odpt=${hashedTokenForPath}` : ''}`,
            path: p,
            isFolder,
          }
        }
      })()

      setFolderGenerating({ ...folderGenerating, [id]: true })
      const toastId = toast.loading(<DownloadingToast router={router} />)

      downloadTreelikeMultipleFiles({
        toastId,
        router,
        files,
        basePath: path,
        folder: name,
      })
        .then(() => {
          setFolderGenerating({ ...folderGenerating, [id]: false })
          toast.success('Finished downloading folder.', { id: toastId })
        })
        .catch(() => {
          setFolderGenerating({ ...folderGenerating, [id]: false })
          toast.error('Failed to download folder.', { id: toastId })
        })
    }

    // Folder layout component props
    const displayChildren = getFiles()

    // 构建书籍元数据映射表
    const bookMetadataMap = new Map<string, BookMetadata>()
    if (bookIndexData?.books) {
      for (const book of bookIndexData.books as BookMetadata[]) {
        bookMetadataMap.set(book.name, book)
      }
    }

    const folderProps = {
      toast,
      path,
      folderChildren: displayChildren,
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
    }

    // 计算选中的筛选数量
    const filterCount = Object.values(sidebarFilters).reduce((sum, arr) => sum + arr.length, 0)

    // 检查是否有隐私标签配置
    const hiddenTags = (siteConfig as any).Linkcccp_hiddenTags || []
    const hasHiddenTagsConfig = hiddenTags.length > 0

    // 密码弹窗组件
    const PasswordModal = () =>
      showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-fluent-xl bg-white p-6 shadow-fluent-lg dark:bg-gray-800">
            <h3 className="mb-4 flex items-center text-lg font-semibold text-gray-800 dark:text-gray-100">
              <FontAwesomeIcon icon="lock" className="text-amber-500 mr-2 h-5 w-5" />
              解锁隐藏内容
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">请输入密码以查看包含隐私标签的内容</p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="请输入密码"
              className="mb-2 w-full rounded-fluent-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
            {passwordError && <p className="mb-3 text-sm text-red-500">{passwordError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordInput('')
                  setPasswordError('')
                }}
                className="rounded-fluent-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={verifying}
                className="flex items-center rounded-fluent-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <FontAwesomeIcon icon="spinner" spin className="mr-2 h-4 w-4" />
                    验证中...
                  </>
                ) : (
                  '确认'
                )}
              </button>
            </div>
          </div>
        </div>
      )

    // 解锁按钮组件
    const UnlockButton = () =>
      hasHiddenTagsConfig &&
      (hiddenContentUnlocked ? (
        <button
          onClick={handleLockContent}
          className="flex items-center gap-2 rounded-fluent-lg bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 shadow-fluent-sm transition-all hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
          title="点击重新锁定隐藏内容"
        >
          <FontAwesomeIcon icon="lock-open" className="h-4 w-4" />
          <span>已解锁</span>
        </button>
      ) : (
        <button
          onClick={() => setShowPasswordModal(true)}
          className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 flex items-center gap-2 rounded-fluent-lg px-4 py-2.5 text-sm font-medium shadow-fluent-sm transition-all"
          title="输入密码解锁隐藏内容"
        >
          <FontAwesomeIcon icon="lock" className="h-4 w-4" />
          <span>解锁</span>
        </button>
      ))

    // If root path, show flattened file list instead of book grid
    if (isRoot) {
      return (
        <>
          <Toaster />
          <PasswordModal />
          <div className="flex">
            {/* Sidebar */}
            <Linkcccp_Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} onFilterChange={handleFilterChange} />

            {/* 主内容区 */}
            <div className="min-w-0 flex-1 transition-all duration-300">
              {/* 汉堡按钮 - 移动端和桌面端都显示 */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  className="flex items-center gap-2 rounded-fluent-lg bg-fluent-surface-card px-4 py-2.5 text-sm font-medium text-gray-700 shadow-fluent-sm transition-all hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={toggleSidebar}
                  title={sidebarOpen ? '折叠筛选' : '展开筛选'}
                >
                  <FontAwesomeIcon icon="bars" className="h-5 w-5" />
                  <span>图书筛选</span>
                  {filterCount > 0 && (
                    <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">{filterCount}</span>
                  )}
                </button>

                {/* 解锁按钮 */}
                <UnlockButton />

                {/* 显示结果数量 */}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  共 {displayChildren.length} 本书
                  {filterCount > 0 && bookIndexData?.total && (
                    <span className="ml-1">（筛选自 {bookIndexData.total} 本）</span>
                  )}
                </span>
              </div>

              {layout.name === 'Grid' ? (
                <Linkcccp_BookGridLayout {...folderProps} />
              ) : (
                <FolderListLayout {...folderProps} />
              )}
              {readmeFile && (
                <div className="mt-4">
                  <MarkdownPreview file={readmeFile} path={path} standalone={false} />
                </div>
              )}
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        <Toaster />
        <PasswordModal />
        <div className="flex">
          {/* Sidebar */}
          <Linkcccp_Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} onFilterChange={handleFilterChange} />

          {/* 主内容区 */}
          <div className="min-w-0 flex-1 transition-all duration-300">
            {/* 汉堡按钮 */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                className="flex items-center gap-2 rounded-fluent-lg bg-fluent-surface-card px-4 py-2.5 text-sm font-medium text-gray-700 shadow-fluent-sm transition-all hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={toggleSidebar}
                title={sidebarOpen ? '折叠筛选' : '展开筛选'}
              >
                <FontAwesomeIcon icon="bars" className="h-5 w-5" />
                <span>图书筛选</span>
                {filterCount > 0 && (
                  <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">{filterCount}</span>
                )}
              </button>

              {/* 解锁按钮 */}
              <UnlockButton />

              {/* 显示结果数量 */}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                共 {displayChildren.length} 本书
                {filterCount > 0 && bookIndexData?.total && (
                  <span className="ml-1">（筛选自 {bookIndexData.total} 本）</span>
                )}
              </span>
            </div>

            {layout.name === 'Grid' ? (
              <Linkcccp_BookGridLayout {...folderProps} />
            ) : (
              <FolderListLayout {...folderProps} />
            )}

            {readmeFile && (
              <div className="mt-4">
                <MarkdownPreview file={readmeFile} path={path} standalone={false} />
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  if ('file' in responses[0] && responses.length === 1) {
    const file = responses[0].file as OdFileObject
    const previewType = getPreviewType(getExtension(file.name), { video: Boolean(file.video) })

    if (previewType) {
      switch (previewType) {
        case preview.image:
          return <ImagePreview file={file} />

        case preview.text:
          return <TextPreview file={file} />

        case preview.code:
          return <CodePreview file={file} />

        case preview.markdown:
          return <MarkdownPreview file={file} path={path} />

        case preview.video:
          return <VideoPreview file={file} />

        case preview.audio:
          return <AudioPreview file={file} />

        case preview.pdf:
          return <PDFPreview file={file} />

        case preview.office:
          return <OfficePreview file={file} />

        case preview.epub:
          return <EPUBPreview file={file} />

        case preview.linkcccp_cbz:
          return <Linkcccp_CBZPreview file={file} />

        case preview.url:
          return <URLPreview file={file} />

        default:
          return <DefaultPreview file={file} />
      }
    } else {
      return <DefaultPreview file={file} />
    }
  }

  return (
    <PreviewContainer>
      <FourOhFour errorMsg={`Cannot preview ${path}`} />
    </PreviewContainer>
  )
}
export default FileListing

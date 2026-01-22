import type { OdFolderChildren } from '../types'
import type { BookMetadata } from './Linkcccp_Sidebar'

import Link from 'next/link'
import { FC, useState, useEffect } from 'react'
import { useClipboard } from 'use-clipboard-copy'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { getBaseUrl } from '../utils/getBaseUrl'
import { extractCBZCover, revokeCBZCoverUrl } from '../utils/Linkcccp_CBZCover'
import { humanFileSize, formatModifiedDateTime } from '../utils/fileDetails'

import { Downloading, Checkbox, ChildIcon, ChildName } from './FileListing'
import { getStoredToken } from '../utils/protectedRouteHandler'

const FileListItem: FC<{
  fileContent: OdFolderChildren
  path: string
  hashedToken?: string | null
  bookMeta?: BookMetadata
}> = ({ fileContent: c, path, hashedToken, bookMeta }) => {
  const isCBZ = /\.cbz$/i.test(c.name)
  const cleanPath = path.replace(/\/$/, '')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)

  useEffect(() => {
    let active = true
    if (!isCBZ) return
    if (coverUrl) return

    const doExtract = async () => {
      setExtracting(true)
      try {
        const fileKey = c.id || `${cleanPath}/${c.name}`
        const downloadUrl = `/api/raw?path=${encodeURIComponent(cleanPath + '/' + c.name)}${
          hashedToken ? `&odpt=${hashedToken}` : ''
        }`
        const url = await extractCBZCover(fileKey, c.lastModifiedDateTime, downloadUrl)
        if (!active) return
        if (url) setCoverUrl(url)
      } catch (err) {
        console.error('Failed to extract CBZ cover in list:', err)
      } finally {
        if (active) setExtracting(false)
      }
    }

    doExtract()

    return () => {
      active = false
      if (coverUrl) revokeCBZCoverUrl(coverUrl)
    }
  }, [isCBZ, coverUrl, c.id, c.name, c.lastModifiedDateTime, cleanPath, hashedToken])

  return (
    <div className="grid cursor-pointer grid-cols-10 items-center space-x-2 px-3 py-2.5">
      <div className="col-span-10 flex items-center space-x-2 truncate md:col-span-6" title={c.name}>
        <div className="w-12 flex-shrink-0 text-center">
          {isCBZ ? (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="h-16 w-12 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt={c.name} className="h-full w-full object-cover object-center" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  {extracting ? <span className="animate-spin">⏳</span> : <FontAwesomeIcon icon="book" />}
                </div>
              )}
            </div>
          ) : (
            <div className="w-5 text-center">
              <ChildIcon child={c} />
            </div>
          )}
        </div>
        <ChildName name={c.name} folder={Boolean(c.folder)} />
      </div>
      <div className="col-span-3 hidden flex-shrink-0 font-mono text-sm text-gray-700 dark:text-gray-500 md:block">
        {formatModifiedDateTime(c.lastModifiedDateTime)}
      </div>
      <div className="col-span-1 hidden flex-shrink-0 truncate font-mono text-sm text-gray-700 dark:text-gray-500 md:block">
        {humanFileSize(c.size)}
      </div>
    </div>
  )
}

const FolderListLayout = ({
  path,
  folderChildren,
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
  bookMetadataMap,
}) => {
  const clipboard = useClipboard()
  const hashedToken = getStoredToken(path)

  // Get item path from item name
  const getItemPath = (name: string) => `${path === '/' ? '' : path}/${encodeURIComponent(name)}`

  return (
    <div className="rounded-fluent-lg bg-fluent-surface-card shadow-fluent-sm dark:bg-fluent-surface-card dark:text-fluent-text-primary">
      <div className="grid grid-cols-12 items-center space-x-2 border-b border-fluent-border px-3 dark:border-fluent-border">
        <div className="col-span-12 py-2 text-xs font-bold uppercase tracking-widest text-fluent-text-secondary dark:text-fluent-text-secondary md:col-span-6">
          {'Name'}
        </div>
        <div className="col-span-3 hidden text-xs font-bold uppercase tracking-widest text-fluent-text-secondary dark:text-fluent-text-secondary md:block">
          {'Last Modified'}
        </div>
        <div className="hidden text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300 md:block">
          {'Size'}
        </div>
        <div className="hidden text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300 md:block">
          {'Actions'}
        </div>
        <div className="hidden text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300 md:block">
          <div className="hidden p-1.5 text-gray-700 dark:text-gray-400 md:flex">
            <Checkbox
              checked={totalSelected}
              onChange={toggleTotalSelected}
              indeterminate={true}
              title={'Select files'}
            />
            <button
              title={'Copy selected files permalink'}
              className="cursor-pointer rounded p-1.5 hover:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white dark:hover:bg-gray-600 disabled:dark:text-gray-600 disabled:hover:dark:bg-gray-900"
              disabled={totalSelected === 0}
              onClick={() => {
                clipboard.copy(handleSelectedPermalink(getBaseUrl()))
                toast.success('Copied selected files permalink.')
              }}
            >
              <FontAwesomeIcon icon={['far', 'copy']} size="lg" />
            </button>
            {totalGenerating ? (
              <Downloading title={'Downloading selected files, refresh page to cancel'} style="p-1.5" />
            ) : (
              <button
                title={'Download selected files'}
                className="cursor-pointer rounded p-1.5 hover:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white dark:hover:bg-gray-600 disabled:dark:text-gray-600 disabled:hover:dark:bg-gray-900"
                disabled={totalSelected === 0}
                onClick={handleSelectedDownload}
              >
                <FontAwesomeIcon icon={['far', 'arrow-alt-circle-down']} size="lg" />
              </button>
            )}
          </div>
        </div>
      </div>

      {folderChildren.map((c: OdFolderChildren) => (
        <div
          className="grid grid-cols-12 transition-all duration-100 hover:bg-gray-100 dark:hover:bg-gray-850"
          key={c.id}
        >
          <Link
            href={`${path === '/' ? '' : path}/${encodeURIComponent(c.name)}`}
            passHref
            className="col-span-12 md:col-span-10"
          >
            <FileListItem fileContent={c} path={path} hashedToken={hashedToken} />
          </Link>

          {c.folder ? (
            <div className="hidden p-1.5 text-gray-700 dark:text-gray-400 md:flex">
              <span
                title={'Copy folder permalink'}
                className="cursor-pointer rounded px-1.5 py-1 hover:bg-gray-300 dark:hover:bg-gray-600"
                onClick={() => {
                  clipboard.copy(`${getBaseUrl()}${`${path === '/' ? '' : path}/${encodeURIComponent(c.name)}`}`)
                  toast('Copied folder permalink.', { icon: '👌' })
                }}
              >
                <FontAwesomeIcon icon={['far', 'copy']} />
              </span>
              {folderGenerating[c.id] ? (
                <Downloading title={'Downloading folder, refresh page to cancel'} style="px-1.5 py-1" />
              ) : (
                <span
                  title={'Download folder'}
                  className="cursor-pointer rounded px-1.5 py-1 hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={() => {
                    const p = `${path === '/' ? '' : path}/${encodeURIComponent(c.name)}`
                    handleFolderDownload(p, c.id, c.name)()
                  }}
                >
                  <FontAwesomeIcon icon={['far', 'arrow-alt-circle-down']} />
                </span>
              )}
            </div>
          ) : (
            <div className="hidden p-1.5 text-gray-700 dark:text-gray-400 md:flex">
              <span
                title={'Copy raw file permalink'}
                className="cursor-pointer rounded px-1.5 py-1 hover:bg-gray-300 dark:hover:bg-gray-600"
                onClick={() => {
                  clipboard.copy(
                    `${getBaseUrl()}/api/raw?path=${getItemPath(c.name)}${hashedToken ? `&odpt=${hashedToken}` : ''}`
                  )
                  toast.success('Copied raw file permalink.')
                }}
              >
                <FontAwesomeIcon icon={['far', 'copy']} />
              </span>
              <a
                title={'Download file'}
                className="cursor-pointer rounded px-1.5 py-1 hover:bg-gray-300 dark:hover:bg-gray-600"
                href={`/api/raw?path=${getItemPath(c.name)}${hashedToken ? `&odpt=${hashedToken}` : ''}`}
              >
                <FontAwesomeIcon icon={['far', 'arrow-alt-circle-down']} />
              </a>
            </div>
          )}
          <div className="hidden p-1.5 text-gray-700 dark:text-gray-400 md:flex">
            {!c.folder && !(c.name === '.password') && (
              <Checkbox
                checked={selected[c.id] ? 2 : 0}
                onChange={() => toggleItemSelected(c.id)}
                title={'Select file'}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default FolderListLayout

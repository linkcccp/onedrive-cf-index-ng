import type { OdFileObject } from '../../types'

import { FC, useEffect, useRef, useState } from 'react'
import { ReactReader } from 'react-reader'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faFileAlt } from '@fortawesome/free-solid-svg-icons'

import Loading from '../Loading'
import DownloadButtonGroup from '../DownloadBtnGtoup'
import { DownloadBtnContainer } from './Containers'
import { getStoredToken } from '../../utils/protectedRouteHandler'

import { Linkcccp_downloadAndCache } from '../../utils/Linkcccp_UniversalCache'

const EPUBPreview: FC<{ file: OdFileObject }> = ({ file }) => {
  const { asPath } = useRouter()
  const hashedToken = getStoredToken(asPath)

  // Linkcccp: 用于控制滚轮翻页频率的节流计时器
  const lastWheelTime = useRef(0)

  const [loading, setLoading] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [data, setData] = useState<ArrayBuffer | null>(null)

  // Linkcccp: 是否单页显示 (默认开启)
  const [isSinglePage, setIsSinglePage] = useState(true)

  // Linkcccp: 离线缓存加载逻辑
  useEffect(() => {
    let active = true

    const loadFile = async () => {
      try {
        setLoading(true)
        const fileKey = file.id || asPath
        const downloadUrl = `/api/raw?path=${asPath}${hashedToken ? '&odpt=' + hashedToken : ''}`

        const blob = await Linkcccp_downloadAndCache(
          fileKey,
          file.lastModifiedDateTime,
          downloadUrl,
          progress => active && setDownloadProgress(progress)
        )

        if (active) {
          const buffer = await blob.arrayBuffer()
          setData(buffer)
          setLoading(false)
        }
      } catch (e) {
        console.error('EPUB Load Error', e)
        if (active) setLoading(false)
      }
    }
    loadFile()
    return () => {
      active = false
    }
  }, [asPath, file.id, file.lastModifiedDateTime, hashedToken])

  // Linkcccp: 历史进度存取逻辑
  const storageKey = `epub-progress-${file.id || asPath}`
  const [location, setLocation] = useState<string>()

  // 加载初始进度
  useEffect(() => {
    const savedLocation = localStorage.getItem(storageKey)
    if (savedLocation) {
      setLocation(savedLocation)
    }
  }, [storageKey])

  const onLocationChange = (cfiStr: string) => {
    setLocation(cfiStr)
    localStorage.setItem(storageKey, cfiStr)
  }

  if (loading || !data) {
    return (
      <div className="flex w-full items-center justify-center rounded bg-white p-4" style={{ height: '50vh' }}>
        <Loading loadingText={`Downloading EPUB ${downloadProgress}% ...`} />
      </div>
    )
  }

  // Fix for not valid epub files according to
  // https://github.com/gerhardsletten/react-reader/issues/33#issuecomment-673964947
  const fixEpub = rendition => {
    // Linkcccp: 移除原有的 spine.get 拦截逻辑，该逻辑可能导致部分标准电子书显示空白
    // 仅保留鼠标滚轮翻页功能
    rendition.hooks.content.register(contents => {
      const el = contents.document.documentElement
      if (el) {
        el.addEventListener('wheel', (e: WheelEvent) => {
          e.preventDefault() // 阻止默认滚动行为，防止页面抖动
          const now = Date.now()
          // 节流: 500ms 内只响应一次滚轮
          if (now - lastWheelTime.current < 500) return
          lastWheelTime.current = now

          if (e.deltaY > 0) {
            rendition.next()
          } else if (e.deltaY < 0) {
            rendition.prev()
          }
        })
      }
    })
  }

  return (
    <div>
      <div
        className="flex w-full flex-col rounded bg-white dark:bg-gray-900 md:p-3"
        style={{ height: '85vh' }}
      >
        {/* Linkcccp: 页面模式切换按钮 */}
        <div className="mb-2 flex justify-end px-2">
          <button
            onClick={() => setIsSinglePage(!isSinglePage)}
            className="flex items-center gap-2 rounded bg-gray-100 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <FontAwesomeIcon icon={isSinglePage ? faBookOpen : faFileAlt} />
            <span>{isSinglePage ? '切换到双页' : '切换到单页'}</span>
          </button>
        </div>

        <div className="relative w-full flex-1 overflow-hidden">
          <ReactReader
            key={isSinglePage ? 'single' : 'double'} // Linkcccp: 切换时强制重新渲染，确保排版刷新
            url={data}
            getRendition={rendition => fixEpub(rendition)}
            loadingView={<Loading loadingText="Parsing EPUB..." />}
            location={location}
            locationChanged={onLocationChange}
            epubInitOptions={{ openAs: 'epub' }}
            swipeable={true} // Linkcccp: 启用滑动翻页支持
            // 修改此处配置以提高兼容性
            epubOptions={{
              allowPopups: true,
            }}
          />
        </div>
      </div>
      <DownloadBtnContainer>
        <DownloadButtonGroup />
      </DownloadBtnContainer>
    </div>
  )
}

export default EPUBPreview

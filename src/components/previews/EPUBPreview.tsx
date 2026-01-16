import type { OdFileObject } from '../../types'

import { FC, useEffect, useRef, useState } from 'react'
import { ReactReader } from 'react-reader'
import { useRouter } from 'next/router'

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
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  // Linkcccp: 离线缓存加载逻辑
  useEffect(() => {
    let active = true
    let currentBlobUrl: string | null = null

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
          const url = URL.createObjectURL(blob)
          currentBlobUrl = url
          setBlobUrl(url)
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
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    }
  }, [asPath, file.id, file.lastModifiedDateTime, hashedToken])

  const [location, setLocation] = useState<string>()
  const onLocationChange = (cfiStr: string) => setLocation(cfiStr)

  if (loading || !blobUrl) {
    return (
      <div className="flex w-full items-center justify-center rounded bg-white p-4" style={{ height: '50vh' }}>
        <Loading loadingText={`Downloading EPUB ${downloadProgress}% ...`} />
      </div>
    )
  }

  // Fix for not valid epub files according to
  // https://github.com/gerhardsletten/react-reader/issues/33#issuecomment-673964947
  const fixEpub = rendition => {
    // 1. 修复路径问题
    const spineGet = rendition.book.spine.get.bind(rendition.book.spine)
    rendition.book.spine.get = function (target: string) {
      const targetStr = target as string
      let t = spineGet(target)
      while (t == null && targetStr.startsWith('../')) {
        target = targetStr.substring(3)
        t = spineGet(target)
      }
      return t
    }

    // 新增: 注册鼠标滚轮事件监听
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
        <div className="relative w-full flex-1 overflow-hidden">
          <ReactReader
            url={blobUrl}
            getRendition={rendition => fixEpub(rendition)}
            loadingView={<Loading loadingText="Parsing EPUB..." />}
            location={location}
            locationChanged={onLocationChange}
            epubInitOptions={{ openAs: 'epub' }}
            swipeable={true} // Linkcccp: 启用滑动翻页支持
            // 修改此处配置以启用翻页效果
            epubOptions={{
              flow: 'paginated',    // 将 'scrolled' 改为 'paginated' 以启用分页
              manager: 'default',   // 指定默认的分页管理器
              allowPopups: true
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

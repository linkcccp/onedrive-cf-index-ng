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

  const [epubContainerWidth, setEpubContainerWidth] = useState(400)
  const epubContainer = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    setEpubContainerWidth(epubContainer.current ? epubContainer.current.offsetWidth : 400)
  }, [])

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
  }

  return (
    <div>
      <div
        className="no-scrollbar flex w-full flex-col overflow-scroll rounded bg-white dark:bg-gray-900 md:p-3"
        style={{ maxHeight: '90vh' }}
      >
        <div className="no-scrollbar w-full flex-1 overflow-scroll" ref={epubContainer} style={{ minHeight: '70vh' }}>
          <div
            style={{
              position: 'absolute',
              width: epubContainerWidth,
              height: '70vh',
            }}
          >
            <ReactReader
              url={blobUrl}
              getRendition={rendition => fixEpub(rendition)}
              loadingView={<Loading loadingText="Parsing EPUB..." />}
              location={location}
              locationChanged={onLocationChange}
              epubInitOptions={{ openAs: 'epub' }}
              epubOptions={{ flow: 'scrolled', allowPopups: true }}
            />
          </div>
        </div>
      </div>
      <DownloadBtnContainer>
        <DownloadButtonGroup />
      </DownloadBtnContainer>
    </div>
  )
}

export default EPUBPreview

import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { getBaseUrl } from '../../utils/getBaseUrl'
import { getStoredToken } from '../../utils/protectedRouteHandler'
import DownloadButtonGroup from '../DownloadBtnGtoup'
import { DownloadBtnContainer } from './Containers'
import Loading from '../Loading'
import { Linkcccp_downloadAndCache } from '../../utils/Linkcccp_UniversalCache'

const PDFEmbedPreview: React.FC<{ file: any }> = ({ file }) => {
  const { asPath } = useRouter()
  const hashedToken = getStoredToken(asPath)

  const [loading, setLoading] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

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
        console.error('PDF Load Error', e)
        if (active) setLoading(false)
      }
    }
    loadFile()
    return () => {
      active = false
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    }
  }, [asPath, file.id, file.lastModifiedDateTime, hashedToken])

  // 原有逻辑作为 fallback 或者不用
  /*
  const pdfPath = encodeURIComponent(
    `${getBaseUrl()}/api/raw?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`
  )
  const url = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${pdfPath}`
  */

  if (loading || !blobUrl) {
    return (
      <div className="flex w-full items-center justify-center rounded bg-white p-4" style={{ height: '50vh' }}>
        <Loading loadingText={`Downloading PDF ${downloadProgress}% ...`} />
      </div>
    )
  }

  return (
    <div>
      <div className="w-full overflow-hidden rounded" style={{ height: '90vh' }}>
        <iframe src={blobUrl} frameBorder="0" width="100%" height="100%"></iframe>
      </div>

      <DownloadBtnContainer>
        <DownloadButtonGroup />
      </DownloadBtnContainer>
    </div>
  )
}

export default PDFEmbedPreview

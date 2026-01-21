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
  const cleanPath = asPath.split('?')[0]
  const hashedToken = getStoredToken(cleanPath)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let currentBlobUrl: string | null = null

    const loadFile = async () => {
      try {
        setLoading(true)
        setError(null)
        const fileKey = file.id || cleanPath
        const downloadUrl = `/api/raw?path=${cleanPath}${hashedToken ? '&odpt=' + hashedToken : ''}`

        const blob = await Linkcccp_downloadAndCache(
          fileKey,
          file.lastModifiedDateTime,
          downloadUrl,
          progress => active && setDownloadProgress(progress)
        )

        if (active) {
          // 强制指定 Blob 类型为 application/pdf，确保浏览器正确识别
          const pdfBlob = new Blob([blob], { type: 'application/pdf' })
          const url = URL.createObjectURL(pdfBlob)
          currentBlobUrl = url
          setBlobUrl(url)
          setLoading(false)
        }
      } catch (e: any) {
        console.error('PDF Load Error', e)
        if (active) {
          setError(e.message || 'Failed to load PDF')
          setLoading(false)
        }
      }
    }
    loadFile()
    return () => {
      active = false
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    }
  }, [cleanPath, file.id, file.lastModifiedDateTime, hashedToken])

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center rounded bg-white p-4" style={{ height: '50vh' }}>
        <Loading loadingText={`Downloading PDF ${downloadProgress}% ...`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center justify-center rounded bg-white p-10 dark:bg-gray-900" style={{ height: '50vh' }}>
        <div className="mb-4 text-red-500">预览加载失败: {error}</div>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="w-full overflow-hidden rounded" style={{ height: '90vh' }}>
        <iframe src={blobUrl!} frameBorder="0" width="100%" height="100%"></iframe>
      </div>

      <DownloadBtnContainer>
        <DownloadButtonGroup />
      </DownloadBtnContainer>
    </div>
  )
}

export default PDFEmbedPreview

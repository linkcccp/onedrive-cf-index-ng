import { Linkcccp_getFromCache, Linkcccp_saveToCache } from './Linkcccp_UniversalCache'

// 从 CBZ 文件中提取第一张图片作为封面
export async function extractCBZCover(
  fileKey: string,
  lastModified: string,
  downloadUrl: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  // 检查缓存中是否已有封面图片的 Blob URL
  const cacheKey = `cbz-cover-${fileKey}`
  const cached = await Linkcccp_getFromCache(cacheKey)
  if (cached && cached.lastModified === lastModified) {
    return URL.createObjectURL(cached.blob)
  }

  // 未命中缓存，需要下载并解压 CBZ
  let zip: any
  try {
    // 动态导入 zip.js 库
    const zipModule = await import('@zip.js/zip.js')
    zip = zipModule
    zip.configure({ useWebWorkers: true })
  } catch (err) {
    console.error('Failed to load zip.js:', err)
    return null
  }

  // 下载整个 CBZ 文件（使用已有缓存机制）
  const fullBlob = await downloadCBZBlob(fileKey, lastModified, downloadUrl, onProgress)
  if (!fullBlob) return null

  // 创建 ZipReader
  const zipReader = new zip.ZipReader(new zip.BlobReader(fullBlob))
  try {
    const entries = await zipReader.getEntries()
    // 找出第一个图片文件
    const imageEntry = entries.find(
      e => !e.directory && /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i.test(e.filename)
    )
    if (!imageEntry) {
      console.warn('No image found in CBZ')
      return null
    }

    // 解压该图片条目
    const coverBlob = await imageEntry.getData(new zip.BlobWriter(), { checkSignature: false })
    // 缓存封面图片
    await Linkcccp_saveToCache(cacheKey, coverBlob, lastModified)
    const coverUrl = URL.createObjectURL(coverBlob)
    return coverUrl
  } finally {
    await zipReader.close()
  }
}

// 下载 CBZ 文件（复用通用缓存逻辑）
async function downloadCBZBlob(
  fileKey: string,
  lastModified: string,
  downloadUrl: string,
  onProgress?: (progress: number) => void
): Promise<Blob | null> {
  // 尝试从通用缓存获取整个文件
  const cached = await Linkcccp_getFromCache(fileKey)
  if (cached && cached.lastModified === lastModified) {
    return cached.blob
  }

  // 下载文件
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`)
  }

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0
  let loaded = 0
  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      if (total > 0 && onProgress) {
        onProgress(Math.round((loaded / total) * 100))
      }
    }
  }

  const blob = new Blob(chunks as BlobPart[])
  // 保存到通用缓存
  await Linkcccp_saveToCache(fileKey, blob, lastModified)
  return blob
}

// 清理封面 URL
export function revokeCBZCoverUrl(url: string) {
  URL.revokeObjectURL(url)
}
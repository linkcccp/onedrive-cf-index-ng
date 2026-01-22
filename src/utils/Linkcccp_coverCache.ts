/**
 * 封面图片缓存工具
 * 基于 IndexedDB 的通用缓存，优先从本地读取封面，减少网络请求
 */

import { Linkcccp_getFromCache, Linkcccp_saveToCache } from './Linkcccp_UniversalCache'

/**
 * 获取缓存的封面图片 URL
 * @param coverUrl 原始封面图片 URL（用于网络下载）
 * @param cacheKey 缓存键，建议唯一标识该封面
 * @param lastModified 最后修改时间，用于缓存验证
 * @returns 返回一个对象 URL（blob URL），使用后需要调用 revokeCachedCoverUrl 释放
 */
export async function getCachedCover(coverUrl: string, cacheKey: string, lastModified: string): Promise<string> {
  // 检查缓存
  const cached = await Linkcccp_getFromCache(cacheKey)
  if (cached && cached.lastModified === lastModified) {
    return URL.createObjectURL(cached.blob)
  }

  // 缓存未命中或已过期，下载图片
  const response = await fetch(coverUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch cover: ${response.status} ${response.statusText}`)
  }

  const blob = await response.blob()
  // 写入缓存
  await Linkcccp_saveToCache(cacheKey, blob, lastModified)
  return URL.createObjectURL(blob)
}

/**
 * 释放封面图片的 blob URL
 * @param url 由 getCachedCover 返回的 blob URL
 */
export function revokeCachedCoverUrl(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * 为书籍封面生成缓存键
 * @param filePath 文件路径（相对于根目录）
 * @param coverType 封面类型，用于区分不同来源
 * @returns 缓存键字符串
 */
export function generateCoverCacheKey(
  filePath: string,
  coverType: 'indexCover' | 'thumbnail' | 'cbzCover' | 'folderCover'
): string {
  return `cover-${coverType}-${filePath.replace(/\//g, '_')}`
}

/**
 * 获取书籍封面的缓存键和最后修改时间（简化版）
 * @param file 文件对象（OdFolderChildren）
 * @param coverType 封面类型
 * @param coverPath 封面文件路径（仅 indexCover 需要）
 * @returns 包含 cacheKey 和 lastModified 的对象
 */
export function getCoverCacheInfo(
  file: any,
  coverType: 'indexCover' | 'thumbnail' | 'cbzCover' | 'folderCover',
  coverPath?: string
): { cacheKey: string; lastModified: string } {
  // 使用文件 ID 或路径作为唯一标识
  const fileKey = file.id || file.path || file.name
  const cacheKey = generateCoverCacheKey(fileKey, coverType)
  // 使用文件的最后修改时间作为缓存验证依据
  const lastModified = file.lastModifiedDateTime || file.lastModified || Date.now().toString()
  return { cacheKey, lastModified }
}

/**
 * 预取封面图片，检查更新并下载到缓存（不返回 URL）
 * @param coverUrl 原始封面图片 URL
 * @param cacheKey 缓存键
 * @param lastModified 最后修改时间
 * @returns Promise<void>
 */
export async function prefetchCover(coverUrl: string, cacheKey: string, lastModified: string): Promise<void> {
  try {
    const blobUrl = await getCachedCover(coverUrl, cacheKey, lastModified)
    // 立即撤销 blob URL，因为我们不需要使用它
    revokeCachedCoverUrl(blobUrl)
  } catch (error) {
    // 静默失败
    console.warn('Prefetch cover failed:', error)
  }
}

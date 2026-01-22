/**
 * 封面相关工具函数
 * 统一处理封面 URL 的生成，避免代码重复
 */

import { getBaseUrl } from './getBaseUrl'
import type { OdFolderChildren } from '../types'
import type { BookMetadata } from '../components/Linkcccp_Sidebar'
import { prefetchCover, generateCoverCacheKey } from './Linkcccp_coverCache'

/**
 * 构建原始文件 URL
 * @param path 文件路径（相对根目录）
 * @param hashedToken 可选的访问令牌
 * @returns 完整的 /api/raw URL
 */
export function getRawUrl(path: string, hashedToken?: string | null): string {
  const tokenQuery = hashedToken ? `&odpt=${hashedToken}` : ''
  return `${getBaseUrl()}/api/raw?path=${encodeURIComponent(path)}${tokenQuery}`
}

/**
 * 构建缩略图 URL
 * @param path 文件路径（相对根目录）
 * @param hashedToken 可选的访问令牌
 * @param size 缩略图尺寸，默认为 'large'
 * @returns 完整的 /api/thumbnail URL
 */
export function getThumbnailUrl(
  path: string,
  hashedToken?: string | null,
  size: 'large' | 'medium' | 'small' = 'large'
): string {
  const tokenQuery = hashedToken ? `&odpt=${hashedToken}` : ''
  return `${getBaseUrl()}/api/thumbnail?path=${encodeURIComponent(path)}&size=${size}${tokenQuery}`
}

/**
 * 封面获取结果
 */
export interface CoverResult {
  /** 最终使用的封面 URL */
  url: string
  /** 封面来源类型 */
  type: 'indexCover' | 'thumbnail' | 'cbzCover' | 'default'
  /** 是否正在提取 CBZ 封面（仅当 type 为 'cbzCover' 时相关） */
  extracting?: boolean
}

/**
 * 获取书籍封面的最佳 URL
 * 优先级：index.json 封面 > CBZ 提取封面 > 缩略图
 * @param options 参数
 * @returns CoverResult
 */
export function getCoverUrl(options: {
  file: OdFolderChildren
  bookMeta?: BookMetadata
  path: string
  hashedToken?: string | null
}): CoverResult {
  const { file, bookMeta, path, hashedToken } = options
  const cleanPath = path.replace(/\/$/, '')
  const filePath = `${cleanPath}/${file.name}`

  // 1. 如果 index.json 提供了封面路径，优先使用
  if (bookMeta?.cover) {
    const coverPath = bookMeta.cover.startsWith('/') ? bookMeta.cover.slice(1) : bookMeta.cover
    return {
      url: getRawUrl(coverPath, hashedToken),
      type: 'indexCover',
    }
  }

  // 2. 如果是 CBZ 文件，标记为需要提取封面（前端组件负责实际提取）
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  if (fileExt === 'cbz') {
    // 返回一个占位 URL（空字符串），同时指示需要提取
    return {
      url: '', // 空 URL 会导致图片加载失败，显示占位符
      type: 'cbzCover',
      extracting: true,
    }
  }

  // 3. 默认使用占位符，不生成缩略图
  return {
    url: '', // 空 URL 会导致图片加载失败，显示占位符
    type: 'default',
  }
}

/**
 * 获取书籍文件夹的封面 URL（用于无限滚动列表）
 * 优先级：OPF 封面 > cover.jpg > 缩略图
 * @param folderPath 文件夹路径
 * @param hashedToken 可选的访问令牌
 * @param opfCoverPath 从 OPF 解析出的封面相对路径（可选）
 * @returns 封面 URL
 */
export function getFolderCoverUrl(folderPath: string, hashedToken?: string | null, opfCoverPath?: string): string {
  // 如果有 OPF 封面路径，使用之
  if (opfCoverPath) {
    const coverPath = `${folderPath}/${opfCoverPath}`
    return getRawUrl(coverPath, hashedToken)
  }

  // 尝试 cover.jpg
  const coverJpgPath = `${folderPath}/cover.jpg`
  // 注意：这里不检查文件是否存在，由调用方处理
  return getRawUrl(coverJpgPath, hashedToken)
}

/**
 * 批量预取封面，检查更新并下载到缓存
 * @param files 文件对象数组
 * @param path 当前路径
 * @param hashedToken 可选的访问令牌
 * @param bookMetadataMap 可选的书籍元数据映射
 * @returns Promise<void>
 */
export async function prefetchCovers(
  files: OdFolderChildren[],
  path: string,
  hashedToken?: string | null,
  bookMetadataMap?: Map<string, BookMetadata>
): Promise<void> {
  const cleanPath = path.replace(/\/$/, '')
  for (const file of files) {
    // 获取封面信息
    const coverResult = getCoverUrl({
      file,
      bookMeta: bookMetadataMap?.get(file.name),
      path: cleanPath,
      hashedToken,
    })
    // 跳过没有 URL 的封面（如 CBZ 或默认占位符）
    if (!coverResult.url || coverResult.type === 'cbzCover' || coverResult.type === 'default') {
      continue
    }
    // 生成缓存键和最后修改时间
    const cacheKey = generateCoverCacheKey(file.id || file.name, coverResult.type)
    const lastModified = file.lastModifiedDateTime || Date.now().toString()
    // 预取封面（静默失败）
    await prefetchCover(coverResult.url, cacheKey, lastModified)
  }
}

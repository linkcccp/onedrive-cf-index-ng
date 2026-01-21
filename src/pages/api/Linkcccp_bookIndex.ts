/**
 * Linkcccp_bookIndex API
 * 从 OneDrive 的 baseDirectory 下读取 index.json 元数据文件
 * 用于 Sidebar 筛选和书籍展示
 */
import { NextRequest, NextResponse } from 'next/server'
import siteConfig from '../../../config/site.config'
import { encodePath, getAccessToken } from './index'
import apiConfig from '../../../config/api.config'
import axios from 'redaxios'

export const runtime = 'edge'

// 书籍元数据类型
export interface BookMetadata {
  name: string
  size: number
  modified: number
  modified_iso: string
  type: string
  // 核心元数据字段
  title: string
  author: string
  series: string
  tags: string
  isbn: string
  created_date: string
  published_date: string
  publisher: string
  language: string
  // 可选字段
  description?: string
  pages?: number
  series_index?: string
  cover_id?: string
  error?: string
}

// 聚合后的元数据（用于 Sidebar 筛选选项）
export interface AggregatedMetadata {
  authors: { name: string; count: number }[]
  tags: { name: string; count: number }[]
  series: { name: string; count: number }[]
  languages: { name: string; count: number }[]
  publishers: { name: string; count: number }[]
  formats: { name: string; count: number }[]
}

// 完整响应类型
export interface BookIndexResponse {
  books: BookMetadata[]
  aggregated: AggregatedMetadata
  total: number
  lastModified?: string
}

/**
 * 聚合元数据，生成筛选选项
 */
function aggregateMetadata(books: BookMetadata[]): AggregatedMetadata {
  const authorsMap = new Map<string, number>()
  const tagsMap = new Map<string, number>()
  const seriesMap = new Map<string, number>()
  const languagesMap = new Map<string, number>()
  const publishersMap = new Map<string, number>()
  const formatsMap = new Map<string, number>()

  for (const book of books) {
    // 作者（可能有多个，用逗号或分号分隔）
    if (book.author) {
      const authors = book.author.split(/[,;、]/).map(a => a.trim()).filter(Boolean)
      for (const author of authors) {
        authorsMap.set(author, (authorsMap.get(author) || 0) + 1)
      }
    }

    // 标签（可能有多个）
    if (book.tags) {
      const tags = book.tags.split(/[,;、]/).map(t => t.trim()).filter(Boolean)
      for (const tag of tags) {
        tagsMap.set(tag, (tagsMap.get(tag) || 0) + 1)
      }
    }

    // 系列
    if (book.series) {
      seriesMap.set(book.series, (seriesMap.get(book.series) || 0) + 1)
    }

    // 语言
    if (book.language) {
      languagesMap.set(book.language, (languagesMap.get(book.language) || 0) + 1)
    }

    // 出版商
    if (book.publisher) {
      publishersMap.set(book.publisher, (publishersMap.get(book.publisher) || 0) + 1)
    }

    // 格式
    if (book.type) {
      const format = book.type.replace('.', '').toUpperCase()
      formatsMap.set(format, (formatsMap.get(format) || 0) + 1)
    }
  }

  // 转换为数组并排序（按数量降序）
  const mapToArray = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  return {
    authors: mapToArray(authorsMap),
    tags: mapToArray(tagsMap),
    series: mapToArray(seriesMap),
    languages: mapToArray(languagesMap),
    publishers: mapToArray(publishersMap),
    formats: mapToArray(formatsMap),
  }
}

export default async function handler(req: NextRequest): Promise<Response> {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No access token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 构建 index.json 的路径
    const indexPath = '/index.json'
    const requestUrl = `${apiConfig.driveApi}/root${encodePath(indexPath)}?select=@microsoft.graph.downloadUrl,lastModifiedDateTime`

    // 获取文件下载链接
    const metaResponse = await axios.get(requestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!metaResponse.data['@microsoft.graph.downloadUrl']) {
      return new Response(JSON.stringify({ error: 'index.json not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const downloadUrl = metaResponse.data['@microsoft.graph.downloadUrl']
    const lastModified = metaResponse.data['lastModifiedDateTime']

    // 下载 index.json 内容
    const contentResponse = await axios.get(downloadUrl)
    const books: BookMetadata[] = contentResponse.data

    // 聚合元数据
    const aggregated = aggregateMetadata(books)

    const response: BookIndexResponse = {
      books,
      aggregated,
      total: books.length,
      lastModified,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    console.error('Error fetching book index:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to fetch book index',
        status: error.status || 500,
      }),
      {
        status: error.status || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

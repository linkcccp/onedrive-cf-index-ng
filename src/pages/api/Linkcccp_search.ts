/**
 * Linkcccp_search API
 * 基于 index.json 的本地搜索功能
 * 支持分词搜索，搜索范围包括：书名、作者、系列、标签、文件名
 */
import { NextRequest, NextResponse } from 'next/server'
import siteConfig from '../../../config/site.config'
import { encodePath, getAccessToken } from './index'
import apiConfig from '../../../config/api.config'
import axios from 'redaxios'
import { BookMetadata } from './Linkcccp_bookIndex'

export const runtime = 'edge'

// 搜索结果类型
export interface SearchResult {
  id: string
  name: string
  path: string
  title: string
  author: string
  series: string
  tags: string
  type: string
  matchField: string // 匹配到的字段
  matchScore: number // 匹配得分，用于排序
}

/**
 * 分词函数
 * 将搜索词拆分为多个关键词
 * 支持空格、逗号分隔，也支持中文连续字符匹配
 */
function tokenize(query: string): string[] {
  // 转小写并去除首尾空格
  const normalized = query.toLowerCase().trim()
  
  // 按空格、逗号、分号分割
  const tokens = normalized.split(/[\s,;，；]+/).filter(t => t.length > 0)
  
  // 如果没有分隔符，直接返回整个查询作为一个 token
  if (tokens.length === 0) {
    return [normalized]
  }
  
  return tokens
}

/**
 * 计算匹配得分
 * @param text 被搜索的文本
 * @param tokens 搜索词列表
 * @returns 匹配得分（越高越好）
 */
function calculateMatchScore(text: string | undefined, tokens: string[]): number {
  if (!text) return 0
  
  const normalizedText = text.toLowerCase()
  let score = 0
  
  for (const token of tokens) {
    if (normalizedText.includes(token)) {
      // 基础匹配分
      score += 10
      
      // 完全匹配加分
      if (normalizedText === token) {
        score += 50
      }
      
      // 开头匹配加分
      if (normalizedText.startsWith(token)) {
        score += 20
      }
      
      // 匹配比例加分（token 占文本比例越大，分数越高）
      score += Math.floor((token.length / normalizedText.length) * 30)
    }
  }
  
  return score
}

/**
 * 搜索单本书籍
 * @returns 匹配结果，如果不匹配返回 null
 */
function searchBook(book: BookMetadata, tokens: string[]): SearchResult | null {
  // 计算各字段的匹配得分
  const titleScore = calculateMatchScore(book.title, tokens) * 3 // 标题权重最高
  const authorScore = calculateMatchScore(book.author, tokens) * 2 // 作者次之
  const seriesScore = calculateMatchScore(book.series, tokens) * 1.5
  const tagsScore = calculateMatchScore(book.tags, tokens)
  const nameScore = calculateMatchScore(book.name, tokens)
  
  // 总分
  const totalScore = titleScore + authorScore + seriesScore + tagsScore + nameScore
  
  // 没有匹配
  if (totalScore === 0) return null
  
  // 确定主要匹配字段
  let matchField = 'name'
  let maxFieldScore = nameScore
  
  if (titleScore > maxFieldScore) {
    matchField = 'title'
    maxFieldScore = titleScore
  }
  if (authorScore > maxFieldScore) {
    matchField = 'author'
    maxFieldScore = authorScore
  }
  if (seriesScore > maxFieldScore) {
    matchField = 'series'
    maxFieldScore = seriesScore
  }
  if (tagsScore > maxFieldScore) {
    matchField = 'tags'
  }
  
  // 构建文件路径（去掉扩展名作为目录路径）
  const fileNameWithoutExt = book.name.replace(/\.[^/.]+$/, '')
  const filePath = `/${encodeURIComponent(fileNameWithoutExt)}/${encodeURIComponent(book.name)}`
  
  return {
    id: book.name, // 使用文件名作为唯一 ID
    name: book.name,
    path: filePath,
    title: book.title || book.name,
    author: book.author || '',
    series: book.series || '',
    tags: book.tags || '',
    type: book.type || '',
    matchField,
    matchScore: totalScore,
  }
}

export default async function handler(req: NextRequest): Promise<Response> {
  // 获取搜索参数
  const { q: searchQuery = '' } = Object.fromEntries(req.nextUrl.searchParams)
  
  if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length === 0) {
    return NextResponse.json([])
  }
  
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No access token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // 获取 index.json
    const indexPath = '/index.json'
    const requestUrl = `${apiConfig.driveApi}/root${encodePath(indexPath)}?select=@microsoft.graph.downloadUrl`
    
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
    const contentResponse = await axios.get(downloadUrl)
    const books: BookMetadata[] = contentResponse.data
    
    // 分词
    const tokens = tokenize(searchQuery)
    
    // 搜索所有书籍
    const results: SearchResult[] = []
    for (const book of books) {
      const result = searchBook(book, tokens)
      if (result) {
        results.push(result)
      }
    }
    
    // 按匹配得分排序（降序）
    results.sort((a, b) => b.matchScore - a.matchScore)
    
    // 限制返回数量
    const limitedResults = results.slice(0, siteConfig.maxItems || 100)
    
    return new Response(JSON.stringify(limitedResults), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Search failed',
      }),
      {
        status: error.status || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

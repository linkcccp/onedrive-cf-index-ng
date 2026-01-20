/**
 * OPF 元数据解析器
 * 用于解析 Calibre 的 metadata.opf 文件
 */

export interface OPFMetadata {
  title?: string
  authors: string[]
  tags: string[]
  series?: string
  seriesIndex?: number
  language?: string
  publisher?: string
  identifiers: Record<string, string>
  date?: string
  coverPath?: string
}

/**
 * 解析 OPF XML 字符串，提取元数据
 */
export function parseOPF(xmlContent: string): OPFMetadata {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'application/xml')
  const errorNode = doc.querySelector('parsererror')
  if (errorNode) {
    throw new Error('Failed to parse OPF XML')
  }

  const metadata: OPFMetadata = {
    authors: [],
    tags: [],
    identifiers: {},
  }

  // 标题
  const titleElement = doc.querySelector('dc\\:title, title')
  if (titleElement) {
    metadata.title = titleElement.textContent?.trim()
  }

  // 作者
  const authorElements = doc.querySelectorAll('dc\\:creator, creator')
  authorElements.forEach(el => {
    const role = el.getAttribute('opf:role') || el.getAttribute('role')
    if (!role || role === 'aut' || role === 'author') {
      const author = el.textContent?.trim()
      if (author) metadata.authors.push(author)
    }
  })

  // 标签（主题）
  const subjectElements = doc.querySelectorAll('dc\\:subject, subject')
  subjectElements.forEach(el => {
    const tag = el.textContent?.trim()
    if (tag) metadata.tags.push(tag)
  })

  // 系列
  const seriesElement = doc.querySelector('meta[name="calibre:series"], meta[name="series"]')
  if (seriesElement) {
    metadata.series = seriesElement.getAttribute('content')?.trim()
  }

  // 系列索引
  const seriesIndexElement = doc.querySelector('meta[name="calibre:series_index"], meta[name="series_index"]')
  if (seriesIndexElement) {
    const index = parseFloat(seriesIndexElement.getAttribute('content') || '')
    if (!isNaN(index)) metadata.seriesIndex = index
  }

  // 语言
  const languageElement = doc.querySelector('dc\\:language, language')
  if (languageElement) {
    metadata.language = languageElement.textContent?.trim()
  }

  // 出版商
  const publisherElement = doc.querySelector('dc\\:publisher, publisher')
  if (publisherElement) {
    metadata.publisher = publisherElement.textContent?.trim()
  }

  // 标识符（如 ISBN）
  const identifierElements = doc.querySelectorAll('dc\\:identifier, identifier')
  identifierElements.forEach(el => {
    const scheme = el.getAttribute('opf:scheme') || el.getAttribute('scheme') || 'unknown'
    const value = el.textContent?.trim()
    if (value) metadata.identifiers[scheme] = value
  })

  // 日期
  const dateElement = doc.querySelector('dc\\:date, date')
  if (dateElement) {
    metadata.date = dateElement.textContent?.trim()
  }

  // 封面路径
  const coverItem = doc.querySelector('item[media-type="image/jpeg"][href*="cover"], item[media-type="image/png"][href*="cover"]')
  if (coverItem) {
    metadata.coverPath = coverItem.getAttribute('href')?.trim()
  }

  return metadata
}

/**
 * 从 OPF 文件 URL 获取并解析元数据
 */
export async function fetchOPFMetadata(opfUrl: string): Promise<OPFMetadata> {
  try {
    const response = await fetch(opfUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch OPF: ${response.status} ${response.statusText}`)
    }
    const xmlText = await response.text()
    return parseOPF(xmlText)
  } catch (error) {
    console.error('Error fetching OPF metadata:', error)
    throw error
  }
}

/**
 * 根据电子书文件路径推断 OPF 文件路径
 * 假设电子书文件夹中包含 metadata.opf 文件
 */
export function inferOPFPath(bookPath: string): string {
  const segments = bookPath.split('/')
  // 假设路径格式为 /作者/书名/电子书文件.epub
  // OPF 文件位于 /作者/书名/metadata.opf
  const bookFolder = segments.slice(0, -1).join('/')
  return `${bookFolder}/metadata.opf`
}
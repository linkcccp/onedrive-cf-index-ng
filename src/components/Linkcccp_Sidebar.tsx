/**
 * Linkcccp_Sidebar - 图书馆筛选侧边栏
 * 功能：从 index.json 读取元数据，提供 Calibre 风格的筛选功能
 * 特性：移动端默认收起，汉堡按钮控制显示
 */
import { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useSWR from 'swr'

// 筛选选项类型
export interface FilterOption {
  name: string
  count: number
}

// 聚合后的元数据
export interface AggregatedMetadata {
  authors: FilterOption[]
  tags: FilterOption[]
  series: FilterOption[]
  languages: FilterOption[]
  publishers: FilterOption[]
  formats: FilterOption[]
}

// 当前选中的筛选条件
export interface SidebarFilters {
  authors: string[]
  tags: string[]
  series: string[]
  languages: string[]
  publishers: string[]
  formats: string[]
}

// 书籍元数据类型（简化版，用于筛选匹配）
export interface BookMetadata {
  name: string
  title: string
  author: string
  series: string
  tags: string
  publisher: string
  language: string
  type: string
  cover?: string
}

interface Linkcccp_SidebarProps {
  onFilterChange?: (filters: SidebarFilters) => void
  isOpen: boolean
  onToggle: () => void
}

// API 数据获取器
const fetcher = (url: string) => fetch(url).then(res => res.json())

// 空筛选条件
const emptyFilters: SidebarFilters = {
  authors: [],
  tags: [],
  series: [],
  languages: [],
  publishers: [],
  formats: [],
}

const Linkcccp_Sidebar: React.FC<Linkcccp_SidebarProps> = ({ onFilterChange, isOpen, onToggle }) => {
  const [selectedFilters, setSelectedFilters] = useState<SidebarFilters>({ ...emptyFilters })
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    authors: true,
    tags: true,
    series: false,
    languages: false,
    publishers: false,
    formats: true,
  })

  // 从 API 获取元数据
  const { data, error, isLoading } = useSWR('/api/Linkcccp_bookIndex', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1分钟内不重复请求
  })

  const metadata: AggregatedMetadata = data?.aggregated || {
    authors: [],
    tags: [],
    series: [],
    languages: [],
    publishers: [],
    formats: [],
  }

  // 切换筛选项
  const handleFilterToggle = useCallback((category: keyof SidebarFilters, value: string) => {
    setSelectedFilters(prev => {
      const updated = { ...prev }
      const index = updated[category].indexOf(value)
      if (index >= 0) {
        updated[category] = updated[category].filter(v => v !== value)
      } else {
        updated[category] = [...updated[category], value]
      }
      return updated
    })
  }, [])

  // 当筛选条件变化时通知父组件
  useEffect(() => {
    onFilterChange?.(selectedFilters)
  }, [selectedFilters, onFilterChange])

  // 清除所有筛选
  const clearFilters = useCallback(() => {
    setSelectedFilters({ ...emptyFilters })
  }, [])

  // 切换分类展开/收起
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }))
  }, [])

  // 计算已选中的筛选数量
  const selectedCount = Object.values(selectedFilters).reduce((sum, arr) => sum + arr.length, 0)

  // 渲染筛选分类
  const renderCategory = (
    title: string,
    category: keyof SidebarFilters,
    items: FilterOption[],
    icon: string
  ) => {
    if (items.length === 0) return null
    const isExpanded = expandedCategories[category]
    const selectedInCategory = selectedFilters[category].length

    return (
      <div className="mb-4">
        <button
          className="group mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => toggleCategory(category)}
        >
          <span className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200">
            <FontAwesomeIcon icon={icon as any} className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
            {title}
            {selectedInCategory > 0 && (
              <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                {selectedInCategory}
              </span>
            )}
          </span>
          <FontAwesomeIcon
            icon="chevron-down"
            className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {isExpanded && (
          <ul className="ml-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {items.map(item => (
              <li key={item.name}>
                <button
                  className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-all duration-150 ${
                    selectedFilters[category].includes(item.name)
                      ? 'bg-blue-500 text-white dark:bg-blue-600'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleFilterToggle(category, item.name)}
                >
                  <FontAwesomeIcon
                    icon={selectedFilters[category].includes(item.name) ? 'check-square' : ['far', 'square']}
                    className="mr-2 h-3.5 w-3.5 flex-shrink-0"
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="ml-2 flex-shrink-0 text-xs opacity-60">({item.count})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // 侧边栏内容
  const sidebarContent = (
    <div className="flex h-full flex-col rounded-fluent-lg border border-fluent-border bg-fluent-surface-card shadow-fluent-sm dark:border-gray-700 dark:bg-gray-900">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-fluent-border p-4 dark:border-gray-700">
        <h2 className="flex items-center text-lg font-semibold text-gray-800 dark:text-gray-100">
          <FontAwesomeIcon icon="bars" className="mr-3 h-4 w-4 text-blue-500" />
          图书筛选
          {selectedCount > 0 && (
            <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
              {selectedCount}
            </span>
          )}
        </h2>
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          onClick={onToggle}
          title="关闭侧边栏"
        >
          <FontAwesomeIcon icon="times" className="h-5 w-5" />
        </button>
      </div>

      {/* 清除按钮 */}
      {selectedCount > 0 && (
        <div className="border-b border-fluent-border p-3 dark:border-gray-700">
          <button
            className="flex w-full items-center justify-center rounded-fluent-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
            onClick={clearFilters}
          >
            <FontAwesomeIcon icon="times-circle" className="mr-2 h-4 w-4" />
            清除所有筛选 ({selectedCount})
          </button>
        </div>
      )}

      {/* 筛选列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <FontAwesomeIcon icon="spinner" spin className="mb-2 h-6 w-6" />
            <span className="text-sm">加载元数据...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-red-500">
            <FontAwesomeIcon icon="exclamation-triangle" className="mb-2 h-6 w-6" />
            <span className="text-sm">加载失败</span>
            <span className="mt-1 text-xs text-gray-400">请确保 index.json 存在</span>
          </div>
        ) : (
          <>
            {renderCategory('格式', 'formats', metadata.formats, 'file')}
            {renderCategory('作者', 'authors', metadata.authors, 'user')}
            {renderCategory('标签', 'tags', metadata.tags, 'tags')}
            {renderCategory('丛书', 'series', metadata.series, 'book')}
            {renderCategory('语言', 'languages', metadata.languages, 'globe')}
            {renderCategory('出版商', 'publishers', metadata.publishers, 'building')}
          </>
        )}
      </div>

      {/* 底部统计 */}
      {data && (
        <div className="border-t border-gray-200 p-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          共 {data.total} 本书
          {data.lastModified && (
            <span className="ml-2">
              · 更新于 {new Date(data.lastModified).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* 移动端遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] bg-transparent transition-all duration-300 ease-in-out lg:static lg:z-0 lg:h-auto ${
          isOpen
            ? 'w-72 translate-x-0 opacity-100 lg:mr-6'
            : 'w-72 -translate-x-full opacity-0 lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:opacity-0'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}

export default Linkcccp_Sidebar

/**
 * 筛选书籍的工具函数
 * 使用 AND 逻辑：只有同时满足所有选中条件的书籍才会显示
 */
export function filterBooks(books: BookMetadata[], filters: SidebarFilters): BookMetadata[] {
  // 如果没有选中任何筛选条件，返回所有书籍
  const hasFilters = Object.values(filters).some(arr => arr.length > 0)
  if (!hasFilters) return books

  return books.filter(book => {
    // 检查作者（AND 逻辑：所有选中的作者都必须匹配）
    if (filters.authors.length > 0) {
      const bookAuthors = book.author?.split(/[,;、]/).map(a => a.trim()) || []
      const authorsMatch = filters.authors.every(author =>
        bookAuthors.some(ba => ba.includes(author) || author.includes(ba))
      )
      if (!authorsMatch) return false
    }

    // 检查标签
    if (filters.tags.length > 0) {
      const bookTags = book.tags?.split(/[,;、]/).map(t => t.trim()) || []
      const tagsMatch = filters.tags.every(tag =>
        bookTags.some(bt => bt.includes(tag) || tag.includes(bt))
      )
      if (!tagsMatch) return false
    }

    // 检查系列
    if (filters.series.length > 0) {
      if (!filters.series.includes(book.series)) return false
    }

    // 检查语言
    if (filters.languages.length > 0) {
      if (!filters.languages.includes(book.language)) return false
    }

    // 检查出版商
    if (filters.publishers.length > 0) {
      if (!filters.publishers.includes(book.publisher)) return false
    }

    // 检查格式
    if (filters.formats.length > 0) {
      const bookFormat = book.type?.replace('.', '').toUpperCase()
      if (!filters.formats.includes(bookFormat)) return false
    }

    return true
  })
}
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export interface Metadata {
  authors: string[]
  tags: string[]
  series: string[]
  languages: string[]
  publishers: string[]
  formats: string[]
}

export interface SidebarFilters {
  authors: string[]
  tags: string[]
  series: string[]
  languages: string[]
  publishers: string[]
  formats: string[]
}

interface Linkcccp_SidebarProps {
  onFilterChange?: (filters: SidebarFilters) => void
  currentPath?: string
}

const Linkcccp_Sidebar: React.FC<Linkcccp_SidebarProps> = ({ onFilterChange, currentPath = '/' }) => {
  const [metadata, setMetadata] = useState<Metadata>({
    authors: [],
    tags: [],
    series: [],
    languages: [],
    publishers: [],
    formats: [],
  })
  const [selectedFilters, setSelectedFilters] = useState<SidebarFilters>({
    authors: [],
    tags: [],
    series: [],
    languages: [],
    publishers: [],
    formats: [],
  })
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // 模拟加载元数据（后续替换为实际数据获取）
  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true)
      // TODO: 从 API 或本地存储获取元数据索引
      // 暂时使用模拟数据
      setTimeout(() => {
        setMetadata({
          authors: ['刘慈欣', 'J.K. Rowling', 'George Orwell'],
          tags: ['科幻', '奇幻', '反乌托邦', '经典'],
          series: ['三体', '哈利·波特', '1984'],
          languages: ['中文', '英语', '日语'],
          publishers: ['重庆出版社', 'Bloomsbury', 'Secker & Warburg'],
          formats: ['EPUB', 'PDF', 'CBZ'],
        })
        setLoading(false)
      }, 500)
    }
    fetchMetadata()
  }, [currentPath])

  const handleFilterToggle = (category: keyof SidebarFilters, value: string) => {
    const updated = { ...selectedFilters }
    const index = updated[category].indexOf(value)
    if (index >= 0) {
      updated[category].splice(index, 1)
    } else {
      updated[category].push(value)
    }
    setSelectedFilters(updated)
    onFilterChange?.(updated)
  }

  const clearFilters = () => {
    const cleared = {
      authors: [],
      tags: [],
      series: [],
      languages: [],
      publishers: [],
      formats: [],
    }
    setSelectedFilters(cleared)
    onFilterChange?.(cleared)
  }

  const renderCategory = (title: string, category: keyof SidebarFilters, items: string[]) => {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
       <div className="group mb-2 flex items-center">
         <h3 className="flex items-center text-sm font-semibold uppercase tracking-widest text-fluent-text-secondary group-hover:text-fluent-primary transition-colors duration-150 dark:text-gray-300 dark:group-hover:text-blue-300">
           <FontAwesomeIcon
             icon="chevron-right"
             className="mr-2 h-3 w-3 transition-transform duration-300 group-hover:rotate-90"
           />
           {title}
         </h3>
       </div>
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item}>
              <button
                className={`flex w-full items-center rounded-fluent-md px-2 py-1.5 text-left text-sm transition-all duration-150 active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800 ${
                  selectedFilters[category].includes(item)
                    ? 'bg-fluent-primary text-white dark:bg-blue-600'
                    : 'text-fluent-text-secondary hover:bg-fluent-surface-panel'
                }`}
                onClick={() => handleFilterToggle(category, item)}
              >
                <FontAwesomeIcon
                  icon={selectedFilters[category].includes(item) ? 'check-square' : 'square'}
                  className="mr-2 h-3 w-3 transition-transform duration-150"
                />
                <span className="truncate">{item}</span>
                <span className="ml-auto text-xs opacity-70">({Math.floor(Math.random() * 20) + 1})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (collapsed) {
    return (
      <div className="sticky top-16 h-screen w-12 border-r border-fluent-border shadow-fluent-sm p-2 fluent-acrylic dark:border-gray-700">
        <button
          className="flex h-10 w-full items-center justify-center rounded-fluent-md hover:bg-fluent-surface-panel active:scale-95 transition-transform duration-150 dark:hover:bg-gray-800"
          onClick={() => setCollapsed(false)}
          title="展开侧边栏"
        >
          <FontAwesomeIcon icon="chevron-right" />
        </button>
      </div>
    )
  }

  return (
    <div className="sticky top-16 h-screen w-64 flex-shrink-0 overflow-y-auto border-r border-fluent-border bg-fluent-surface-card shadow-fluent-sm p-4 animate-fluent-enter dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fluent-text-primary dark:text-gray-100">图书馆侧边栏</h2>
        <button
          className="rounded-fluent-md p-1 hover:bg-fluent-surface-panel active:scale-95 transition-all duration-150 dark:hover:bg-gray-800"
          onClick={() => setCollapsed(true)}
          title="折叠侧边栏"
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>
      </div>

      <div className="mb-4">
        <button
          className="fluent-btn-secondary w-full text-sm dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
          onClick={clearFilters}
          disabled={
            Object.values(selectedFilters).every(arr => arr.length === 0)
          }
        >
          <FontAwesomeIcon icon="times-circle" className="mr-2" />
          清除所有筛选
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <FontAwesomeIcon icon="spinner" spin className="text-fluent-text-tertiary dark:text-gray-400" />
          <span className="ml-2 text-sm text-fluent-text-secondary dark:text-gray-300">加载元数据...</span>
        </div>
      ) : (
        <>
          {renderCategory('作者', 'authors', metadata.authors)}
          {renderCategory('标签', 'tags', metadata.tags)}
          {renderCategory('丛书', 'series', metadata.series)}
          {renderCategory('语言', 'languages', metadata.languages)}
          {renderCategory('出版商', 'publishers', metadata.publishers)}
          {renderCategory('格式', 'formats', metadata.formats)}
        </>
      )}

      <div className="mt-8 text-xs text-fluent-text-tertiary dark:text-gray-500">
        <p>提示：点击分类项进行筛选，可多选。</p>
      </div>
    </div>
  )
}

export default Linkcccp_Sidebar
import axios from 'axios'
import { Dispatch, Fragment, SetStateAction, useState } from 'react'
import AwesomeDebouncePromise from 'awesome-debounce-promise'
import { useAsync } from 'react-async-hook'
import useConstant from 'use-constant'

import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Dialog, Transition } from '@headlessui/react'

import { LoadingIcon } from './Loading'
import { getFileIcon } from '../utils/getFileIcon'

// index.json 搜索结果类型
interface IndexSearchResult {
  id: string
  name: string
  path: string
  title: string
  author: string
  series: string
  tags: string
  type: string
  matchField: string
  matchScore: number
}

/**
 * Implements a debounced search function that searches index.json data
 * 支持分词搜索，搜索书名、作者、系列、标签等字段
 *
 * @returns A react hook for a debounced async search
 */
function useIndexSearch() {
  const [query, setQuery] = useState('')
  
  const searchIndex = async (q: string): Promise<IndexSearchResult[]> => {
    const { data } = await axios.get<IndexSearchResult[]>(`/api/Linkcccp_search?q=${encodeURIComponent(q)}`)
    return data
  }

  const debouncedSearch = useConstant(() => AwesomeDebouncePromise(searchIndex, 500))
  
  const results = useAsync(async () => {
    if (query.length === 0) {
      return []
    } else {
      return debouncedSearch(query)
    }
  }, [query])

  return {
    query,
    setQuery,
    results,
  }
}

/**
 * 获取匹配字段的中文显示名
 */
function getMatchFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: '书名',
    author: '作者',
    series: '系列',
    tags: '标签',
    name: '文件名',
  }
  return labels[field] || field
}

/**
 * 搜索结果项组件 - 用于 index.json 搜索结果
 */
function IndexSearchResultItem({ result }: { result: IndexSearchResult }) {
  return (
    <Link
      href={result.path}
      passHref
      className="flex items-center space-x-4 border-b border-gray-400/30 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer"
    >
      <FontAwesomeIcon 
        icon={getFileIcon(result.name)} 
        className="h-5 w-5 flex-shrink-0 text-gray-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-6 truncate">
          {result.title || result.name}
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          {result.author && (
            <span className="truncate max-w-[150px]">{result.author}</span>
          )}
          {result.series && (
            <>
              <span>·</span>
              <span className="truncate max-w-[100px]">{result.series}</span>
            </>
          )}
          <span>·</span>
          <span className="text-blue-500 dark:text-blue-400 flex-shrink-0">
            匹配: {getMatchFieldLabel(result.matchField)}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-400 uppercase flex-shrink-0">
        {result.type?.replace('.', '')}
      </span>
    </Link>
  )
}

export default function SearchModal({
  searchOpen,
  setSearchOpen,
}: {
  searchOpen: boolean
  setSearchOpen: Dispatch<SetStateAction<boolean>>
}) {
  const { query, setQuery, results } = useIndexSearch()

  const closeSearchBox = () => {
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <Transition appear show={searchOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[200] overflow-y-auto" onClose={closeSearchBox}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-100"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-white/80 dark:bg-gray-800/80" />
          </Transition.Child>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="my-12 inline-block w-full max-w-3xl transform overflow-hidden rounded border border-gray-400/30 text-left shadow-xl transition-all">
              <Dialog.Title
                as="h3"
                className="flex items-center space-x-4 border-b border-gray-400/30 bg-gray-50 p-4 dark:bg-gray-800 dark:text-white"
              >
                <FontAwesomeIcon icon="search" className="h-4 w-4" />
                <input
                  type="text"
                  id="search-box"
                  className="w-full bg-transparent focus:outline-none focus-visible:outline-none"
                  placeholder={'搜索书名、作者、系列、标签...'}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <div className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-medium dark:bg-gray-700">ESC</div>
              </Dialog.Title>
              <div
                className="max-h-[80vh] overflow-x-hidden overflow-y-scroll bg-white dark:bg-gray-900 dark:text-white"
                onClick={closeSearchBox}
              >
                {results.loading && (
                  <div className="px-4 py-12 text-center text-sm font-medium">
                    <LoadingIcon className="svg-inline--fa mr-2 inline-block h-4 w-4 animate-spin" />
                    <span>{'搜索中...'}</span>
                  </div>
                )}
                {results.error && (
                  <div className="px-4 py-12 text-center text-sm font-medium text-red-500">
                    {results.error.message?.includes('index.json') 
                      ? '未找到 index.json，请先生成索引文件'
                      : `搜索出错: ${results.error.message}`
                    }
                  </div>
                )}
                {results.result && (
                  <>
                    {results.result.length === 0 ? (
                      <div className="px-4 py-12 text-center text-sm font-medium text-gray-500">
                        {query.length > 0 ? '没有找到匹配的结果' : '输入关键词开始搜索'}
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-400/30">
                          找到 {results.result.length} 个结果
                        </div>
                        {results.result.map(result => (
                          <IndexSearchResultItem key={result.id} result={result} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

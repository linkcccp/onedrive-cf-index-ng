import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExpand, faCompress, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'

import toast from 'react-hot-toast'
import { PreviewContainer } from './Containers'
import DownloadButtonGroup from '../DownloadBtnGtoup'
import { OdFileObject } from '../../types'
import { getStoredToken } from '../../utils/protectedRouteHandler'

// 定义图片状态接口
interface Linkcccp_CBZImage {
    name: string
    url?: string
    loading: boolean
    error: boolean
    entry: any // zip.js 的 Entry 对象
}

const Linkcccp_CBZPreview: React.FC<{
    file: OdFileObject
}> = ({ file }) => {
    const { asPath } = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [images, setImages] = useState<Linkcccp_CBZImage[]>([])
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const zipReaderRef = useRef<any>(null)
    const imageRefsRef = useRef<(HTMLDivElement | null)[]>([])

    const [currentPageIndex, setCurrentPageIndex] = useState(0)
    const [isUserDragging, setIsUserDragging] = useState(false)

    // 自然排序函数
    const naturalSort = (a: string, b: string): number => {
        return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base',
            ignorePunctuation: true
        })
    }

    // 检查文件是否为图片
    const isImageFile = (filename: string): boolean => {
        const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|svg)$/i
        return imageExtensions.test(filename)
    }

    // --- 进度记忆逻辑 ---
    const getStorageKey = () => `cbz-progress-${file.id || file['@microsoft.graph.downloadUrl']}`

    const saveProgress = (scrollTop: number) => {
        try {
            localStorage.setItem(getStorageKey(), scrollTop.toString())
        } catch (error) {
            console.warn('Failed to save CBZ progress:', error)
        }
    }

    const loadProgress = (): number => {
        try {
            const saved = localStorage.getItem(getStorageKey())
            return saved ? parseFloat(saved) : 0
        } catch (error) {
            return 0
        }
    }

    // --- 加载单页图片逻辑 ---
    const loadPageImage = useCallback(async (index: number) => {
        setImages(current => {
            if (current[index] && !current[index].url && !current[index].loading) {
                const nextImages = [...current]
                nextImages[index] = { ...nextImages[index], loading: true }

                // 异步执行加载，不阻塞状态返回
                import('@zip.js/zip.js').then(async (zip) => {
                    try {
                        const entry = nextImages[index].entry
                        const blob = await entry.getData(new zip.BlobWriter())
                        const url = URL.createObjectURL(blob)

                        setImages(latest => {
                            const updated = [...latest]
                            if (updated[index]) {
                                updated[index] = { ...updated[index], url, loading: false, error: false }
                            }
                            return updated
                        })
                    } catch (err) {
                        console.error(`Page ${index} extraction error:`, err)
                        setImages(latest => {
                            const updated = [...latest]
                            if (updated[index]) {
                                updated[index] = { ...updated[index], loading: false, error: true }
                            }
                            return updated
                        })
                    }
                })
                return nextImages
            }
            return current
        })
    }, [])

    // --- 内存清理逻辑 ---
    const cleanupOffscreenImages = useCallback((currentIndex: number) => {
        setImages(prev => {
            let changed = false
            const newImages = prev.map((img, idx) => {
                // 设置更宽松的缓存范围（前后 15 页），避免频繁重复加载
                if (img.url && Math.abs(idx - currentIndex) > 15) {
                    URL.revokeObjectURL(img.url)
                    changed = true
                    return { ...img, url: undefined, loading: false }
                }
                return img
            })
            return changed ? newImages : prev
        })
    }, [])

    // --- 初始化 Zip 资源 ---
    useEffect(() => {
        const initZip = async () => {
            try {
                setIsLoading(true)
                setError('')

                const zip = await import('@zip.js/zip.js')
                const hashedToken = getStoredToken(asPath)
                const requestUrl = `/api/raw/?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`

                // 【核心优化】预取真实直链。Range: bytes=0-0 确保不下载文件内容，只为拿到最终 URL
                const prefetch = await fetch(requestUrl, { headers: { 'Range': 'bytes=0-0' } })
                if (!prefetch.ok && prefetch.status !== 206) {
                    throw new Error(`无法连接网盘: ${prefetch.statusText}`)
                }
                const directUrl = prefetch.url

                // 使用直链直接访问微软服务器，极致提升速度
                const reader = new zip.HttpReader(directUrl, { useRangeHeader: true })
                const zipReader = new zip.ZipReader(reader)
                zipReaderRef.current = zipReader

                const entries = await zipReader.getEntries()
                const imageEntries = entries
                    .filter(e => !e.directory && isImageFile(e.filename))
                    .sort((a, b) => naturalSort(a.filename, b.filename))

                if (imageEntries.length === 0) {
                    throw new Error('此压缩包中未找到漫画图片')
                }

                setImages(imageEntries.map(entry => ({
                    name: entry.filename,
                    entry: entry,
                    loading: false,
                    error: false
                })))

                setIsLoading(false)
            } catch (err: any) {
                console.error('CBZ Init Error:', err)
                setError(err.message || '初始化失败，请检查网络')
                setIsLoading(false)
            }
        }

        initZip()

        return () => {
            if (zipReaderRef.current) zipReaderRef.current.close()
            images.forEach(img => img.url && URL.revokeObjectURL(img.url))
        }
    }, [asPath])

    // --- Intersection Observer (控制进入视口加载) ---
    useEffect(() => {
        if (isLoading || images.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.getAttribute('data-index') || '0')
                        loadPageImage(index)
                    }
                })
            },
            {
                root: containerRef.current,
                rootMargin: '1200px 0px' // 缓冲加载：在用户滚动到之前 1200px 就开始加载
            }
        )

        imageRefsRef.current.forEach(el => el && observer.observe(el))
        return () => observer.disconnect()
    }, [isLoading, images.length, loadPageImage])

    // --- 滚动与滚动条同步 ---
    useEffect(() => {
        const container = containerRef.current
        if (!container || images.length === 0) return

        const handleScroll = () => {
            saveProgress(container.scrollTop)
            if (!isUserDragging) {
                const scrollHeight = container.scrollHeight - container.clientHeight
                const ratio = scrollHeight > 0 ? container.scrollTop / scrollHeight : 0
                const index = Math.min(Math.floor(ratio * images.length), images.length - 1)

                if (index !== currentPageIndex) {
                    setCurrentPageIndex(index)
                    // 每当翻页时，尝试清理一次远处图片的内存
                    cleanupOffscreenImages(index)
                }
            }
        }
        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [images, isUserDragging, currentPageIndex, cleanupOffscreenImages])

    // 恢复历史进度
    useEffect(() => {
        if (!isLoading && images.length > 0 && containerRef.current) {
            const savedPosition = loadProgress()
            if (savedPosition > 0) {
                setTimeout(() => {
                    containerRef.current?.scrollTo({
                        top: savedPosition,
                        behavior: 'auto'
                    })
                }, 300)
            }
        }
    }, [isLoading])

    // 全屏切换监控
    useEffect(() => {
        const handleFs = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', handleFs)
        return () => document.removeEventListener('fullscreenchange', handleFs)
    }, [])

    const toggleFullscreen = () => {
        if (!isFullscreen) containerRef.current?.requestFullscreen?.()
        else document.exitFullscreen?.()
    }

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value)
        setCurrentPageIndex(val)
        const target = imageRefsRef.current[val]
        if (target && containerRef.current) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' })
            loadPageImage(val)
        }
    }

    if (isLoading) {
        return (
            <PreviewContainer>
                <div className="flex flex-col items-center justify-center p-20 text-gray-500">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-4 text-blue-500" />
                    <p className="font-bold">开启秒读优化模式...</p>
                    <p className="text-xs mt-2 opacity-60">仅从 OneDrive 读取文件索引，无需全量下载</p>
                </div>
            </PreviewContainer>
        )
    }

    if (error) {
        return (
            <PreviewContainer>
                <div className="flex flex-col items-center justify-center p-16 text-red-500">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-4" />
                    <p className="font-semibold">无法预览此漫画</p>
                    <p className="text-sm mt-2">{error}</p>
                    <div className="mt-8">
                        <DownloadButtonGroup />
                    </div>
                </div>
            </PreviewContainer>
        )
    }

    return (
        <PreviewContainer>
            {/* 顶栏栏 */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b dark:border-gray-800 z-10 relative">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <h3 className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-sm">
                        {file.name}
                    </h3>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500">
                        {images.length}P
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title={isFullscreen ? '退出全屏' : '全屏预览'}
                    >
                        <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
                    </button>
                    <DownloadButtonGroup />
                </div>
            </div>

            {/* 阅读区域 */}
            <div
                ref={containerRef}
                className={`overflow-y-auto scroll-smooth relative ${isFullscreen
                    ? 'h-screen bg-black'
                    : 'h-[65vh] md:h-[75vh] bg-gray-50 dark:bg-[#0f0f0f]'
                    }`}
            >
                <div className="flex flex-col items-center pb-20">
                    {images.map((img, idx) => (
                        <div
                            key={img.name}
                            data-index={idx}
                            ref={el => {
                                imageRefsRef.current[idx] = el
                            }}
                            className="w-full flex flex-col items-center relative min-h-[500px] justify-center border-b border-transparent"
                        >
                            {img.url ? (
                                <img
                                    src={img.url}
                                    alt={`Page ${idx + 1}`}
                                    className="max-w-full h-auto selection:bg-transparent"
                                />
                            ) : (
                                <div className="flex flex-col items-center text-gray-400 py-40">
                                    <FontAwesomeIcon icon={faSpinner} spin className="mb-2 opacity-50" />
                                    <span className="text-xs font-mono tracking-widest uppercase opacity-40">Loading Page {idx + 1}</span>
                                </div>
                            )}
                            {img.error && <p className="text-red-500 text-xs py-10">❌ 加载此页失败</p>}
                        </div>
                    ))}
                </div>

                {/* 底部信息 */}
                <div className="py-20 text-center text-gray-400 dark:text-gray-600 italic">
                    <p>— THE END —</p>
                </div>

                {/* 悬浮进度控制（仅全屏显示） */}
                {isFullscreen && (
                    <div className="fixed bottom-0 left-0 right-0 bg-black/70 backdrop-blur-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-4 z-50">
                        <input
                            type="range"
                            min="0"
                            max={images.length - 1}
                            value={currentPageIndex}
                            onMouseDown={() => setIsUserDragging(true)}
                            onMouseUp={() => setIsUserDragging(false)}
                            onChange={handleSliderChange}
                            className="flex-1 h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-white"
                        />
                        <div className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold shadow-xl border border-white/20">
                            {currentPageIndex + 1} / {images.length}
                        </div>
                    </div>
                )}
            </div>
        </PreviewContainer>
    )
}

export default Linkcccp_CBZPreview

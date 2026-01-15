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
    const zipModuleRef = useRef<any>(null) // 缓存 zip 模块防止重复导入
    const zipReaderRef = useRef<any>(null)
    const imageRefsRef = useRef<(HTMLDivElement | null)[]>([])

    const [currentPageIndex, setCurrentPageIndex] = useState(0)
    const [isUserDragging, setIsUserDragging] = useState(false)

    // 自然排序函数
    const naturalSort = (a: string, b: string): number => {
        return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base',
            ignorePunctuation: true,
        })
    }

    // 检查文件是否为图片 (增加对常见漫画格式的支持)
    const isImageFile = (filename: string): boolean => {
        const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i
        return imageExtensions.test(filename)
    }

    // --- 进度记忆逻辑 ---
    const getStorageKey = () => `cbz-progress-${file.id || file['@microsoft.graph.downloadUrl']}`

    const saveProgress = useCallback(
        (scrollTop: number) => {
            try {
                localStorage.setItem(getStorageKey(), scrollTop.toString())
            } catch (error) { }
        },
        [file.id]
    )

    const loadProgress = useCallback((): number => {
        try {
            const saved = localStorage.getItem(getStorageKey())
            return saved ? parseFloat(saved) : 0
        } catch (error) {
            return 0
        }
    }, [file.id])

    // --- 加载单页图片逻辑 ---
    const loadPageImage = useCallback(async (index: number) => {
        setImages(current => {
            if (current[index] && !current[index].url && !current[index].loading) {
                const nextImages = [...current]
                nextImages[index] = { ...nextImages[index], loading: true }

                const processExtraction = async () => {
                    try {
                        // 确保使用缓存的模块
                        const zip = zipModuleRef.current || (await import('@zip.js/zip.js'))
                        zipModuleRef.current = zip

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
                }

                processExtraction()
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
                const distance = Math.abs(idx - currentIndex)
                if (img.url && distance > 20) {
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
                zipModuleRef.current = zip
                zip.configure({ useWebWorkers: true })

                const hashedToken = getStoredToken(asPath)
                const requestUrl = `/api/raw/?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`

                // 探测直链
                const prefetch = await fetch(requestUrl, {
                    method: 'GET',
                    headers: { Range: 'bytes=0-0' },
                })

                if (!prefetch.ok && prefetch.status !== 206) {
                    throw new Error(`无法连接网盘: ${prefetch.status}`)
                }
                const directUrl = prefetch.url

                const reader = new zip.HttpReader(directUrl, {
                    useRangeHeader: true,
                    preventHeadRequest: true,
                })

                const zipReader = new zip.ZipReader(reader, { checkSignature: false })
                zipReaderRef.current = zipReader

                const entries = await zipReader.getEntries()
                const imageEntries = entries
                    .filter(e => !e.directory && isImageFile(e.filename))
                    .sort((a, b) => naturalSort(a.filename, b.filename))

                if (imageEntries.length === 0) throw new Error('未找到图片')

                setImages(
                    imageEntries.map(entry => ({
                        name: entry.filename,
                        entry: entry,
                        loading: false,
                        error: false,
                    }))
                )
                setIsLoading(false)
            } catch (err: any) {
                console.error('CBZ Init Error:', err)
                setError(err.message || '索引失败')
                setIsLoading(false)
            }
        }

        initZip()

        return () => {
            if (zipReaderRef.current) zipReaderRef.current.close()
            images.forEach(img => img.url && URL.revokeObjectURL(img.url))
        }
    }, [asPath])

    // --- 交互与滚动监听 ---
    useEffect(() => {
        if (isLoading || images.length === 0) return

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.getAttribute('data-index') || '0')
                        loadPageImage(index)
                    }
                })
            },
            { root: containerRef.current, rootMargin: '1200px 0px' }
        )

        imageRefsRef.current.forEach(el => el && observer.observe(el))
        return () => observer.disconnect()
    }, [isLoading, images.length, loadPageImage])

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
                    cleanupOffscreenImages(index)
                }
            }
        }
        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [images, isUserDragging, currentPageIndex, cleanupOffscreenImages, saveProgress])

    // 恢复进度
    useEffect(() => {
        if (!isLoading && images.length > 0 && containerRef.current) {
            const pos = loadProgress()
            if (pos > 0) setTimeout(() => containerRef.current?.scrollTo({ top: pos }), 300)
        }
    }, [isLoading, loadProgress, images.length])

    const toggleFullscreen = () => {
        if (!isFullscreen) containerRef.current?.requestFullscreen?.()
        else document.exitFullscreen?.()
    }

    useEffect(() => {
        const fn = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', fn)
        return () => document.removeEventListener('fullscreenchange', fn)
    }, [])

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
                    <FontAwesomeIcon icon={faSpinner} spin className="mb-4 text-3xl text-blue-500" />
                    <p className="font-bold">秒开技术优化中...</p>
                </div>
            </PreviewContainer>
        )
    }

    if (error) {
        return (
            <PreviewContainer>
                <div className="flex flex-col items-center justify-center p-16 text-red-500">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="mb-4 text-3xl" />
                    <p>{error}</p>
                    <div className="mt-8">
                        <DownloadButtonGroup />
                    </div>
                </div>
            </PreviewContainer>
        )
    }

    return (
        <PreviewContainer>
            <div className="flex items-center justify-between border-b bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center space-x-3 truncate">
                    <h3 className="max-w-sm truncate font-medium">{file.name}</h3>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{images.length}P</span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={toggleFullscreen}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
                    </button>
                    <DownloadButtonGroup />
                </div>
            </div>

            <div
                ref={containerRef}
                className={`relative overflow-y-auto scroll-smooth ${isFullscreen ? 'h-screen bg-black' : 'h-[65vh] md:h-[75vh] bg-gray-50 dark:bg-[#0f0f0f]'
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
                            className="relative flex min-h-[500px] w-full flex-col items-center justify-center"
                        >
                            {img.url ? (
                                <img src={img.url} alt={`Page ${idx + 1}`} className="h-auto max-w-full" />
                            ) : (
                                <div className="flex flex-col items-center py-40 text-gray-400">
                                    <FontAwesomeIcon icon={faSpinner} spin className="mb-2 opacity-50" />
                                    <span className="text-xs opacity-40">Loading {idx + 1}...</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {isFullscreen && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-4 bg-black/70 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
                        <input
                            type="range"
                            min="0"
                            max={images.length - 1}
                            value={currentPageIndex}
                            onMouseDown={() => setIsUserDragging(true)}
                            onMouseUp={() => setIsUserDragging(false)}
                            onChange={handleSliderChange}
                            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-600 accent-white"
                        />
                        <div className="rounded-full border border-white/20 bg-white px-4 py-1.5 text-sm font-bold text-black shadow-xl">
                            {currentPageIndex + 1} / {images.length}
                        </div>
                    </div>
                )}
            </div>
        </PreviewContainer>
    )
}

export default Linkcccp_CBZPreview
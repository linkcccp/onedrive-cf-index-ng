import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExpand, faCompress, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'

import toast from 'react-hot-toast'
import { PreviewContainer } from './Containers'
import DownloadButtonGroup from '../DownloadBtnGtoup'
import { OdFileObject } from '../../types'
import { getStoredToken } from '../../utils/protectedRouteHandler'
import { Linkcccp_getFromCache, Linkcccp_saveToCache } from '../../utils/Linkcccp_UniversalCache'

// 定义图片状态接口
interface Linkcccp_CBZImage {
    name: string
    url?: string
    loading: boolean
    error: boolean
    entry: any // zip.js 的 Entry 对象
}

// 子组件：单张图片项，由 memo 包裹防止父列表频繁刷新导致的卡顿
const Linkcccp_ImageItem = memo(({ img, index }: { img: Linkcccp_CBZImage; index: number }) => {
    return (
        <div
            data-index={index}
            className={`relative w-full overflow-hidden ${!img.url ? 'flex min-h-[500px] items-center justify-center' : ''}`}
        >
            {img.url ? (
                <img
                    src={img.url}
                    alt={`Page ${index + 1}`}
                    className="block h-auto w-full max-w-full"
                    decoding="async"
                />
            ) : (
                <div className="flex flex-col items-center py-40 text-gray-400">
                    {img.error ? (
                        <>
                            <FontAwesomeIcon icon={faExclamationTriangle} className="mb-2 text-orange-400" />
                            <span className="text-xs">加载失败 {index + 1}</span>
                        </>
                    ) : (
                        <>
                            <FontAwesomeIcon icon={faSpinner} spin className="mb-2 opacity-30" />
                            <span className="text-xs opacity-40">加载中 {index + 1}...</span>
                        </>
                    )}
                </div>
            )}
        </div>
    )
})
Linkcccp_ImageItem.displayName = 'Linkcccp_ImageItem'

const Linkcccp_CBZPreview: React.FC<{
    file: OdFileObject
}> = ({ file }) => {
    const { asPath } = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [downloadProgress, setDownloadProgress] = useState(0) // 下载进度 0-100
    const [error, setError] = useState<string>('')
    const [images, setImages] = useState<Linkcccp_CBZImage[]>([])
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const zipModuleRef = useRef<any>(null)
    const zipReaderRef = useRef<any>(null)
    const imageRefsRef = useRef<Map<number, HTMLDivElement>>(new Map())

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

    // 检查文件是否为图片
    const isImageFile = (filename: string): boolean => {
        const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i
        return imageExtensions.test(filename)
    }

    // --- 进度记忆逻辑 ---
    const getStorageKey = useCallback(() => `cbz-progress-${file.id || file.name}`, [file.id, file.name])

    const saveProgress = useCallback(
        (scrollTop: number) => {
            try {
                localStorage.setItem(getStorageKey(), scrollTop.toString())
            } catch (error) { }
        },
        [getStorageKey]
    )

    const loadProgress = useCallback((): number => {
        try {
            const saved = localStorage.getItem(getStorageKey())
            return saved ? parseFloat(saved) : 0
        } catch (error) {
            return 0
        }
    }, [getStorageKey])

    // --- 加载单页图片逻辑 (现在直接从内存解压，极快) ---
    const loadPageImage = useCallback(async (index: number) => {
        setImages(prev => {
            const img = prev[index]
            if (!img || img.url || img.loading) return prev

            const performExtraction = async () => {
                try {
                    const zip = zipModuleRef.current
                    const blob = await img.entry.getData(new zip.BlobWriter(), { checkSignature: false })
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

            performExtraction()
            const updated = [...prev]
            updated[index] = { ...updated[index], loading: true }
            return updated
        })
    }, [])

    // --- 内存清理逻辑 (已根据用户需求放松限制：不再主动销毁已加载的图片，除非内存极度紧张) ---
    const cleanupOffscreenImages = useCallback((currentIndex: number) => {
        // 用户要求“不清理内容”以便前后查看。
        // 我们不再执行 URL.revokeObjectURL，让图片留在内存中实现瞬间翻页。
    }, [])

    // --- 初始化 Zip 资源 (带本地持久化缓存，不重复执行下载) ---
    useEffect(() => {
        let active = true

        const initZip = async () => {
            try {
                setIsLoading(true)
                setError('')
                setDownloadProgress(0)

                const fileKey = file.id || asPath
                const cached = await Linkcccp_getFromCache(fileKey)
                let fullBlob: Blob

                if (cached && cached.lastModified === file.lastModifiedDateTime) {
                    // 命中本地缓存：直接使用已有的 Blob，不消耗任何流量
                    fullBlob = cached.blob
                    setDownloadProgress(100)
                } else {
                    // 没中缓存：执行整包下载
                    const zip = await import('@zip.js/zip.js')
                    if (!active) return
                    zipModuleRef.current = zip
                    zip.configure({ useWebWorkers: true })

                    const hashedToken = getStoredToken(asPath)
                    const requestUrl = `/api/raw?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`
                    const prefetch = await fetch(requestUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } })
                    if (!prefetch.ok && prefetch.status !== 206) throw new Error(`无法连接网盘: ${prefetch.status}`)
                    const directUrl = prefetch.url

                    const response = await fetch(directUrl)
                    if (!response.ok) throw new Error('文件下载失败')

                    const contentLength = response.headers.get('content-length')
                    const total = contentLength ? parseInt(contentLength, 10) : 0
                    let loaded = 0

                    const reader = response.body!.getReader()
                    const chunks: Uint8Array[] = []

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        if (value) {
                            chunks.push(value)
                            loaded += value.length
                            if (total > 0) {
                                setDownloadProgress(Math.round((loaded / total) * 100))
                            }
                        }
                    }

                    if (!active) return
                    fullBlob = new Blob(chunks as BlobPart[])
                    // 保存到本地持久化存储 (IndexedDB)
                    await Linkcccp_saveToCache(fileKey, fullBlob, file.lastModifiedDateTime || '')
                }

                // 从 Blob 构建 ZipReader
                const zip = zipModuleRef.current || (await import('@zip.js/zip.js'))
                zipModuleRef.current = zip
                const zipReader = new zip.ZipReader(new zip.BlobReader(fullBlob))
                zipReaderRef.current = zipReader

                const entries = await zipReader.getEntries()
                if (!active) return

                const imageEntries = entries
                    .filter(e => !e.directory && isImageFile(e.filename))
                    .sort((a, b) => naturalSort(a.filename, b.filename))

                if (imageEntries.length === 0) throw new Error('未找到图片文件')

                setImages(imageEntries.map(entry => ({
                    name: entry.filename,
                    entry: entry,
                    loading: false,
                    error: false,
                })))

                setIsLoading(false)
            } catch (err: any) {
                if (!active) return
                console.error('CBZ Persistent Load Error:', err)
                setError(err.message || '加载失败')
                setIsLoading(false)
            }
        }

        initZip()

        return () => {
            active = false
            if (zipReaderRef.current) zipReaderRef.current.close()
            setImages(prev => {
                prev.forEach(img => img.url && URL.revokeObjectURL(img.url))
                return []
            })
        }
    }, [asPath, file.id, file.lastModifiedDateTime])

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
            {
                root: containerRef.current,
                // 适当扩大预加载范围，配合并发控制队列，可以更平滑地后台加载
                rootMargin: '1200px 0px',
            }
        )

        imageRefsRef.current.forEach(el => el && observer.observe(el))
        return () => observer.disconnect()
    }, [isLoading, images.length, loadPageImage])

    // 滚动同步与进度记忆
    useEffect(() => {
        const container = containerRef.current
        if (!container || images.length === 0) return

        const handleScroll = () => {
            saveProgress(container.scrollTop)

            const scrollHeight = container.scrollHeight - container.clientHeight
            const ratio = scrollHeight > 0 ? container.scrollTop / scrollHeight : 0
            const index = Math.min(Math.floor(ratio * images.length), images.length - 1)

            if (index !== currentPageIndex) {
                setCurrentPageIndex(index)
                cleanupOffscreenImages(index)
            }
        }
        container.addEventListener('scroll', handleScroll, { passive: true })
        return () => container.removeEventListener('scroll', handleScroll)
    }, [images.length, isUserDragging, currentPageIndex, cleanupOffscreenImages, saveProgress])

    // 恢复进度
    useEffect(() => {
        if (!isLoading && images.length > 0 && containerRef.current) {
            const pos = loadProgress()
            if (pos > 0) {
                setTimeout(() => {
                    if (containerRef.current) {
                        containerRef.current.scrollTop = pos
                    }
                }, 300)
            }
        }
    }, [isLoading, images.length, loadProgress])

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
        cleanupOffscreenImages(val) // 联动清理内存
        const target = imageRefsRef.current.get(val)
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
                    <p className="mb-2 font-bold text-lg">极致流畅模式：正在预载整包资源...</p>
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                        ></div>
                    </div>
                    <p className="mt-2 text-sm opacity-60">已缓冲 {downloadProgress}%</p>
                    <p className="mt-6 text-xs text-gray-400">下载完成后，翻页将如丝般顺滑</p>
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
                                if (el) imageRefsRef.current.set(idx, el)
                                else imageRefsRef.current.delete(idx)
                            }}
                            className="w-full max-w-4xl"
                        >
                            <Linkcccp_ImageItem img={img} index={idx} />
                        </div>
                    ))}
                </div>

                {/* 悬浮进度条 (仅全屏或特殊模式展示) */}
                {(isFullscreen || images.length > 50) && (
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
                        <div className="rounded-full border border-white/20 bg-white px-4 py-1.5 text-sm font-bold text-black shadow-xl min-w-[80px] text-center">
                            {currentPageIndex + 1} / {images.length}
                        </div>
                    </div>
                )}
            </div>
        </PreviewContainer>
    )
}

export default Linkcccp_CBZPreview
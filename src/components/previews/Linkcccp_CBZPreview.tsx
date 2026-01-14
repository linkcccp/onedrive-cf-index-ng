import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExpand, faCompress, faSpinner } from '@fortawesome/free-solid-svg-icons'

import toast from 'react-hot-toast'
import { DownloadBtnContainer, PreviewContainer } from './Containers'
import DownloadButtonGroup from '../DownloadBtnGtoup'
import { OdFileObject } from '../../types'
import { getStoredToken } from '../../utils/protectedRouteHandler'

const Linkcccp_CBZPreview: React.FC<{
    file: OdFileObject
}> = ({ file }) => {
    const { asPath } = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [images, setImages] = useState<{ name: string; url: string; blob: Blob }[]>([])
    const [isFullscreen, setIsFullscreen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [showProgressBar, setShowProgressBar] = useState(false)
    const progressBarTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isDraggingRef = useRef(false)

    // 自然排序函数
    const naturalSort = (a: string, b: string): number => {
        return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base',
            ignorePunctuation: true
        })
    }

    // 阅读进度记忆
    const getStorageKey = () => `cbz-progress-${file.id || file['@microsoft.graph.downloadUrl']}`

    const saveProgress = (scrollTop: number) => {
        try {
            localStorage.setItem(getStorageKey(), scrollTop.toString())
        } catch (error) {
            console.warn('Failed to save CBZ reading progress:', error)
        }
    }

    const loadProgress = (): number => {
        try {
            const saved = localStorage.getItem(getStorageKey())
            return saved ? parseFloat(saved) : 0
        } catch (error) {
            console.warn('Failed to load CBZ reading progress:', error)
            return 0
        }
    }

    // 检查文件是否为图片
    const isImageFile = (filename: string): boolean => {
        const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|svg)$/i
        return imageExtensions.test(filename)
    }

    // 处理全屏切换
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            if (containerRef.current?.requestFullscreen) {
                containerRef.current.requestFullscreen()
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
    }

    // 自动隐藏进度条
    const autoHideProgressBar = () => {
        if (progressBarTimeoutRef.current) {
            clearTimeout(progressBarTimeoutRef.current)
        }
        progressBarTimeoutRef.current = setTimeout(() => {
            if (!isDraggingRef.current) {
                setShowProgressBar(false)
            }
        }, 3000)
    }

    // 处理全屏区域点击显示进度条
    const handleFullscreenContainerClick = () => {
        if (isFullscreen) {
            setShowProgressBar(!showProgressBar)
            autoHideProgressBar()
        }
    }

    // 处理进度条拖动
    const handleProgressBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newIndex = parseInt(e.target.value, 10)
        if (containerRef.current && images.length > 0) {
            // 计算滚动位置（每张图片的高度大约为容器的某个比例）
            const scrollTop = (newIndex / images.length) * containerRef.current.scrollHeight
            containerRef.current.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
            })
        }
    }

    // 进度条拖动开始
    const handleProgressBarMouseDown = () => {
        isDraggingRef.current = true
    }

    // 进度条拖动结束
    const handleProgressBarMouseUp = () => {
        isDraggingRef.current = false
        autoHideProgressBar()
    }

    // 监听全屏状态变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
        }
    }, [])

    // 监听滚动并保存进度
    useEffect(() => {
        const container = containerRef.current
        if (!container || images.length === 0) return

        let saveTimeout: NodeJS.Timeout

        const handleScroll = () => {
            clearTimeout(saveTimeout)
            saveTimeout = setTimeout(() => {
                saveProgress(container.scrollTop)
            }, 500)

            // 计算当前页码
            if (isFullscreen && images.length > 0) {
                const scrollPercentage = container.scrollTop / (container.scrollHeight - container.clientHeight)
                const currentPageIndex = Math.round(scrollPercentage * (images.length - 1))
                // 这里可以用来更新进度条显示，但进度条已经通过 scrollTop 计算
            }
        }

        container.addEventListener('scroll', handleScroll)

        return () => {
            container.removeEventListener('scroll', handleScroll)
            clearTimeout(saveTimeout)
        }
    }, [images, isFullscreen])

    // 恢复阅读进度
    useEffect(() => {
        if (images.length > 0 && containerRef.current) {
            const savedPosition = loadProgress()
            if (savedPosition > 0) {
                setTimeout(() => {
                    containerRef.current?.scrollTo({
                        top: savedPosition,
                        behavior: 'smooth'
                    })
                }, 100)
            }
        }
    }, [images])

    // 加载并解析 CBZ 文件
    useEffect(() => {
        const loadCBZ = async () => {
            try {
                setIsLoading(true)
                setError('')

                // 通过项目 API 获取文件内容（与其他预览组件一致的方式）
                const hashedToken = getStoredToken(asPath)
                const requestUrl = `/api/raw/?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`

                // 下载文件
                const response = await fetch(requestUrl)
                if (!response.ok) {
                    throw new Error(`下载失败: ${response.statusText}`)
                }

                const arrayBuffer = await response.arrayBuffer()

                // 动态导入 JSZip
                const JSZipModule = await import('jszip')
                const zip = new JSZipModule.default()

                // 解压文件
                const zipContent = await zip.loadAsync(arrayBuffer)

                // 获取所有图片文件
                const imageFiles = Object.keys(zipContent.files)
                    .filter(filename => !zipContent.files[filename].dir && isImageFile(filename))
                    .sort(naturalSort)

                if (imageFiles.length === 0) {
                    throw new Error('CBZ 文件中未找到图片')
                }

                setProgress({ current: 0, total: imageFiles.length })

                // 解压并创建图片 URL
                const imagePromises = imageFiles.map(async (filename, index) => {
                    const file = zipContent.files[filename]
                    const blob = await file.async('blob')
                    const url = URL.createObjectURL(blob)

                    setProgress(prev => ({ ...prev, current: index + 1 }))

                    return { name: filename, url, blob }
                })

                const imageList = await Promise.all(imagePromises)
                setImages(imageList)

            } catch (error) {
                console.error('CBZ loading error:', error)
                setError(error instanceof Error ? error.message : '加载 CBZ 文件时发生未知错误')
                toast.error('加载 CBZ 文件失败')
            } finally {
                setIsLoading(false)
            }
        }

        loadCBZ()

        // 清理函数：释放 Blob URLs
        return () => {
            images.forEach(img => {
                URL.revokeObjectURL(img.url)
            })
        }
    }, [asPath])

    if (isLoading) {
        return (
            <PreviewContainer>
                <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-4" />
                        <p>加载漫画中...</p>
                        {progress.total > 0 && (
                            <p className="text-sm mt-2">
                                {progress.current} / {progress.total} 图片
                            </p>
                        )}
                    </div>
                </div>
            </PreviewContainer>
        )
    }

    if (error) {
        return (
            <PreviewContainer>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center text-red-500">
                        <p className="text-lg font-semibold mb-2">加载失败</p>
                        <p className="text-sm">{error}</p>
                        <DownloadBtnContainer>
                            <DownloadButtonGroup />
                        </DownloadBtnContainer>
                    </div>
                </div>
            </PreviewContainer>
        )
    }

    return (
        <PreviewContainer>
            {/* 工具栏 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <div className="flex items-center space-x-4">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {file.name}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {images.length} 页
                    </span>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        title={isFullscreen ? '退出全屏' : '全屏'}
                    >
                        <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
                    </button>
                    <DownloadButtonGroup />
                </div>
            </div>

            {/* 漫画阅读区域 - 长条模式 */}
            <div
                ref={containerRef}
                className={`overflow-y-auto ${isFullscreen
                    ? 'h-screen bg-black relative cursor-pointer'
                    : 'h-96 md:h-[32rem] lg:h-[40rem] bg-white dark:bg-gray-900'
                    }`}
                onClick={handleFullscreenContainerClick}
            >
                <div className="flex flex-col items-center space-y-0">
                    {images.map((image, index) => (
                        <div
                            key={image.name}
                            className="w-full flex flex-col items-center relative"
                        >
                            <img
                                src={image.url}
                                alt={`Page ${index + 1}`}
                                className="max-w-full h-auto"
                                loading={index < 3 ? 'eager' : 'lazy'}
                                onError={(e) => {
                                    console.error(`Failed to load image: ${image.name}`)
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* 全屏模式下的进度条 */}
                {isFullscreen && showProgressBar && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-4 flex items-center gap-4 z-50">
                        <span className="text-white text-sm min-w-fit">
                            {Math.round((containerRef.current?.scrollTop || 0) / ((containerRef.current?.scrollHeight || 1) - (containerRef.current?.clientHeight || 1)) * (images.length - 1)) + 1} / {images.length}
                        </span>
                        <input
                            type="range"
                            min="0"
                            max={Math.max(0, images.length - 1)}
                            value={Math.round((containerRef.current?.scrollTop || 0) / ((containerRef.current?.scrollHeight || 1) - (containerRef.current?.clientHeight || 1)) * (images.length - 1))}
                            onChange={handleProgressBarChange}
                            onMouseDown={handleProgressBarMouseDown}
                            onMouseUp={handleProgressBarMouseUp}
                            onTouchStart={handleProgressBarMouseDown}
                            onTouchEnd={handleProgressBarMouseUp}
                            className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                )}

                {/* 阅读完成提示 */}
                <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                    <p>📖 阅读完成</p>
                    <p className="text-sm mt-2">
                        阅读进度已自动保存
                    </p>
                </div>
            </div>
        </PreviewContainer>
    )
}
export default Linkcccp_CBZPreview

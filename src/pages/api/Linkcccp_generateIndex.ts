import { posix as pathPosix } from 'path-browserify'
import axios from 'redaxios'
import apiConfig from '../../../config/api.config'
import siteConfig from '../../../config/site.config'
import { getAccessToken, encodePath } from './index'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * 树形结构节点类型
 */
interface IndexNode {
    name: string
    path: string
    isFolder: boolean
    children?: IndexNode[]
}

/**
 * 递归获取所有文件和文件夹
 * 支持分页处理、特殊字符转义、完整的错误处理
 * 
 * @param accessToken OneDrive API access token
 * @param currentPath 当前相对于 baseDirectory 的路径
 * @param oneDrivePath OneDrive API 中的编码路径
 * @returns 树形结构数组
 */
async function fetchAllItems(
    accessToken: string,
    currentPath: string,
    oneDrivePath: string
): Promise<IndexNode[]> {
    const items: IndexNode[] = []

    try {
        // 获取当前文件夹的所有子项
        const requestUrl = `${apiConfig.driveApi}/root${oneDrivePath ? `:${oneDrivePath}` : ''}:/children`

        let nextLink: string | null = requestUrl
        const maxRetries = 3
        let retryCount = 0

        // 处理分页：必须循环检查 @odata.nextLink，直到获取当前目录下的所有文件
        while (nextLink) {
            try {
                let requestConfig: any = {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }

                // 第一次请求需要添加参数，后续请求使用 nextLink URL 已包含的参数
                if (nextLink === requestUrl) {
                    requestConfig.params = {
                        select: 'name,id,folder,file',
                        $top: 200,
                    }
                }

                const response = await axios.get(nextLink, requestConfig)
                const folderData = response.data

                // 验证响应数据结构
                if (!folderData.value || !Array.isArray(folderData.value)) {
                    console.warn(`Warning: Empty or malformed folder data at ${currentPath}`)
                    break
                }

                // 处理每个子项
                for (const item of folderData.value) {
                    try {
                        // 使用 item.name 作为文件名（OneDrive API 已处理转义）
                        const itemRelativePath = pathPosix.join(currentPath, item.name)
                        // 计算完整的 OneDrive 路径用于下一次递归
                        const itemOneDrivePath = pathPosix.join(oneDrivePath, item.name)

                        const node: IndexNode = {
                            name: item.name,
                            path: itemRelativePath,
                            isFolder: 'folder' in item,
                        }

                        // 如果是文件夹，递归获取子项
                        if ('folder' in item) {
                            node.children = await fetchAllItems(accessToken, itemRelativePath, itemOneDrivePath)
                        }

                        items.push(node)
                    } catch (itemError) {
                        console.error(`Error processing item ${item.name}:`, itemError)
                        // 继续处理其他项
                        continue
                    }
                }

                // 检查是否有下一页 - 这是关键的分页处理
                if (folderData['@odata.nextLink']) {
                    nextLink = folderData['@odata.nextLink']
                    retryCount = 0 // 重置重试计数
                } else {
                    nextLink = null // 没有下一页，退出循环
                }
            } catch (pageError: any) {
                // 处理分页请求的错误
                if (pageError?.response?.status === 429 || pageError?.response?.status === 503) {
                    // 速率限制或服务不可用，重试
                    if (retryCount < maxRetries) {
                        retryCount++
                        console.warn(`Rate limited or unavailable, retrying (${retryCount}/${maxRetries})...`)
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)) // 指数退避
                        continue
                    }
                }
                throw pageError
            }
        }

        // 按名称排序（文件夹优先）
        items.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1
            }
            // 使用基础的 localeCompare 而不指定区域设置，确保 Edge Runtime 兼容
            try {
                return a.name.localeCompare(b.name, undefined, { numeric: true })
            } catch {
                // 如果 localeCompare 失败，使用简单的字符串比较
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
            }
        })

        return items
    } catch (error: any) {
        console.error(`Error fetching items from ${currentPath}:`, error?.message ?? error)
        return []
    }
}
/**
 * 对文件名进行 Markdown 安全转义
 * 防止特殊符号（如 #, %, &, *, [, ], (, ), !, |）破坏 Markdown 语法
 * 
 * @param filename 原始文件名
 * @returns 转义后的文件名
 */
function escapeMarkdownSpecialChars(filename: string): string {
    // 转义 Markdown 特殊字符
    return filename
        .replace(/\\/g, '\\\\') // 反斜杠
        .replace(/\*/g, '\\*')   // 星号（粗体/斜体）
        .replace(/\[/g, '\\[')   // 左方括号（链接）
        .replace(/\]/g, '\\]')   // 右方括号（链接）
        .replace(/\(/g, '\\(')   // 左圆括号（链接）
        .replace(/\)/g, '\\)')   // 右圆括号（链接）
        .replace(/!/g, '\\!')    // 感叹号（图片）
        .replace(/#/g, '\\#')    // 井号（标题）
        .replace(/\|/g, '\\|')   // 管道符（表格）
        .replace(/`/g, '\\`')    // 反引号（代码）
        .replace(/~/g, '\\~')    // 波浪号（删除线）
}

/**
 * 对 URL 路径进行完整编码
 * 处理中文路径和特殊符号，确保浏览器可以正确解析
 * 
 * @param path 文件相对路径
 * @returns 可用于 URL 的编码路径
 */
function encodeUrlPath(path: string): string {
    // 使用 encodeURIComponent 编码整个路径，然后保留 / 分隔符
    return path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/')
}

/**
 * 将树形结构转换为 Markdown 格式
 * 处理特殊符号、确保链接正确编码
 * 
 * @param items 树形结构数组
 * @param depth 当前深度（用于缩进）
 * @returns Markdown 字符串
 */
function convertToMarkdown(items: IndexNode[], depth: number = 0): string {
    const indent = '  '.repeat(depth)
    let markdown = ''

    for (const item of items) {
        try {
            // 编码处理：文件名路径必须经过 encodeURIComponent 处理
            const encodedPath = encodeUrlPath(item.path)

            // Markdown 安全转义：特殊符号不会导致语法崩溃
            const escapedName = escapeMarkdownSpecialChars(item.name)

            const icon = item.isFolder ? '📁' : '📄'

            if (item.isFolder) {
                // 文件夹用粗体加链接
                markdown += `${indent}- ${icon} **[${escapedName}](/${encodedPath})**\n`
                if (item.children && item.children.length > 0) {
                    markdown += convertToMarkdown(item.children, depth + 1)
                }
            } else {
                // 文件用普通链接
                markdown += `${indent}- ${icon} [${escapedName}](/${encodedPath})\n`
            }
        } catch (error) {
            console.error(`Error converting item to markdown: ${item.name}`, error)
            // 降级处理：直接显示文件名而不是链接
            const icon = item.isFolder ? '📁' : '📄'
            const escapedName = escapeMarkdownSpecialChars(item.name)
            markdown += `${indent}- ${icon} ${escapedName}\n`
            continue
        }
    }

    return markdown
}

/**
 * 递归统计树中的节点总数
 */
function countItems(items: IndexNode[]): number {
    let count = items.length
    for (const item of items) {
        if (item.children && item.children.length > 0) {
            count += countItems(item.children)
        }
    }
    return count
}

/**
 * 生成完整的 index.md 内容
 * @param items 树形结构数组
 * @param generatedTime 生成时间
 * @returns 完整的 Markdown 内容
 */
function generateIndexContent(items: IndexNode[], generatedTime: string): string {
    const baseDir = siteConfig.baseDirectory || '/'
    const totalItems = countItems(items)

    // 转义 baseDir 中的特殊字符以防万一
    const escapedBaseDir = escapeMarkdownSpecialChars(baseDir)

    const title = `# 📚 OneDrive 文件索引`
    const subtitle = `**基目录**: \`${escapedBaseDir}\` | **总文件数**: ${totalItems}`
    const timestamp = `**生成时间**: ${generatedTime}`
    const note =
        '> 💡 **使用 Ctrl + F 搜索** 来快速查找文件（支持中文搜索，克服 OneDrive 原生搜索的不足）\n\n> ⚠️ 本索引为静态快照，如有新增/删除文件，请点击导航栏"Index"按钮重新生成。'
    const separator = '\n---\n\n'

    const content = convertToMarkdown(items)

    return `${title}\n\n${subtitle}\n\n${timestamp}\n\n${note}${separator}${content}`
}

/**
 * 将 index.md 上传到 OneDrive 根目录
 * 支持重试和完整的错误处理
 * 
 * @param accessToken OneDrive API access token
 * @param content 文件内容
 */
async function uploadIndexFile(accessToken: string, content: string): Promise<void> {
    const indexFileName = 'index.md'
    // 修复上传 URL 格式：必须使用 :/ 分隔符来指定路径
    // 如果 apiConfig.driveApi 类似于 .../drive，则路径应为 .../drive/root:/index.md:/content
    const uploadUrl = `${apiConfig.driveApi}/root:/${indexFileName}:/content`
    const maxRetries = 3
    let lastError: any
    let lastResponse: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Upload Attempt ${attempt}/${maxRetries}] Uploading index.md to: ${uploadUrl}`)
            console.log(`[Upload Attempt ${attempt}/${maxRetries}] Content size: ${new TextEncoder().encode(content).length} bytes`)

            const resp = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'text/markdown; charset=utf-8',
                },
                body: content,
            })

            const respText = await resp.text()
            let respData: any = undefined
            try {
                respData = respText ? JSON.parse(respText) : undefined
            } catch (e) {
                respData = respText
            }

            if (!resp.ok) {
                lastResponse = {
                    status: resp.status,
                    statusText: resp.statusText,
                    headers: Object.fromEntries(resp.headers.entries()),
                    data: respData,
                }

                const serverMessage = respData?.error?.message || respData?.message || String(respData)
                throw new Error(`OneDrive upload failed: ${resp.status} ${resp.statusText} - ${serverMessage}`)
            }

            console.log(`✅ Successfully uploaded index.md to OneDrive root (attempt ${attempt})`)
            return
        } catch (error: any) {
            lastError = error
            // 如果 lastResponse 已在非 2xx 情况下设置，则保留；否则尝试从 error.response 取值（兼容 axios 风格）
            lastResponse = lastResponse ?? error?.response ?? null

            const status = lastResponse?.status ?? error?.status
            const statusText = lastResponse?.statusText ?? error?.statusText
            const errorData = lastResponse?.data ?? error?.response?.data

            const errorMsg =
                errorData?.error?.message ||
                errorData?.message ||
                errorData ||
                statusText ||
                error?.message ||
                'Unknown error'

            console.error(`❌ Upload failed (attempt ${attempt}/${maxRetries}):`, {
                status,
                statusText,
                errorMessage: errorMsg,
                fullErrorData: JSON.stringify(errorData, null, 2),
                errorStack: error?.stack,
            })

            if (status === 429 || status === 503) {
                if (attempt < maxRetries) {
                    const waitTime = 1000 * Math.pow(2, attempt - 1)
                    console.warn(`⚠️ ${status} - Retrying in ${waitTime}ms...`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    continue
                }
            } else if (status === 401 || status === 403) {
                throw new Error(`Authentication failed (${status}): ${errorMsg}`)
            }

            if (attempt < maxRetries) {
                const waitTime = 1000 * Math.pow(2, attempt - 1)
                console.warn(`⚠️ Retrying in ${waitTime}ms...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
                continue
            }
        }
    }

    // 所有重试都失败，生成详细错误消息
    console.error(`❌ Failed to upload index.md after ${maxRetries} attempts`)
    console.error('Last error details:', {
        response: lastResponse ? {
            status: lastResponse.status,
            statusText: lastResponse.statusText,
            headers: lastResponse.headers,
            data: lastResponse.data,
        } : null,
        message: lastError?.message,
        code: lastError?.code,
        stack: lastError?.stack,
    })

    // 构建详细的错误消息
    let errorMessage = 'Unknown error'
    if (lastResponse?.data?.error?.message) {
        errorMessage = lastResponse.data.error.message
    } else if (lastResponse?.data?.['odata.error']?.message) {
        errorMessage = lastResponse.data['odata.error'].message
    } else if (lastResponse?.data?.message) {
        errorMessage = lastResponse.data.message
    } else if (lastResponse?.statusText) {
        errorMessage = `${lastResponse.status} ${lastResponse.statusText}`
    } else if (lastError?.message) {
        errorMessage = lastError.message
    } else if (lastError?.code) {
        errorMessage = `Error code: ${lastError.code}`
    }

    throw new Error(`Failed to upload index.md to OneDrive: ${errorMessage}`)
}

/**
 * 主处理函数
 */
export default async function handler(req: NextRequest): Promise<Response> {
    // 只允许 GET 请求
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const startTime = Date.now()

    try {
        console.log('🚀 Starting index generation...')


        // 权限检查：确保只有管理员可以触发
        // 如果你在 site.config.js 中配置了 protectedRoutes，我们可以在这里添加检查
        // 或者使用更简单的保护：需要在 headers 中提供特殊的 Secret Key
        // 为了简单且安全，我们检查请求是否包含有效的 API Key（如果配置了 CLOUDFLARE_API_KEY）
        // 或者简单地检查是否为本地开发环境

        // [安全增强] 检查管理访问密钥
        // 你需要在 Cloudflare Pages 的设置 -> Environment Variables 中添加变量：
        // LINKCCCP_ACCESS_KEY = 你的密码
        // 如果未设置环境变量，默认密码为 '123456' (强烈建议修改)
        const serverAccessKey = process.env.LINKCCCP_ACCESS_KEY || '123456'
        const clientAccessKey = req.headers.get('x-linkcccp-access-key')

        if (clientAccessKey !== serverAccessKey) {
            return new Response(JSON.stringify({ error: 'Invalid access key' }), { status: 403 })
        }

        // 获取 access token
        const accessToken = await getAccessToken()

        // 如果无法获取 token（未认证），则拒绝
        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'No access token available - Unauthorized' }), { status: 401 })
        }

        // [安全增强] 添加一个简单的 Referer 检查，确保请求来自本站点
        const referer = req.headers.get('referer')
        const host = req.headers.get('host')
        if (process.env.NODE_ENV === 'production' && referer && host && !referer.includes(host)) {
            return new Response(JSON.stringify({ error: 'Unauthorized source' }), { status: 403 })
        }

        // 获取基目录的编码路径
        const basePath = pathPosix.resolve('/', siteConfig.baseDirectory || '/')
        console.log(`📂 Base directory: ${basePath}`)

        // 递归获取所有文件和文件夹
        console.log('⏳ Fetching all items from OneDrive...')
        const allItems = await fetchAllItems(accessToken, '', basePath === '/' ? '' : basePath)

        const totalItems = countItems(allItems)
        const topLevelItems = allItems.length

        console.log(`✅ Fetched ${topLevelItems} top-level items, ${totalItems} total items recursively`)

        // 验证是否获取到任何项
        if (totalItems === 0) {
            console.warn('⚠️ Warning: No items found in the specified directory')
        }

        // 生成 Markdown 内容
        const now = new Date()
        // 使用更兼容的时间格式化方式（避免 toLocaleString 在 Edge Runtime 的问题）
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')
        const generatedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

        console.log('📝 Generating Markdown content...')
        const indexContent = generateIndexContent(allItems, generatedTime)

        // 计算内容大小（使用 TextEncoder 而不是 Buffer，确保 Edge Runtime 兼容）
        const encoder = new TextEncoder()
        const contentSize = encoder.encode(indexContent).length
        console.log(`📄 Generated index.md (${contentSize} bytes)`)

        // 上传到 OneDrive
        console.log('📤 Uploading index.md to OneDrive...')
        await uploadIndexFile(accessToken, indexContent)

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`✨ Index generation completed in ${duration}s`)

        return NextResponse.json({
            success: true,
            message: 'Index generated and uploaded successfully',
            itemsCount: totalItems,
            topLevelItems,
            contentSize,
            generatedTime,
            duration: `${duration}s`,
        })
    } catch (error: any) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)

        // 详细的错误日志
        console.error(`❌ Error in generateIndex (${duration}s):`)
        console.error('Error message:', error?.message)
        console.error('Error toString:', error?.toString())
        console.error('Error type:', typeof error)
        console.error('Error keys:', error ? Object.keys(error) : 'null')
        console.error('Full error:', JSON.stringify(error, null, 2))
        console.error('Error stack:', error?.stack)

        // 更好的错误信息构建
        let errorMessage = 'Internal server error'
        let errorDetails: any = {}
        let statusCode = 500

        // 优先级顺序提取错误信息
        if (error?.message) {
            errorMessage = error.message
        } else if (typeof error === 'string') {
            errorMessage = error
        }

        // 提取 API 响应的错误详情
        if (error?.response?.data) {
            errorDetails.apiError = error.response.data
            if (error.response.status) {
                statusCode = error.response.status
            }
        } else if (error?.response?.status) {
            statusCode = error.response.status
        }

        // 如果有堆栈跟踪，也包含在响应中以供调试
        if (process.env.NODE_ENV === 'development') {
            errorDetails.stack = error?.stack
        }

        return new Response(
            JSON.stringify({
                error: errorMessage,
                ...(!Object.keys(errorDetails).length ? {} : { details: errorDetails }),
                duration: `${duration}s`,
            }),
            {
                status: statusCode,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            }
        )
    }
}

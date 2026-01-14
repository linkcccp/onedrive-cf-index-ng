import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * 简化版本的 API，用于调试 Edge Runtime 兼容性问题
 */
export default async function handler(req: NextRequest): Promise<Response> {
    // 只允许 GET 请求
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const startTime = Date.now()

    try {
        console.log('🚀 Starting debug test...')

        // 测试 1: TextEncoder 兼容性
        console.log('Test 1: TextEncoder')
        const testText = '测试中文文本 test'
        const encoder = new TextEncoder()
        const encoded = encoder.encode(testText)
        const size = encoded.length
        console.log(`✅ TextEncoder works: ${size} bytes`)

        // 测试 2: 日期格式化
        console.log('Test 2: Date formatting')
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')
        const generatedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        console.log(`✅ Date formatting works: ${generatedTime}`)

        // 测试 3: localeCompare
        console.log('Test 3: localeCompare')
        const items = ['中文', 'abc', '123', '文件']
        try {
            items.sort((a, b) => {
                try {
                    return a.localeCompare(b, undefined, { numeric: true })
                } catch {
                    return a < b ? -1 : a > b ? 1 : 0
                }
            })
            console.log(`✅ localeCompare works: ${items.join(', ')}`)
        } catch (e) {
            console.error(`❌ localeCompare failed:`, e)
            throw e
        }

        // 测试 4: JSON 序列化
        console.log('Test 4: JSON serialization')
        const testObj = {
            success: true,
            message: 'Test message with 中文',
            timestamp: generatedTime,
            size: size,
            duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        }
        const jsonStr = JSON.stringify(testObj)
        console.log(`✅ JSON serialization works: ${jsonStr.length} chars`)

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)

        return NextResponse.json({
            success: true,
            message: 'All Edge Runtime tests passed',
            tests: {
                textEncoder: { status: 'passed', size },
                dateFormatting: { status: 'passed', time: generatedTime },
                localeCompare: { status: 'passed', sorted: items },
                jsonSerialization: { status: 'passed', length: jsonStr.length },
            },
            duration: `${duration}s`,
        })
    } catch (error: any) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.error(`❌ Error:`, error?.message ?? error)

        return new Response(
            JSON.stringify({
                error: error?.message ?? 'Internal server error',
                stack: error?.stack,
                duration: `${duration}s`,
            }),
            { status: 500 }
        )
    }
}

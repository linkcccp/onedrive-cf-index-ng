import { posix as pathPosix } from 'path-browserify'
import { checkAuthRoute, encodePath, getAccessToken } from '.'
import apiConfig from '../../../config/api.config'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export default async function handler(req: NextRequest): Promise<Response> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token.' }, { status: 403 })
  }

  // Get item thumbnails by its path since we will later check if it is protected
  const { path = '', size = 'medium', odpt = '' } = Object.fromEntries(req.nextUrl.searchParams)

  // Check whether the size is valid - must be one of 'large', 'medium', or 'small'
  if (size !== 'large' && size !== 'medium' && size !== 'small') {
    return NextResponse.json({ error: 'Invalid size.' }, { status: 400 })
  }
  // Sometimes the path parameter is defaulted to '[...path]' which we need to handle
  if (path === '[...path]') {
    return NextResponse.json({ error: 'No path specified.' }, { status: 400 })
  }
  // If the path is not a valid path, return 400
  if (typeof path !== 'string') {
    return NextResponse.json({ error: 'Path query invalid.' }, { status: 400 })
  }
  const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path))

  const { code, message } = await checkAuthRoute(cleanPath, accessToken, odpt as string)
  // Status code other than 200 means user has not authenticated yet
  if (code !== 200) {
    return NextResponse.json({ error: message }, { status: code })
  }

  const requestPath = encodePath(cleanPath)
  // Handle response from OneDrive API
  const requestUrl = `${apiConfig.driveApi}/root${requestPath}`
  // Whether path is root, which requires some special treatment
  const isRoot = requestPath === ''

  const finalUrl = `${requestUrl}${isRoot ? '' : ':'}/thumbnails`

  try {
    const response = await fetch(finalUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 降低错误级别，OneDrive 的缩略图错误很常见，不作为系统级错误透传
      console.warn(`OneDrive Thumbnail API error (${response.status}):`, errorData.error?.message || 'Unknown')
      return NextResponse.json(
        { error: 'Thumbnail not available' },
        { status: 404 } // 返回 404 让前端展示占位图
      )
    }

    const data = await response.json()

    const thumbnailUrl = data.value && data.value.length > 0 ? data.value[0][size]?.url : null
    if (thumbnailUrl) {
      const resp = NextResponse.redirect(thumbnailUrl)
      // 开启 Cloudflare CDN 缓存：在边缘节点缓存 1 小时
      // 理由：OneDrive 的签名链接通常在 1 小时后过期，缓存 1 小时是安全的
      resp.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')
      return resp
    } else {
      return NextResponse.json(
        { error: 'No thumbnail available' },
        { 
          status: 404,
          headers: { 'Cache-Control': 'public, s-maxage=600' } // 找不到封面也缓存 10 分钟，防止频繁冲击 API
        }
      )
    }
  } catch (error: any) {
    console.error('Thumbnail API internal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

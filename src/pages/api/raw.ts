import { posix as pathPosix } from 'path-browserify'
import axios from 'redaxios'

import { driveApi, cacheControlHeader } from '../../../config/api.config'
import { encodePath, getAccessToken, checkAuthRoute } from '.'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export default async function handler(req: NextRequest): Promise<Response> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No access token.' }), { status: 403 })
  }

  const { path = '/', odpt = '', proxy = false } = Object.fromEntries(req.nextUrl.searchParams)

  // Sometimes the path parameter is defaulted to '[...path]' which we need to handle
  if (path === '[...path]') {
    return new Response(JSON.stringify({ error: 'No path specified.' }), { status: 400 })
  }
  // If the path is not a valid path, return 400
  if (typeof path !== 'string') {
    return new Response(JSON.stringify({ error: 'Path query invalid.' }), { status: 400 })
  }
  const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path))

  // Handle protected routes authentication
  const odTokenHeader = (req.headers.get('od-protected-token') as string) ?? odpt

  const { code, message } = await checkAuthRoute(cleanPath, accessToken, odTokenHeader)
  // Status code other than 200 means user has not authenticated yet
  if (code !== 200) {
    return new Response(JSON.stringify({ error: message }), { status: code })
  }

  let headers = {
    'Cache-Control': cacheControlHeader,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  }

  // If message is empty, then the path is not protected.
  // Conversely, protected routes are not allowed to serve from cache.
  if (message !== '') {
    headers['Cache-Control'] = 'no-cache'
  }

  try {
    // Handle response from OneDrive API
    const requestUrl = `${driveApi}/root${encodePath(cleanPath)}`
    const { data } = await axios.get(requestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        // OneDrive international version fails when only selecting the downloadUrl (what a stupid bug)
        select: 'id,size,@microsoft.graph.downloadUrl',
      },
    })

    if ('@microsoft.graph.downloadUrl' in data) {
      const driveDownloadUrl = data['@microsoft.graph.downloadUrl'] as string
      const fileSize = data['size'] || 0

      // 如果文件太大（超过 90MB），则直接重定向到微软官方下载地址，避免 Cloudflare 100MB 的响应限制
      if (fileSize > 94371840) {
        return new Response(null, { status: 302, headers: { 'Location': driveDownloadUrl } })
      }

      // 小于 90MB 的文件，通过 Cloudflare 代理并支持分段请求（Range Request），以便进行 CDN 缓存
      const range = req.headers.get('range')
      const response = await fetch(driveDownloadUrl, {
        headers: range ? { 'Range': range } : {}
      })

      // 复制原始响应头并覆盖缓存控制和跨域头
      const newHeaders = new Headers(response.headers)
      newHeaders.set('Cache-Control', cacheControlHeader)
      newHeaders.set('Access-Control-Allow-Origin', '*')

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      })
    } else {
      return new Response(JSON.stringify({ error: 'No download url found.' }), { status: 404, headers: headers })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.response?.data ?? 'Internal server error.' }), {
      status: error?.response?.status ?? 500,
      headers: headers
    })
  }
}

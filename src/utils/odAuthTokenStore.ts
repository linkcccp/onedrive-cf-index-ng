import { KVNamespace } from '@cloudflare/workers-types'

// 内存存储作为本地开发的 fallback
let memoryStore: {
  accessToken?: string
  accessTokenExpiry?: number  // 绝对时间戳（毫秒）
  refreshToken?: string
} = {}

// 从环境变量初始化（用于本地开发持久化）
if (process.env.LOCAL_ACCESS_TOKEN) {
  memoryStore.accessToken = process.env.LOCAL_ACCESS_TOKEN
}
if (process.env.LOCAL_REFRESH_TOKEN) {
  memoryStore.refreshToken = process.env.LOCAL_REFRESH_TOKEN
}
if (process.env.LOCAL_ACCESS_TOKEN_EXPIRY) {
  memoryStore.accessTokenExpiry = parseInt(process.env.LOCAL_ACCESS_TOKEN_EXPIRY, 10)
}

export async function getOdAuthTokens(): Promise<{ accessToken: unknown; refreshToken: unknown }> {
  const { ONEDRIVE_CF_INDEX_KV } = process.env as unknown as { ONEDRIVE_CF_INDEX_KV: KVNamespace }

  // If KV is available, use it (Cloudflare environment)
  if (ONEDRIVE_CF_INDEX_KV) {
    const accessToken = await ONEDRIVE_CF_INDEX_KV.get('access_token')
    const refreshToken = await ONEDRIVE_CF_INDEX_KV.get('refresh_token')
    return { accessToken, refreshToken }
  }

  // 检查内存中的 accessToken 是否过期
  if (memoryStore.accessTokenExpiry && Date.now() > memoryStore.accessTokenExpiry) {
    memoryStore.accessToken = undefined
    memoryStore.accessTokenExpiry = undefined
  }

  console.log('Using local token store. Has refresh token:', !!memoryStore.refreshToken)
  return {
    accessToken: memoryStore.accessToken,
    refreshToken: memoryStore.refreshToken,
  }
}

export async function storeOdAuthTokens({
  accessToken,
  accessTokenExpiry,
  refreshToken,
}: {
  accessToken: string
  accessTokenExpiry: number
  refreshToken: string
}): Promise<void> {
  const { ONEDRIVE_CF_INDEX_KV } = process.env as unknown as { ONEDRIVE_CF_INDEX_KV: KVNamespace }

  // If KV is available, use it (Cloudflare environment)
  if (ONEDRIVE_CF_INDEX_KV) {
    await ONEDRIVE_CF_INDEX_KV.put('access_token', accessToken, { expirationTtl: accessTokenExpiry })
    await ONEDRIVE_CF_INDEX_KV.put('refresh_token', refreshToken)
    return
  }

  // Local development: store in memory
  const expiryTimestamp = Date.now() + accessTokenExpiry * 1000
  memoryStore = {
    accessToken,
    accessTokenExpiry: expiryTimestamp,
    refreshToken,
  }

  console.log('Storing tokens in memory. Expiry:', new Date(expiryTimestamp).toISOString())
  
  // 尝试通过独立的本地 Token 服务器持久化到文件
  // 服务器运行在 localhost:3001，由 Linkcccp_local-token-server.js 提供
  try {
    await fetch('http://localhost:3001/api/local-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        accessTokenExpiry: expiryTimestamp,
        refreshToken,
      }),
    })
    console.log('Token persisted to local file via token server')
  } catch (error) {
    // 静默失败，至少内存中有 token
    console.log('Could not persist tokens to file (token server may not be running)')
  }
}

import { KVNamespace } from '@cloudflare/workers-types'

// In-memory token store for development when KV is not available
const memoryStore: {
  accessToken?: string
  accessTokenExpiry?: number
  refreshToken?: string
} = {}

export async function getOdAuthTokens(): Promise<{ accessToken: unknown; refreshToken: unknown }> {
  const { ONEDRIVE_CF_INDEX_KV } = process.env as unknown as { ONEDRIVE_CF_INDEX_KV: KVNamespace }

  // If KV is not available (e.g., local development), use in-memory store
  if (!ONEDRIVE_CF_INDEX_KV) {
    console.warn('ONEDRIVE_CF_INDEX_KV is not defined. Using in-memory token store.')
    return {
      accessToken: memoryStore.accessToken,
      refreshToken: memoryStore.refreshToken,
    }
  }

  const accessToken = await ONEDRIVE_CF_INDEX_KV.get('access_token')
  const refreshToken = await ONEDRIVE_CF_INDEX_KV.get('refresh_token')

  return {
    accessToken,
    refreshToken,
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

  // If KV is not available (e.g., local development), use in-memory store
  if (!ONEDRIVE_CF_INDEX_KV) {
    console.warn('ONEDRIVE_CF_INDEX_KV is not defined. Storing tokens in memory.')
    memoryStore.accessToken = accessToken
    memoryStore.accessTokenExpiry = accessTokenExpiry
    memoryStore.refreshToken = refreshToken
    return
  }

  await ONEDRIVE_CF_INDEX_KV.put('access_token', accessToken, { expirationTtl: accessTokenExpiry })
  await ONEDRIVE_CF_INDEX_KV.put('refresh_token', refreshToken)
}

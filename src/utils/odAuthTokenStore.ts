import { KVNamespace } from '@cloudflare/workers-types'

export async function getOdAuthTokens(): Promise<{ accessToken: unknown; refreshToken: unknown }> {
  const { ONEDRIVE_CF_INDEX_KV } = process.env as unknown as { ONEDRIVE_CF_INDEX_KV: KVNamespace }

  // If KV is not available (e.g., local development), return undefined tokens
  if (!ONEDRIVE_CF_INDEX_KV) {
    console.warn('ONEDRIVE_CF_INDEX_KV is not defined. Returning empty tokens.')
    return {
      accessToken: undefined,
      refreshToken: undefined,
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

  // If KV is not available (e.g., local development), skip storing
  if (!ONEDRIVE_CF_INDEX_KV) {
    console.warn('ONEDRIVE_CF_INDEX_KV is not defined. Skipping token storage.')
    return
  }

  await ONEDRIVE_CF_INDEX_KV.put('access_token', accessToken, { expirationTtl: accessTokenExpiry })
  await ONEDRIVE_CF_INDEX_KV.put('refresh_token', refreshToken)
}

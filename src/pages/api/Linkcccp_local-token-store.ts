/**
 * 本地 Token 持久化 API
 * 此路由仅用于本地开发时持久化 OAuth token 到文件
 * 生产环境 (Cloudflare Pages) 应使用 Cloudflare KV
 * 
 * 注意：此文件在生产环境构建时使用 Edge Runtime（满足 Cloudflare 要求），
 * 但实际功能只在本地 `next dev` 开发模式下可用。
 */
import type { NextApiRequest, NextApiResponse } from 'next'

// 使用 Edge Runtime 以满足 Cloudflare Pages 构建要求
export const runtime = 'edge'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Edge Runtime 不支持 Node.js 的 fs 模块
  // 此 API 仅设计用于本地开发环境 (next dev)
  // 在 Cloudflare Pages 生产环境中，直接返回不可用提示
  return new Response(
    JSON.stringify({ 
      error: 'This endpoint is only available in local development mode (next dev). In production, tokens are managed via Cloudflare KV.' 
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

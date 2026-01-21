/**
 * 本地 Token 持久化 API
 * 此路由使用 Node.js Runtime（非 Edge），用于本地开发时持久化 OAuth token 到文件
 * 仅在开发环境下使用，生产环境应使用 Cloudflare KV
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs'
import * as path from 'path'

// 使用 Node.js Runtime 而非 Edge Runtime
export const config = {
  runtime: 'nodejs',
}

const LOCAL_TOKEN_FILE = path.join(process.cwd(), '.wrangler', 'local-tokens.json')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 仅在开发环境下允许使用
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is only available in development' })
  }

  if (req.method === 'GET') {
    // 读取本地 token
    try {
      if (fs.existsSync(LOCAL_TOKEN_FILE)) {
        const data = fs.readFileSync(LOCAL_TOKEN_FILE, 'utf-8')
        const tokens = JSON.parse(data)
        
        // 检查 accessToken 是否过期
        if (tokens.accessTokenExpiry && Date.now() > tokens.accessTokenExpiry) {
          tokens.accessToken = undefined
          tokens.accessTokenExpiry = undefined
        }
        
        return res.status(200).json(tokens)
      }
      return res.status(200).json({})
    } catch (error) {
      console.error('Error reading local tokens:', error)
      return res.status(500).json({ error: 'Failed to read tokens' })
    }
  }

  if (req.method === 'POST') {
    // 保存 token 到本地文件
    try {
      const { accessToken, accessTokenExpiry, refreshToken } = req.body

      // 确保目录存在
      const dir = path.dirname(LOCAL_TOKEN_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const dataToStore = {
        accessToken,
        accessTokenExpiry,
        refreshToken,
      }

      fs.writeFileSync(LOCAL_TOKEN_FILE, JSON.stringify(dataToStore, null, 2))
      console.log('Tokens saved to local file:', LOCAL_TOKEN_FILE)
      
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error writing local tokens:', error)
      return res.status(500).json({ error: 'Failed to save tokens' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

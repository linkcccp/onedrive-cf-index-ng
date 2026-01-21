#!/usr/bin/env node
/**
 * 本地 Token 文件服务器
 * 独立运行，专门处理 OAuth token 的文件读写
 * 使用方法：node Linkcccp_local-token-server.js
 *
 * 此服务器监听 3001 端口，提供 /api/local-token 接口
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 3001
const LOCAL_TOKEN_FILE = path.join(__dirname, '.wrangler', 'local-tokens.json')

// 确保目录存在
function ensureDir() {
  const dir = path.dirname(LOCAL_TOKEN_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// 读取 token
function readTokens() {
  try {
    if (fs.existsSync(LOCAL_TOKEN_FILE)) {
      const data = fs.readFileSync(LOCAL_TOKEN_FILE, 'utf-8')
      const tokens = JSON.parse(data)

      // 检查 accessToken 是否过期
      if (tokens.accessTokenExpiry && Date.now() > tokens.accessTokenExpiry) {
        tokens.accessToken = undefined
        tokens.accessTokenExpiry = undefined
      }

      return tokens
    }
  } catch (error) {
    console.error('读取 token 失败:', error.message)
  }
  return {}
}

// 保存 token
function saveTokens(data) {
  try {
    ensureDir()
    fs.writeFileSync(LOCAL_TOKEN_FILE, JSON.stringify(data, null, 2))
    console.log('✅ Token 已保存到:', LOCAL_TOKEN_FILE)
    return true
  } catch (error) {
    console.error('保存 token 失败:', error.message)
    return false
  }
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  // 处理 preflight 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // 只处理 /api/local-token 路径
  if (req.url !== '/api/local-token') {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  if (req.method === 'GET') {
    const tokens = readTokens()
    res.writeHead(200)
    res.end(JSON.stringify(tokens))
    return
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const success = saveTokens({
          accessToken: data.accessToken,
          accessTokenExpiry: data.accessTokenExpiry,
          refreshToken: data.refreshToken,
        })
        if (success) {
          res.writeHead(200)
          res.end(JSON.stringify({ success: true }))
        } else {
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Failed to save tokens' }))
        }
      } catch (error) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }

  res.writeHead(405)
  res.end(JSON.stringify({ error: 'Method not allowed' }))
})

server.listen(PORT, () => {
  console.log('')
  console.log('🔐 本地 Token 服务器已启动')
  console.log(`   地址: http://localhost:${PORT}/api/local-token`)
  console.log(`   文件: ${LOCAL_TOKEN_FILE}`)
  console.log('')
  console.log('   GET  - 读取 token')
  console.log('   POST - 保存 token')
  console.log('')
  console.log('按 Ctrl+C 停止服务器')
  console.log('')
})

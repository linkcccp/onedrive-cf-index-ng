#!/usr/bin/env node
/**
 * 本地开发启动脚本
 * 在启动 Next.js 前从本地文件读取 OAuth token 并注入环境变量
 * 这样即使关闭终端，token 也会被持久化保存
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const LOCAL_TOKEN_FILE = path.join(__dirname, '.wrangler', 'local-tokens.json')

function loadLocalTokens() {
  try {
    if (fs.existsSync(LOCAL_TOKEN_FILE)) {
      const data = fs.readFileSync(LOCAL_TOKEN_FILE, 'utf-8')
      const tokens = JSON.parse(data)

      // 检查 accessToken 是否过期
      if (tokens.accessTokenExpiry && Date.now() > tokens.accessTokenExpiry) {
        console.log('⚠️  Access token 已过期，将使用 refresh token 自动刷新')
        tokens.accessToken = undefined
        tokens.accessTokenExpiry = undefined
      }

      return tokens
    }
  } catch (error) {
    console.error('读取本地 token 文件失败:', error.message)
  }
  return {}
}

// 加载本地 token
const tokens = loadLocalTokens()

// 准备环境变量
const env = { ...process.env }

if (tokens.accessToken) {
  env.LOCAL_ACCESS_TOKEN = tokens.accessToken
  console.log('✅ 已加载本地 access token')
}
if (tokens.refreshToken) {
  env.LOCAL_REFRESH_TOKEN = tokens.refreshToken
  console.log('✅ 已加载本地 refresh token')
}
if (tokens.accessTokenExpiry) {
  env.LOCAL_ACCESS_TOKEN_EXPIRY = String(tokens.accessTokenExpiry)
  const expiryDate = new Date(tokens.accessTokenExpiry)
  console.log('✅ Access token 过期时间:', expiryDate.toLocaleString())
}

if (!tokens.refreshToken) {
  console.log('ℹ️  未找到本地 token，首次运行请先完成 OneDrive 授权')
}

console.log('\n🚀 启动 Next.js 开发服务器...\n')

// 获取命令行参数（跳过 node 和脚本名）
const args = process.argv.slice(2)
const command = args[0] || 'dev'

// 启动 Next.js
const child = spawn('npx', ['next', command], {
  env,
  stdio: 'inherit',
  shell: true,
})

child.on('error', error => {
  console.error('启动失败:', error.message)
  process.exit(1)
})

child.on('exit', code => {
  process.exit(code || 0)
})

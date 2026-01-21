const runtimeCaching = require('next-pwa/cache')
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // 开发环境下禁用 PWA 以减少 Workbox 日志干扰
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/static\.cloudflareinsights\.com\//,
      handler: 'NetworkOnly',
    },
    ...runtimeCaching,
  ],
})

module.exports = withPWA({
  reactStrictMode: true,
})

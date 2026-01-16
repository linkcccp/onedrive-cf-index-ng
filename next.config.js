const runtimeCaching = require('next-pwa/cache')
const withPWA = require('next-pwa')({
  dest: 'public',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/static\.cloudflareinsights\.com\//,
      handler: 'NetworkOnly',
    },
    ...runtimeCaching,
  ],
})

module.exports = withPWA({
  reactStrictMode: true
})

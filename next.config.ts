import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Media uploads go through server actions (profiles, posts, chats, products)
  experimental: { serverActions: { bodySizeLimit: '25mb' } },
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        // Browsers only use HTTPS for PAPA once it is served over HTTPS in production
        ...(process.env.NODE_ENV === 'production' && (process.env.APP_URL ?? '').startsWith('https://')
          ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
      ],
    }, {
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }],
    }]
  },
}

export default nextConfig

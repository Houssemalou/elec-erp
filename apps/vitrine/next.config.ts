import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@elec/contracts', '@elec/db', '@elec/services'],
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default nextConfig
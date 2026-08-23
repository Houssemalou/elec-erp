import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@elec/contracts', '@elec/db', '@elec/services'],
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
}

export default nextConfig
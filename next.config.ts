import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: false,
  // Драйверы баз нативные и/или тянут свои файлы: бандлить их нельзя, они
  // подгружаются из node_modules во время работы.
  serverExternalPackages: [
    'better-sqlite3',
    'pg',
    '@prisma/adapter-better-sqlite3',
    '@prisma/adapter-pg',
  ],
}

export default nextConfig

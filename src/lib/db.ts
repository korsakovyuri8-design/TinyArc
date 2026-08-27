import { PrismaClient } from '@/generated/prisma/client'
import { adapterFor } from './db-adapter'
import { databaseUrl } from './db-provider'

const globalForPrisma = globalThis as unknown as { bureauPrisma?: PrismaClient }

export const prisma =
  globalForPrisma.bureauPrisma ?? new PrismaClient({ adapter: adapterFor(databaseUrl()) })

if (process.env.NODE_ENV !== 'production') globalForPrisma.bureauPrisma = prisma

import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let prismaInstance: PrismaClient | null = null

function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'flux.db')
}

export function getDb(): PrismaClient {
  if (!prismaInstance) {
    const dbPath = getDatabasePath()
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    process.env.DATABASE_URL = `file:${dbPath}`
    prismaInstance = new PrismaClient()
  }
  return prismaInstance
}

export async function closeDb(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
}

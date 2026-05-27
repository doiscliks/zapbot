import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = (await scryptAsync(password, salt, 64)) as Buffer
  const storedBuffer = Buffer.from(hash, 'hex')
  if (hashBuffer.length !== storedBuffer.length) return false
  return timingSafeEqual(hashBuffer, storedBuffer)
}

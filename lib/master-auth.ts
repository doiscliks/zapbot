import { createHash } from 'crypto'
import { NextRequest } from 'next/server'

function sessionToken(): string {
  const pass = process.env.MASTER_PASSWORD || 'admin123'
  const secret = process.env.MASTER_SECRET || 'saaswpp_secret'
  return createHash('sha256').update(pass + secret).digest('hex')
}

export function isMasterAuth(request: NextRequest): boolean {
  return request.cookies.get('master_session')?.value === sessionToken()
}

export function masterToken(): string {
  return sessionToken()
}

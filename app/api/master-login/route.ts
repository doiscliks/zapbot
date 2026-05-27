import { NextRequest, NextResponse } from 'next/server'
import { masterToken } from '@/lib/master-auth'

export async function POST(request: NextRequest) {
  const { usuario, senha } = await request.json()

  const masterUser = process.env.MASTER_USER || 'admin'
  const masterPass = process.env.MASTER_PASSWORD || 'admin123'

  if (usuario !== masterUser || senha !== masterPass) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('master_session', masterToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h
  })

  return response
}

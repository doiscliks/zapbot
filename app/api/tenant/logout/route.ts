import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('tenant_session', '', { path: '/', maxAge: 0 })
  response.cookies.set('usuario_session', '', { path: '/', maxAge: 0 })
  response.cookies.set('permissoes', '', { path: '/', maxAge: 0 })
  return response
}

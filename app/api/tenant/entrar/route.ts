import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { nome } = await request.json().catch(() => ({ nome: '' }))

  const sessionId = randomUUID()
  const response = NextResponse.json({ ok: true })

  response.cookies.set('tenant_session', sessionId, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  // Salva o nome temporariamente para pré-preencher na ativação da chave
  if (nome?.trim()) {
    response.cookies.set('tenant_name', nome.trim(), {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return response
}

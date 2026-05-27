import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const { access_token } = await request.json()
  if (!access_token) return NextResponse.json({ error: 'Token ausente' }, { status: 400 })

  const supabase = getSupabase()

  // Verifica o token com o Supabase e obtém o email do usuário
  const { data: { user }, error } = await supabase.auth.getUser(access_token)
  if (error || !user?.email) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const email = user.email.toLowerCase()

  // Busca se já tem chave vinculada a este email
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, ativo, validade')
    .eq('email', email)
    .single()

  const response = NextResponse.json(
    usuario ? { ok: true } : { needsKey: true }
  )

  // Seta cookie com o email (não-httpOnly, para ser lido no ativar-chave)
  response.cookies.set('tenant_email', email, {
    httpOnly: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })

  if (usuario) {
    // Chave já vinculada — seta sessão com o id real do usuário
    response.cookies.set('tenant_session', usuario.id, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  } else {
    // Ainda sem chave — seta sessão temporária (não bate em nenhum usuario)
    response.cookies.set('tenant_session', randomUUID(), {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
  }

  return response
}

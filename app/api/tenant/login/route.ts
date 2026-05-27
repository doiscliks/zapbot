import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPassword } from '@/lib/password'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const { email, senha } = await request.json()

  if (!email?.trim() || !senha) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!usuario || !usuario.senha_hash) {
    return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
  }

  const senhaOk = await verifyPassword(senha, usuario.senha_hash)
  if (!senhaOk) {
    return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
  }

  if (!usuario.ativo) {
    return NextResponse.json({ error: 'Conta desativada. Entre em contato com o administrador.' }, { status: 403 })
  }

  if (new Date(usuario.validade) < new Date()) {
    return NextResponse.json({ error: 'Acesso expirado. Entre em contato com o administrador.' }, { status: 403 })
  }

  if (!usuario.usado_em) {
    await supabase.from('usuarios').update({ usado_em: new Date().toISOString() }).eq('id', usuario.id)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('tenant_session', usuario.id, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}

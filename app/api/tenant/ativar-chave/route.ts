import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const email = request.cookies.get('tenant_email')?.value
  if (!email) {
    return NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  }

  const { chave, nome } = await request.json()
  if (!chave?.trim()) {
    return NextResponse.json({ error: 'Chave de acesso obrigatória' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('chave_acesso', chave.trim().toUpperCase())
    .single()

  if (!usuario) {
    return NextResponse.json({ error: 'Chave de acesso inválida' }, { status: 401 })
  }

  if (!usuario.ativo) {
    return NextResponse.json({ error: 'Esta chave foi desativada. Entre em contato com o administrador.' }, { status: 403 })
  }

  if (new Date(usuario.validade) < new Date()) {
    return NextResponse.json({ error: 'Esta chave expirou. Entre em contato com o administrador.' }, { status: 403 })
  }

  // Se a chave já está vinculada a outro email, bloqueia
  if (usuario.email && usuario.email !== email) {
    return NextResponse.json({ error: 'Esta chave já está vinculada a outra conta.' }, { status: 403 })
  }

  // Vincula o email à chave (se ainda não estava)
  const updates: Record<string, unknown> = {}
  if (!usuario.email) updates.email = email
  if (!usuario.usado_em) updates.usado_em = new Date().toISOString()
  if (nome?.trim()) updates.nome = nome.trim()
  if (Object.keys(updates).length > 0) {
    await supabase.from('usuarios').update(updates).eq('id', usuario.id)
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

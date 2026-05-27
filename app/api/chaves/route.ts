import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isMasterAuth } from '@/lib/master-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

function gerarChave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let chave = ''
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) chave += '-'
    chave += chars[Math.floor(Math.random() * chars.length)]
  }
  return chave
}

export async function GET(request: NextRequest) {
  if (!isMasterAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, chave_acesso, validade, ativo, usado_em, created_at, instancias_permitidas')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!isMasterAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dias, instancias_permitidas } = await request.json()
  if (!dias || dias < 1) return NextResponse.json({ error: 'Dias inválido' }, { status: 400 })

  const validade = new Date()
  validade.setDate(validade.getDate() + Number(dias))

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      chave_acesso: gerarChave(),
      validade: validade.toISOString().split('T')[0],
      ativo: true,
      instancias_permitidas: Math.max(1, Number(instancias_permitidas) || 1),
    })
    .select('id, nome, email, chave_acesso, validade, ativo, usado_em, created_at, instancias_permitidas')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

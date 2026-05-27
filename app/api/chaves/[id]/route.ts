import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isMasterAuth } from '@/lib/master-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isMasterAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = getSupabase()
  const updates: Record<string, unknown> = {}

  if (body.dias !== undefined) {
    const { data: current } = await supabase.from('usuarios').select('validade').eq('id', id).single()
    if (!current) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const base = current.validade && new Date(current.validade) > new Date() ? new Date(current.validade) : new Date()
    base.setDate(base.getDate() + Number(body.dias))
    updates.validade = base.toISOString().split('T')[0]
  }

  if (body.ativo !== undefined) updates.ativo = body.ativo
  if (body.instancias_permitidas !== undefined) updates.instancias_permitidas = Math.max(1, Number(body.instancias_permitidas) || 1)

  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select('id, nome, email, chave_acesso, validade, ativo, usado_em, created_at, instancias_permitidas')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isMasterAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabase()
  const { error } = await supabase.from('usuarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

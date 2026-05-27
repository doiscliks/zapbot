import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body.status_alvo !== undefined) updates.status_alvo = body.status_alvo
  if (body.tempo_horas !== undefined) updates.tempo_horas = Number(body.tempo_horas)
  if (body.mensagem !== undefined) updates.mensagem = body.mensagem
  if (body.ativo !== undefined) updates.ativo = body.ativo
  if (body.limite !== undefined) updates.limite = body.limite ? Number(body.limite) : null
  if (body.intervalo_segundos !== undefined) updates.intervalo_segundos = Number(body.intervalo_segundos)
  if (body.hora_inicio !== undefined) updates.hora_inicio = body.hora_inicio || null
  if (body.hora_fim !== undefined) updates.hora_fim = body.hora_fim || null
  if (body.max_repeticoes !== undefined) updates.max_repeticoes = body.max_repeticoes ? Number(body.max_repeticoes) : 1

  const { data, error } = await supabase
    .from('remarketing_regras')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params

  const { error } = await supabase
    .from('remarketing_regras')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

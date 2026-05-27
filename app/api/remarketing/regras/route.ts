import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('remarketing_regras')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const body = await request.json()
  const { status_alvo, tempo_horas, mensagem, limite, intervalo_segundos, hora_inicio, hora_fim, max_repeticoes } = body

  if (!status_alvo || !tempo_horas || !mensagem || !limite) {
    return NextResponse.json({ error: 'status_alvo, tempo_horas, limite e mensagem são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('remarketing_regras')
    .insert({
      status_alvo,
      tempo_horas: Number(tempo_horas),
      mensagem,
      ativo: true,
      limite: Number(limite),
      intervalo_segundos: intervalo_segundos ? Number(intervalo_segundos) : 3,
      hora_inicio: hora_inicio || null,
      hora_fim: hora_fim || null,
      max_repeticoes: max_repeticoes ? Number(max_repeticoes) : 1,
      user_id: userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

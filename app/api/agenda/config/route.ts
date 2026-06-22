import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest) {
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('agenda_config')
    .select('id, titulo, slug, descricao, duracao_minutos, dias_semana, periodos, antecedencia_minima_horas, dias_antecedencia_maxima, whatsapp_instancia_id, google_calendar_id, ativo, google_access_token, mensagem_cancelamento, lembrete_antecedencia_horas, telefone_notificacao')
    .eq('user_id', userId)
    .single()

  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    ...data,
    google_conectado: !!data.google_access_token,
    google_access_token: undefined,
  })
}

export async function POST(request: NextRequest) {
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const supabase = getSupabase()

  const slug = (body.slug || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

  const periodos = Array.isArray(body.periodos) && body.periodos.length > 0
    ? body.periodos
    : [{ inicio: '09:00', fim: '18:00' }]

  const campos = {
    user_id: userId,
    titulo: (body.titulo || 'Agendar Reunião').trim(),
    slug,
    descricao: body.descricao?.trim() || null,
    duracao_minutos: Number(body.duracao_minutos) || 60,
    dias_semana: body.dias_semana || [1, 2, 3, 4, 5],
    periodos,
    antecedencia_minima_horas: Number(body.antecedencia_minima_horas) || 24,
    dias_antecedencia_maxima: Number(body.dias_antecedencia_maxima) || 30,
    whatsapp_instancia_id: body.whatsapp_instancia_id || null,
    mensagem_cancelamento: body.mensagem_cancelamento?.trim() || 'Olá, {nome}! Seu agendamento do dia {data} às {hora} foi cancelado. Entre em contato para remarcar.',
    lembrete_antecedencia_horas: Number(body.lembrete_antecedencia_horas) || 0,
    telefone_notificacao: body.telefone_notificacao?.trim() || null,
    ativo: body.ativo !== false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('agenda_config')
    .upsert(campos, { onConflict: 'user_id' })
    .select('id, titulo, slug, descricao, duracao_minutos, dias_semana, periodos, antecedencia_minima_horas, dias_antecedencia_maxima, whatsapp_instancia_id, mensagem_cancelamento, lembrete_antecedencia_horas, telefone_notificacao, ativo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

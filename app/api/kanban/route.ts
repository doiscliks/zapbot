import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  const [secoesRes, clientesRes] = await Promise.all([
    supabase.from('kanban_secoes').select('*').eq('user_id', userId).order('ordem', { ascending: true }),
    supabase.from('clientes').select('*').eq('user_id', userId).order('nome', { ascending: true }).limit(2000),
  ])

  if (secoesRes.error) return NextResponse.json({ error: secoesRes.error.message }, { status: 500 })

  // Deduplicar por telefone
  const unicosPorTelefone: Record<string, Record<string, unknown>> = {}
  for (const c of clientesRes.data ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > (unicosPorTelefone[c.telefone].id as number)) {
      unicosPorTelefone[c.telefone] = c
    }
  }
  const clientes = Object.values(unicosPorTelefone)

  const porSecao: Record<string, unknown[]> = { sem_secao: [] }
  const porStatus: Record<string, unknown[]> = {}
  for (const c of clientes) {
    const key = c.kanban_secao_id ? String(c.kanban_secao_id) : 'sem_secao'
    if (!porSecao[key]) porSecao[key] = []
    porSecao[key].push(c)
    const statusKey = (c.status_atual as string) || 'sem_status'
    if (!porStatus[statusKey]) porStatus[statusKey] = []
    porStatus[statusKey].push(c)
  }

  return NextResponse.json({ secoes: secoesRes.data ?? [], clientes: porSecao, clientesPorStatus: porStatus })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { nome, facebook_evento, cor } = await request.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const supabase = getSupabase()

  const { data: existentes } = await supabase
    .from('kanban_secoes').select('ordem').eq('user_id', userId).order('ordem', { ascending: false }).limit(1)
  const proximaOrdem = ((existentes?.[0]?.ordem ?? -1) as number) + 1

  const { data, error } = await supabase
    .from('kanban_secoes')
    .insert({ nome: nome.trim(), ordem: proximaOrdem, facebook_evento: facebook_evento ?? null, cor: cor ?? null, user_id: userId })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

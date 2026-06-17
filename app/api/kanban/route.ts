import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId, getUsuarioId } from '@/lib/tenant-auth'
import { Cliente } from '@/types'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request)
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  // Verifica se é atendente
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = !usuario.parent_id
  const isAtendente = usuario.is_attendant

  const secoesFetch = supabase.from('kanban_secoes').select('*').eq('user_id', tenantId).order('ordem', { ascending: true })

  let clientesFetch = supabase.from('clientes').select('*').eq('user_id', tenantId).order('nome', { ascending: true }).limit(2000)
  if (!isAdmin && isAtendente) {
    clientesFetch = clientesFetch.eq('assigned_user_id', userId)
  }

  const [secoesRes, clientesRes] = await Promise.all([secoesFetch, clientesFetch])

  if (secoesRes.error) return NextResponse.json({ error: secoesRes.error.message }, { status: 500 })

  // Deduplicar por telefone
  const unicosPorTelefone: Record<string, Cliente> = {}
  for (const c of (clientesRes.data ?? []) as Cliente[]) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
      unicosPorTelefone[c.telefone] = c
    }
  }
  const clientes = Object.values(unicosPorTelefone)

  // Busca nomes dos atendentes associados
  const assignedUserIds = new Set<string>()
  for (const c of clientes) {
    if (c.assigned_user_id) assignedUserIds.add(c.assigned_user_id as string)
  }

  const usuariosMap: Record<string, { nome: string }> = {}
  if (assignedUserIds.size > 0) {
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nome')
      .in('id', Array.from(assignedUserIds))

    for (const u of usuarios ?? []) {
      usuariosMap[u.id] = { nome: u.nome }
    }
  }

  // Adiciona nome do atendente em cada cliente
  const clientesComAtendente: (Cliente & { nome_atendente: string | null })[] = clientes.map(c => ({
    ...c,
    nome_atendente: c.assigned_user_id ? usuariosMap[c.assigned_user_id as string]?.nome : null,
  }))

  const porSecao: Record<string, unknown[]> = { sem_secao: [] }
  const porStatus: Record<string, unknown[]> = {}
  for (const c of clientesComAtendente) {
    const key = c.kanban_secao_id ? String(c.kanban_secao_id) : 'sem_secao'
    if (!porSecao[key]) porSecao[key] = []
    porSecao[key].push(c)
    const statusKey = (c.status_atual as string) || 'sem_status'
    if (!porStatus[statusKey]) porStatus[statusKey] = []
    porStatus[statusKey].push(c)
  }

  return NextResponse.json({
    secoes: secoesRes.data ?? [],
    clientes: porSecao,
    clientesPorStatus: porStatus,
    ehAdmin: isAdmin,
  })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  // Verifica se é admin (sem parent_id)
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario || usuario.parent_id) {
    return NextResponse.json({ error: 'Apenas administradores podem criar seções' }, { status: 403 })
  }

  const { nome, facebook_evento, cor } = await request.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

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

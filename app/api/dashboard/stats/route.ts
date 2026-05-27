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

  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  const supabase = getSupabase()

  // 1. Clientes por dia
  let clientesQuery = supabase
    .from('clientes')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (startDate) clientesQuery = clientesQuery.gte('created_at', `${startDate}T00:00:00`)
  if (endDate) clientesQuery = clientesQuery.lte('created_at', `${endDate}T23:59:59`)

  const { data: clientesRaw } = await clientesQuery

  const clientesPorDia: Record<string, number> = {}
  for (const c of clientesRaw ?? []) {
    const dia = (c.created_at as string).slice(0, 10)
    clientesPorDia[dia] = (clientesPorDia[dia] ?? 0) + 1
  }

  // 2. Atendimento vs resposta (clientes no período)
  const inicio = startDate ?? (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })()
  const fim = endDate ?? new Date().toISOString().slice(0, 10)

  const { data: clientesPeriodo } = await supabase
    .from('clientes')
    .select('id, telefone, created_at')
    .eq('user_id', userId)
    .gte('created_at', `${inicio}T00:00:00`)
    .lte('created_at', `${fim}T23:59:59`)
    .order('created_at', { ascending: true })

  // Deduplicar por telefone
  const unicosPorTelefone: Record<string, { id: number; telefone: string; created_at: string }> = {}
  for (const c of clientesPeriodo ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
      unicosPorTelefone[c.telefone] = c
    }
  }

  const telefones = Object.keys(unicosPorTelefone)
  let contagemPorTelefone: Record<string, number> = {}

  if (telefones.length > 0) {
    const { data: mensagens } = await supabase
      .from('mensagens_whatsapp')
      .select('numero_cliente')
      .eq('user_id', userId)
      .in('numero_cliente', telefones)

    for (const msg of mensagens ?? []) {
      contagemPorTelefone[msg.numero_cliente] = (contagemPorTelefone[msg.numero_cliente] ?? 0) + 1
    }
  }

  const atendimentoPorDia: Record<string, { semResposta: number; comResposta: number }> = {}
  for (const [telefone, { created_at }] of Object.entries(unicosPorTelefone)) {
    const dia = created_at.slice(0, 10)
    if (!atendimentoPorDia[dia]) atendimentoPorDia[dia] = { semResposta: 0, comResposta: 0 }
    if ((contagemPorTelefone[telefone] ?? 0) >= 3) {
      atendimentoPorDia[dia].comResposta++
    } else {
      atendimentoPorDia[dia].semResposta++
    }
  }

  const atendimento = Object.entries(atendimentoPorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, { semResposta, comResposta }]) => ({ data, semResposta, comResposta }))

  // 3. Status atual dos clientes
  const { data: statusRaw } = await supabase
    .from('clientes')
    .select('status_atual')
    .eq('user_id', userId)

  const statusContagem: Record<string, number> = {}
  for (const c of statusRaw ?? []) {
    if (!c.status_atual) continue
    statusContagem[c.status_atual] = (statusContagem[c.status_atual] ?? 0) + 1
  }

  const statusAtual = Object.entries(statusContagem)
    .map(([status, total]) => ({ status, total }))
    .sort((a, b) => b.total - a.total)

  // 4. Kanban por seção
  const [secoesRes, clientesKanbanRes] = await Promise.all([
    supabase.from('kanban_secoes').select('id, nome').eq('user_id', userId).order('ordem', { ascending: true }),
    supabase.from('clientes').select('telefone, kanban_secao_id').eq('user_id', userId),
  ])

  const unicosKanban: Record<string, { telefone: string; kanban_secao_id: number | null }> = {}
  for (const c of clientesKanbanRes.data ?? []) {
    if (!c.telefone || unicosKanban[c.telefone]) continue
    unicosKanban[c.telefone] = c
  }

  const kanbanContagem: Record<string, number> = {}
  let semSecao = 0
  for (const c of Object.values(unicosKanban)) {
    if (c.kanban_secao_id) kanbanContagem[c.kanban_secao_id] = (kanbanContagem[c.kanban_secao_id] ?? 0) + 1
    else semSecao++
  }

  const kanban = (secoesRes.data ?? [])
    .map((s: { id: number; nome: string }) => ({ nome: s.nome, total: kanbanContagem[s.id] ?? 0 }))
    .filter((s) => s.total > 0)

  if (semSecao > 0) kanban.push({ nome: 'Sem etapa', total: semSecao })

  return NextResponse.json({
    clientesPorDia: Object.entries(clientesPorDia).map(([data, total]) => ({ data, total })),
    atendimento,
    statusAtual,
    kanban,
  })
}

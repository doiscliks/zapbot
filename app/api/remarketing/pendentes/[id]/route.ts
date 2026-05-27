import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params

  // Busca a regra
  const { data: regra, error: errRegra } = await supabase
    .from('remarketing_regras')
    .select('status_alvo, tempo_horas, max_repeticoes, user_id')
    .eq('id', id)
    .single()

  if (errRegra || !regra) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })

  const limiteData = new Date(Date.now() - regra.tempo_horas * 60 * 60 * 1000)

  // Clientes elegíveis
  const secaoId = Number(regra.status_alvo)
  const clientesQuery = supabase
    .from('clientes')
    .select('id, telefone')
    .eq('user_id', regra.user_id)
    .not('telefone', 'is', null)
    .lt('dt_ultima_mensagem', limiteData.toISOString())

  if (!isNaN(secaoId)) {
    clientesQuery.eq('kanban_secao_id', secaoId)
  } else {
    clientesQuery.eq('status_atual', regra.status_alvo)
  }

  const { data: clientes } = await clientesQuery

  if (!clientes || clientes.length === 0) return NextResponse.json({ pendentes: 0 })

  // Deduplica por telefone
  const unicosPorTelefone: Record<string, number> = {}
  for (const c of clientes) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone]) {
      unicosPorTelefone[c.telefone] = c.id
    }
  }
  const telefones = Object.keys(unicosPorTelefone)

  // Conta envios por telefone
  const { data: logs } = await supabase
    .from('remarketing_logs')
    .select('telefone')
    .eq('regra_id', id)
    .in('telefone', telefones)

  const maxRep = regra.max_repeticoes ?? 1
  const contagemEnvios: Record<string, number> = {}
  for (const log of logs ?? []) {
    contagemEnvios[log.telefone] = (contagemEnvios[log.telefone] ?? 0) + 1
  }
  const pendentes = telefones.filter((t) => (contagemEnvios[t] ?? 0) < maxRep).length

  return NextResponse.json({ pendentes })
}

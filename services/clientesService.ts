import { supabase } from '@/lib/supabase'
import { Cliente, ClienteComUltimaMensagem } from '@/types'

export async function getTotalClientes(): Promise<number> {
  const { count, error } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

export async function getClientesPorDia(startDate?: string, endDate?: string): Promise<{ data: string; total: number }[]> {
  let query = supabase.from('clientes').select('created_at').order('created_at', { ascending: true })

  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
  if (endDate)   query = query.lte('created_at', `${endDate}T23:59:59`)

  const { data, error } = await query
  if (error) throw error

  const agrupado: Record<string, number> = {}
  for (const item of data ?? []) {
    const dia = item.created_at.slice(0, 10)
    agrupado[dia] = (agrupado[dia] ?? 0) + 1
  }

  return Object.entries(agrupado).map(([data, total]) => ({ data, total }))
}

export async function getAtendimentoVsResposta(startDate?: string, endDate?: string): Promise<{ data: string; semResposta: number; comResposta: number }[]> {
  // Padrão: últimos 30 dias
  const inicio = startDate ?? (() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })()
  const fim = endDate ?? new Date().toISOString().slice(0, 10)

  const { data: clientes, error: errClientes } = await supabase
    .from('clientes')
    .select('id, telefone, created_at')
    .gte('created_at', `${inicio}T00:00:00`)
    .lte('created_at', `${fim}T23:59:59`)
    .order('created_at', { ascending: true })

  if (errClientes) throw errClientes
  if (!clientes || clientes.length === 0) return []

  // Deduplicar por telefone — manter o de maior id
  const unicosPorTelefone: Record<string, { id: number; created_at: string }> = {}
  for (const c of clientes as Cliente[]) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
      unicosPorTelefone[c.telefone] = { id: c.id, created_at: c.created_at }
    }
  }

  const telefones = Object.keys(unicosPorTelefone)
  if (telefones.length === 0) return []

  // Conta mensagens por telefone
  const { data: mensagens } = await supabase
    .from('mensagens_whatsapp')
    .select('numero_cliente')
    .in('numero_cliente', telefones)

  const contagemPorTelefone: Record<string, number> = {}
  for (const msg of mensagens ?? []) {
    contagemPorTelefone[msg.numero_cliente] = (contagemPorTelefone[msg.numero_cliente] ?? 0) + 1
  }

  // Agrupa por dia
  const porDia: Record<string, { semResposta: number; comResposta: number }> = {}
  for (const [telefone, { created_at }] of Object.entries(unicosPorTelefone)) {
    const dia = created_at.slice(0, 10)
    if (!porDia[dia]) porDia[dia] = { semResposta: 0, comResposta: 0 }
    if ((contagemPorTelefone[telefone] ?? 0) >= 3) {
      porDia[dia].comResposta++
    } else {
      porDia[dia].semResposta++
    }
  }

  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, { semResposta, comResposta }]) => ({ data, semResposta, comResposta }))
}

export async function getContagemPorStatusAtual(): Promise<{ status: string; total: number }[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('status_atual')

  if (error) throw error

  const contagem: Record<string, number> = {}
  for (const c of data ?? []) {
    if (!c.status_atual) continue  // ignora sem status
    contagem[c.status_atual] = (contagem[c.status_atual] ?? 0) + 1
  }

  return Object.entries(contagem)
    .map(([status, total]) => ({ status, total }))
    .sort((a, b) => b.total - a.total)
}

export async function getClientesComUltimaMensagem(): Promise<ClienteComUltimaMensagem[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .not('dt_ultima_mensagem', 'is', null)
    .order('dt_ultima_mensagem', { ascending: false })

  if (error) throw error

  // Deduplicar por telefone — manter o de maior id
  const unicosPorTelefone: Record<string, Cliente> = {}
  for (const c of (data ?? []) as Cliente[]) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
      unicosPorTelefone[c.telefone] = c
    }
  }

  return Object.values(unicosPorTelefone) as ClienteComUltimaMensagem[]
}

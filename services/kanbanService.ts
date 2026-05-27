import { supabase } from '@/lib/supabase'
import { KanbanSecao, Cliente } from '@/types'

export async function getSecoes(): Promise<KanbanSecao[]> {
  const { data, error } = await supabase
    .from('kanban_secoes')
    .select('*')
    .order('ordem', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function criarSecao(nome: string, facebookEvento?: string | null, cor?: string | null): Promise<KanbanSecao> {
  const { data: existentes } = await supabase
    .from('kanban_secoes')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = (existentes?.[0]?.ordem ?? -1) + 1

  const { data, error } = await supabase
    .from('kanban_secoes')
    .insert({ nome: nome.trim(), ordem: proximaOrdem, facebook_evento: facebookEvento ?? null, cor: cor ?? null })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarCorSecao(id: number, cor: string): Promise<void> {
  const { error } = await supabase
    .from('kanban_secoes')
    .update({ cor })
    .eq('id', id)

  if (error) throw error
}

export async function deletarSecao(id: number): Promise<void> {
  // Desvincula clientes da seção antes de deletar
  await supabase
    .from('clientes')
    .update({ kanban_secao_id: null })
    .eq('kanban_secao_id', id)

  const { error } = await supabase
    .from('kanban_secoes')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getClientesPorSecao(): Promise<Record<string, Cliente[]>> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true })
    .limit(1000)

  if (error) throw error

  // Deduplicar por telefone
  const unicosPorTelefone: Record<string, Cliente> = {}
  for (const c of data ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
      unicosPorTelefone[c.telefone] = c
    }
  }
  const clientes = Object.values(unicosPorTelefone)

  const grupos: Record<string, Cliente[]> = { sem_secao: [] }
  for (const c of clientes) {
    const key = c.kanban_secao_id ? String(c.kanban_secao_id) : 'sem_secao'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(c)
  }

  return grupos
}

export async function getContagemPorSecao(): Promise<{ nome: string; total: number }[]> {
  const [secoesRes, clientesRes] = await Promise.all([
    supabase.from('kanban_secoes').select('id, nome').order('ordem', { ascending: true }),
    supabase.from('clientes').select('telefone, kanban_secao_id'),
  ])

  if (secoesRes.error) throw secoesRes.error

  // Deduplicar por telefone
  const unicosPorTelefone: Record<string, { telefone: string; kanban_secao_id: number | null }> = {}
  for (const c of clientesRes.data ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone]) unicosPorTelefone[c.telefone] = c
  }
  const clientes = Object.values(unicosPorTelefone)

  const contagem: Record<string, number> = {}
  let semSecao = 0
  for (const c of clientes) {
    if (c.kanban_secao_id) contagem[c.kanban_secao_id] = (contagem[c.kanban_secao_id] ?? 0) + 1
    else semSecao++
  }

  const resultado = (secoesRes.data ?? [])
    .map((s: { id: number; nome: string }) => ({ nome: s.nome, total: contagem[s.id] ?? 0 }))
    .filter((s) => s.total > 0)

  if (semSecao > 0) resultado.push({ nome: 'Sem etapa', total: semSecao })

  return resultado
}

export async function getClientesPorStatus(): Promise<Record<string, Cliente[]>> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true })
    .limit(1000)

  if (error) throw error

  // Deduplicar por telefone
  const unicosPorTelefone: Record<string, Cliente> = {}
  for (const c of data ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || c.id > unicosPorTelefone[c.telefone].id) {
      unicosPorTelefone[c.telefone] = c
    }
  }
  const clientes = Object.values(unicosPorTelefone)

  const grupos: Record<string, Cliente[]> = {}
  for (const c of clientes) {
    const key = c.status_atual || 'sem_status'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(c)
  }

  return grupos
}

export async function moverClienteParaSecao(
  clienteId: number,
  secaoId: number | null
): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ kanban_secao_id: secaoId })
    .eq('id', clienteId)

  if (error) throw error
}

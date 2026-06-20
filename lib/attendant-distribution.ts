import { SupabaseClient } from '@supabase/supabase-js'

interface AtendentInfo {
  id: string
  nome: string
}

/**
 * Busca todos os atendentes ativos de um usuário/workspace (admin do workspace).
 * Atendentes = sub-usuários com is_attendant = true e ativo = true
 */
export async function buscarAtendentesAtivos(
  supabase: SupabaseClient,
  workspaceAdminId: string
): Promise<AtendentInfo[]> {
  console.log('[ATENDENTES] Buscando atendentes para workspace:', workspaceAdminId)

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, is_attendant, ativo, parent_id')
    .eq('parent_id', workspaceAdminId)
    .eq('is_attendant', true)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  console.log('[ATENDENTES] Query result:', { error, data, dataLength: data?.length })

  if (error) {
    console.error('[ATENDENTES] Erro ao buscar atendentes:', error)
    return []
  }

  const atendentes = (data ?? []).map(u => ({
    id: u.id,
    nome: u.nome,
  }))

  console.log('[ATENDENTES] Atendentes encontrados:', atendentes)
  return atendentes
}

/**
 * Implementa distribuição round-robin simples baseada no último assigned_user_id
 * usado neste workspace.
 *
 * Algoritmo:
 * 1. Busca o último cliente atribuído neste workspace (pelo maior id)
 * 2. Encontra a posição desse atendente na lista
 * 3. Pega o próximo atendente (com wrap-around)
 * 4. Se o último atendente já não é ativo, pega o primeiro da lista
 */
export async function distribuirAtendente(
  supabase: SupabaseClient,
  workspaceAdminId: string,
  atendentes: AtendentInfo[]
): Promise<string | null> {
  if (atendentes.length === 0) return null

  // Se só tem um atendente, retorna ele
  if (atendentes.length === 1) return atendentes[0].id

  // Busca o último cliente atribuído para este workspace para fazer round-robin
  const { data: ultimoClienteAtribuido } = await supabase
    .from('clientes')
    .select('assigned_user_id')
    .not('assigned_user_id', 'is', null)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ultimoAtendente = ultimoClienteAtribuido?.assigned_user_id

  // Se não há histórico, começa do primeiro
  if (!ultimoAtendente) {
    return atendentes[0].id
  }

  // Encontra a posição do último atendente
  const indiceUltimo = atendentes.findIndex(a => a.id === ultimoAtendente)

  // Se o último atendente não existe mais na lista, começa do primeiro
  if (indiceUltimo === -1) {
    return atendentes[0].id
  }

  // Próximo atendente (com wrap-around)
  const proximoIndice = (indiceUltimo + 1) % atendentes.length
  return atendentes[proximoIndice].id
}

/**
 * Atribui uma conversa a um atendente automaticamente.
 * Retorna true se conseguiu atribuir, false caso contrário.
 */
export async function atribuirClienteAAtendente(
  supabase: SupabaseClient,
  clienteId: number,
  workspaceAdminId: string,
  clienteNome: string,
  clienteTelefone: string
): Promise<{ atendido: boolean; atendente?: AtendentInfo }> {
  console.log('[ATRIBUICAO] Iniciando atribuição de cliente:', { clienteId, clienteNome, clienteTelefone, workspaceAdminId })

  // Busca atendentes ativos
  const atendentes = await buscarAtendentesAtivos(supabase, workspaceAdminId)

  if (atendentes.length === 0) {
    console.log(`[ATRIBUICAO] ❌ Nenhum atendente ativo para workspace ${workspaceAdminId}`)
    return { atendido: false }
  }

  console.log(`[ATRIBUICAO] ✓ Encontrados ${atendentes.length} atendentes`)

  // Distribui via round-robin
  const atendente = await distribuirAtendente(supabase, workspaceAdminId, atendentes)

  if (!atendente) {
    console.log(`[ATRIBUICAO] ❌ Erro ao distribuir atendente`)
    return { atendido: false }
  }

  console.log(`[ATRIBUICAO] ✓ Próximo atendente selecionado: ${atendente}`)

  // Atribui o cliente ao atendente
  const { error } = await supabase
    .from('clientes')
    .update({ assigned_user_id: atendente })
    .eq('id', clienteId)

  if (error) {
    console.error(`[ATRIBUICAO] ❌ Erro ao atribuir cliente ${clienteId}:`, error)
    return { atendido: false }
  }

  const atendenteFull = atendentes.find(a => a.id === atendente)
  console.log(
    `[ATRIBUICAO] ✅ Conversa atribuída automaticamente ao atendente: ${atendenteFull?.nome} (${atendente}) | Cliente: ${clienteNome} (${clienteTelefone})`
  )

  return {
    atendido: true,
    atendente: atendenteFull,
  }
}

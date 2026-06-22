import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId, getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request) // Dono do workspace
  const userId = getUsuarioId(request)  // Usuário logado
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  // Verifica se o usuário é admin (sem parent_id) ou atendente
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = !usuario.parent_id
  const isAtendente = usuario.is_attendant

  let query = supabase
    .from('clientes')
    .select('*')
    .eq('user_id', tenantId) // Sempre filtra por workspace owner

  // Se é atendente: vê apenas seus clientes
  if (!isAdmin && isAtendente) {
    query = query.eq('assigned_user_id', userId)
  }

  const { data, error } = await query
    .order('dt_ultima_mensagem', { ascending: false })

  if (error) {
    console.log('[MENSAGENS/CLIENTES] Erro ao buscar:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[MENSAGENS/CLIENTES] Clientes encontrados:', data?.length ?? 0)

  // Deduplica por telefone (mantém o de maior id)
  const unicosPorTelefone: Record<string, Record<string, unknown>> = {}
  for (const c of data ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || (c.id as number) > (unicosPorTelefone[c.telefone].id as number)) {
      unicosPorTelefone[c.telefone] = c
    }
  }

  // Ordena por dt_ultima_mensagem desc
  const clienteAcessoHeader = request.headers.get('x-cliente-acesso') ?? ''
  const acessoInfo = clienteAcessoHeader.split(',').reduce((acc, item) => {
    const [tel, timestamp] = item.split(':')
    if (tel) acc[tel] = parseInt(timestamp, 10)
    return acc
  }, {} as Record<string, number>)

  const resultado = Object.values(unicosPorTelefone)
    .map((c) => ({
      ...c,
      nao_lido: (() => {
        const telefone = c.telefone as string
        const dtUltimaMensagem = c.dt_ultima_mensagem as string
        const timestampUltimaMensagem = dtUltimaMensagem ? new Date(dtUltimaMensagem).getTime() : 0
        const timestampAcesso = acessoInfo[telefone] ?? 0
        return timestampUltimaMensagem > timestampAcesso
      })(),
    }))
    .sort((a, b) => {
      const dataA = (a.dt_ultima_mensagem as string) ?? ''
      const dataB = (b.dt_ultima_mensagem as string) ?? ''
      return new Date(dataB).getTime() - new Date(dataA).getTime()
    })

  return NextResponse.json(resultado)
}

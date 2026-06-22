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

  // Busca mensagens não lidas de cada cliente
  const mensagensNaoLidas: Record<string, number> = {}
  const { data: msgs } = await supabase
    .from('mensagens_whatsapp')
    .select('numero_cliente, lido')
    .eq('user_id', tenantId)
    .eq('quem_mandou', 'cliente')
    .eq('lido', false)

  if (msgs) {
    for (const msg of msgs) {
      const tel = (msg.numero_cliente as string).split('@')[0]
      mensagensNaoLidas[tel] = (mensagensNaoLidas[tel] ?? 0) + 1
    }
  }

  const resultado = Object.values(unicosPorTelefone)
    .map((c: any) => ({
      ...c,
      nao_lido: mensagensNaoLidas[(c.telefone as string)] > 0,
    }))
    .sort((a: any, b: any) => {
      const dataA = (a.dt_ultima_mensagem as string) ?? ''
      const dataB = (b.dt_ultima_mensagem as string) ?? ''
      return new Date(dataB).getTime() - new Date(dataA).getTime()
    })

  return NextResponse.json(resultado)
}

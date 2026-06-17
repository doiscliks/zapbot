import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  // Verifica se o usuário é admin (parent_id nulo) ou atendente
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = !usuario.parent_id // parent_id nulo = conta de topo (admin)
  const isAtendente = usuario.is_attendant

  console.log('[MENSAGENS/CLIENTES] userId:', userId, 'isAdmin:', isAdmin, 'isAtendente:', isAtendente, 'parent_id:', usuario.parent_id)

  let query = supabase
    .from('clientes')
    .select('*')
    .eq('user_id', userId)

  // Se não é admin: atendentes veem apenas clientes atribuídos a eles
  if (!isAdmin && isAtendente) {
    console.log('[MENSAGENS/CLIENTES] Filtrando por assigned_user_id:', userId)
    query = query.eq('assigned_user_id', userId)
  } else if (isAdmin) {
    console.log('[MENSAGENS/CLIENTES] Admin - vendo todos')
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
  const resultado = Object.values(unicosPorTelefone).sort((a, b) => {
    const dataA = (a.dt_ultima_mensagem as string) ?? ''
    const dataB = (b.dt_ultima_mensagem as string) ?? ''
    return new Date(dataB).getTime() - new Date(dataA).getTime()
  })

  return NextResponse.json(resultado)
}

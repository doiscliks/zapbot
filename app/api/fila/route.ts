import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId, getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request)
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  try {
    // Busca todos os atendentes ativos
    const { data: atendentes } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('parent_id', tenantId)
      .eq('is_attendant', true)
      .eq('ativo', true)
      .order('nome', { ascending: true })

    const atendentesAtivos = atendentes ?? []

    // Busca o último atendente utilizado
    const { data: ultimoClienteData } = await supabase
      .from('clientes')
      .select('assigned_user_id')
      .eq('user_id', tenantId)
      .not('assigned_user_id', 'is', null)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ultimoAtendente = ultimoClienteData?.assigned_user_id

    // Calcula o próximo atendente
    let proximoAtendente = null
    if (atendentesAtivos.length > 0) {
      const indiceUltimo = atendentesAtivos.findIndex(a => a.id === ultimoAtendente)
      const proximoIndice = indiceUltimo === -1 ? 0 : (indiceUltimo + 1) % atendentesAtivos.length
      proximoAtendente = atendentesAtivos[proximoIndice]
    }

    // Busca clientes por atendente (com count de conversas abertas)
    const { data: clientesPorAtendente } = await supabase
      .from('clientes')
      .select('assigned_user_id')
      .eq('user_id', tenantId)
      .not('assigned_user_id', 'is', null)

    const agruparPorAtendente = (clientesPorAtendente ?? []).reduce(
      (acc, cliente) => {
        const id = cliente.assigned_user_id
        if (!acc[id]) acc[id] = 0
        acc[id]++
        return acc
      },
      {} as Record<string, number>
    )

    // Enriquece atendentes com count
    const atendentesComCount = atendentesAtivos.map(a => ({
      ...a,
      clientes_count: agruparPorAtendente[a.id] ?? 0,
    }))

    // Busca clientes sem atendente
    const { data: clientesSemAtendente } = await supabase
      .from('clientes')
      .select('id, nome, telefone, dt_ultima_mensagem')
      .eq('user_id', tenantId)
      .is('assigned_user_id', null)
      .order('dt_ultima_mensagem', { ascending: true })

    // Total de clientes distribuídos
    const totalDistribuidos = clientesPorAtendente?.length ?? 0

    return NextResponse.json({
      atendentes: atendentesComCount,
      proximoAtendente,
      ordemFila: atendentesAtivos.map(a => a.id),
      clientesSemAtendente: clientesSemAtendente ?? [],
      totalClientesDistribuidos: totalDistribuidos,
      totalClientesSemAtendente: clientesSemAtendente?.length ?? 0,
    })
  } catch (error) {
    console.error('Erro ao buscar fila:', error)
    return NextResponse.json({ error: 'Erro ao buscar fila' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId, getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request)
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { cliente_id } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Verifica se cliente existe e pertence ao workspace
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome, assigned_user_id')
      .eq('id', cliente_id)
      .eq('user_id', tenantId)
      .maybeSingle()

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const atendentePrevio = cliente.assigned_user_id

    // Remove atribuição
    await supabase
      .from('clientes')
      .update({ assigned_user_id: null })
      .eq('id', cliente_id)

    // Log da ação
    console.log(`[FILA] Cliente ${cliente.nome} removido da fila de distribuição`)

    return NextResponse.json({
      success: true,
      cliente_id,
      atendente_previo: atendentePrevio,
      mensagem: `${cliente.nome} removido da distribuição`,
    })
  } catch (error) {
    console.error('Erro ao desassociar cliente:', error)
    return NextResponse.json({ error: 'Erro ao desassociar cliente' }, { status: 500 })
  }
}

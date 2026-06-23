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
    const { cliente_id, atendente_id } = body

    if (!cliente_id || !atendente_id) {
      return NextResponse.json({ error: 'cliente_id e atendente_id são obrigatórios' }, { status: 400 })
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

    // Verifica se atendente é válido e ativo
    const { data: atendente } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('id', atendente_id)
      .eq('parent_id', tenantId)
      .eq('is_attendant', true)
      .eq('ativo', true)
      .maybeSingle()

    if (!atendente) {
      return NextResponse.json({ error: 'Atendente não encontrado ou inativo' }, { status: 404 })
    }

    // Atualiza o cliente
    const jaAtribuido = cliente.assigned_user_id === atendente_id

    const { data: atualizado, error: erroUpdate } = await supabase
      .from('clientes')
      .update({ assigned_user_id: atendente_id })
      .eq('id', cliente_id)
      .eq('user_id', tenantId)
      .select('id, assigned_user_id')
      .maybeSingle()

    if (erroUpdate) {
      console.error('[FILA] Erro ao atualizar assigned_user_id:', erroUpdate)
      return NextResponse.json({ error: `Erro ao salvar associação: ${erroUpdate.message}` }, { status: 500 })
    }

    if (!atualizado || atualizado.assigned_user_id !== atendente_id) {
      console.error('[FILA] Update não confirmou a associação:', { cliente_id, atendente_id, atualizado })
      return NextResponse.json({ error: 'A associação não foi salva. Tente novamente.' }, { status: 500 })
    }

    // Log da ação
    console.log(`[FILA] Cliente ${cliente.nome} associado ${jaAtribuido ? 'novamente ' : ''}ao atendente ${atendente.nome} (manual)`)

    return NextResponse.json({
      success: true,
      cliente_id,
      atendente_id,
      atendente_nome: atendente.nome,
      mensagem: `${cliente.nome} associado a ${atendente.nome}`,
    })
  } catch (error) {
    console.error('Erro ao associar cliente:', error)
    return NextResponse.json({ error: 'Erro ao associar cliente' }, { status: 500 })
  }
}

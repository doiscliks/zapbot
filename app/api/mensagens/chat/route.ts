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

  const telefone = request.nextUrl.searchParams.get('telefone') || ''
  if (!telefone) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })

  console.log('[CHAT] Buscando mensagens:', { tenantId, userId, telefone })

  const supabase = getSupabase()
  const telefoneSemSufixo = telefone.split('@')[0]

  // Verifica permissões: se é atendente, só pode acessar conversas atribuídas a ele
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = !usuario.parent_id
  const isAtendente = usuario.is_attendant

  // Se é atendente, verifica se a conversa foi atribuída a ele
  if (!isAdmin && isAtendente) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('assigned_user_id')
      .eq('telefone', telefoneSemSufixo)
      .eq('user_id', tenantId)
      .maybeSingle()

    if (!cliente || cliente.assigned_user_id !== userId) {
      return NextResponse.json({ error: 'Sem permissão para acessar esta conversa' }, { status: 403 })
    }
  }

  const [semSufixo, comSufixo] = await Promise.all([
    supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('user_id', tenantId)
      .eq('numero_cliente', telefoneSemSufixo)
      .order('created_at', { ascending: true }),
    supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('user_id', tenantId)
      .like('numero_cliente', `${telefoneSemSufixo}@%`)
      .order('created_at', { ascending: true }),
  ])

  if (semSufixo.error) {
    console.log('[CHAT] Erro semSufixo:', semSufixo.error)
    return NextResponse.json({ error: semSufixo.error.message }, { status: 500 })
  }

  console.log('[CHAT] Resultados:', {
    telefoneSemSufixo,
    semSufixoCount: semSufixo.data?.length ?? 0,
    comSufixoCount: comSufixo.data?.length ?? 0,
  })

  const ids = new Set<string>()
  const todasMensagens = [...(semSufixo.data ?? []), ...(comSufixo.data ?? [])]
    .filter((m) => {
      if (ids.has(m.id)) return false
      ids.add(m.id)
      return true
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  console.log('[CHAT] Total de mensagens retornadas:', todasMensagens.length)

  // Marca mensagens do cliente como lidas
  const mensagensClienteNaoLidas = todasMensagens.filter((m) => m.quem_mandou === 'cliente' && !m.lido)
  if (mensagensClienteNaoLidas.length > 0) {
    const idsParaMarcar = mensagensClienteNaoLidas.map((m) => m.id)
    await supabase
      .from('mensagens_whatsapp')
      .update({ lido: true })
      .in('id', idsParaMarcar)
      .then(() => console.log('[CHAT] Marcadas como lidas:', idsParaMarcar.length))
      .catch((e) => console.log('[CHAT] Erro ao marcar como lidas:', e))
  }

  return NextResponse.json(todasMensagens)
}

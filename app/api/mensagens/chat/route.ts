import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const telefone = request.nextUrl.searchParams.get('telefone') || ''
  if (!telefone) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })

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
      .eq('user_id', userId)
      .maybeSingle()

    if (!cliente || cliente.assigned_user_id !== userId) {
      return NextResponse.json({ error: 'Sem permissão para acessar esta conversa' }, { status: 403 })
    }
  }

  const [semSufixo, comSufixo] = await Promise.all([
    supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('user_id', userId)
      .eq('numero_cliente', telefoneSemSufixo)
      .order('data_criacao', { ascending: true }),
    supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('user_id', userId)
      .like('numero_cliente', `${telefoneSemSufixo}@%`)
      .order('data_criacao', { ascending: true }),
  ])

  if (semSufixo.error) return NextResponse.json({ error: semSufixo.error.message }, { status: 500 })

  const ids = new Set<string>()
  const todasMensagens = [...(semSufixo.data ?? []), ...(comSufixo.data ?? [])]
    .filter((m) => {
      if (ids.has(m.id)) return false
      ids.add(m.id)
      return true
    })
    .sort((a, b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime())

  return NextResponse.json(todasMensagens)
}

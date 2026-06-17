import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function verificarPermissao(userId: string, clienteId: number) {
  const supabase = getSupabase()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('user_id, assigned_user_id')
    .eq('id', clienteId)
    .single()

  if (!cliente) return { permitido: false, erro: 'Cliente não encontrado' }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id')
    .eq('id', userId)
    .single()

  if (!usuario) return { permitido: false, erro: 'Usuário não encontrado' }

  const isAdmin = !usuario.parent_id
  const isClienteDoAtendente = cliente.assigned_user_id === userId
  const isOwner = cliente.user_id === userId

  if (!isAdmin && !isClienteDoAtendente && !isOwner) {
    return { permitido: false, erro: 'Sem permissão' }
  }

  return { permitido: true }
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clienteId, etiquetaId } = await request.json()
  if (!clienteId || !etiquetaId) {
    return NextResponse.json({ error: 'clienteId e etiquetaId obrigatórios' }, { status: 400 })
  }

  const permissao = await verificarPermissao(userId, clienteId)
  if (!permissao.permitido) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.erro === 'Sem permissão' ? 403 : 404 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('cliente_etiquetas')
    .insert({ cliente_id: clienteId, etiqueta_id: etiquetaId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Etiqueta já associada' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clienteId, etiquetaId } = await request.json()
  if (!clienteId || !etiquetaId) {
    return NextResponse.json({ error: 'clienteId e etiquetaId obrigatórios' }, { status: 400 })
  }

  const permissao = await verificarPermissao(userId, clienteId)
  if (!permissao.permitido) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.erro === 'Sem permissão' ? 403 : 404 })
  }

  const supabase = getSupabase()

  const { error } = await supabase
    .from('cliente_etiquetas')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('etiqueta_id', etiquetaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

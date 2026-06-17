import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const supabase = getSupabase()

  // Verifica permissão: busca o cliente
  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (clienteError) return NextResponse.json({ error: clienteError.message }, { status: 500 })
  if (!cliente) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Se atendente, verifica se o cliente está atribuído a ele
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  const isAdmin = !usuario?.parent_id
  if (!isAdmin && usuario?.is_attendant && cliente.assigned_user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(cliente)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await request.json()
  const campos: Record<string, unknown> = {}

  // Campos permitidos para atualização
  const camposPermitidos = ['email', 'cpf_cnpj', 'empresa', 'endereco', 'cidade', 'numero_endereco', 'complemento', 'bairro', 'cep', 'cargo', 'notas', 'data_nascimento', 'ia_desabilitada', 'historico', 'assigned_user_id']
  for (const campo of camposPermitidos) {
    if (campo in body) campos[campo] = body[campo]
  }

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  campos.updated_at = new Date().toISOString()

  const supabase = getSupabase()

  // Verifica permissão
  const { data: cliente } = await supabase
    .from('clientes')
    .select('assigned_user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!cliente) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  const isAdmin = !usuario?.parent_id
  if (!isAdmin && usuario?.is_attendant && cliente.assigned_user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('clientes')
    .update(campos)
    .eq('id', id)
    .eq('user_id', userId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Busca o cliente atualizado
  const { data, error: fetchError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabase()

  // Verifica permissão
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
    .eq('user_id', userId)
    .eq('id', id)

  // Se é atendente: só pode ver seus clientes
  if (!isAdmin && isAtendente) {
    query = query.eq('assigned_user_id', userId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = getSupabase()

  // Verifica permissão
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id, is_attendant')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = !usuario.parent_id
  const isAtendente = usuario.is_attendant

  // Verifica se tem acesso ao cliente
  let checkQuery = supabase
    .from('clientes')
    .select('id')
    .eq('user_id', userId)
    .eq('id', id)

  if (!isAdmin && isAtendente) {
    checkQuery = checkQuery.eq('assigned_user_id', userId)
  }

  const { data: clienteExiste } = await checkQuery.maybeSingle()
  if (!clienteExiste) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  // Campos que podem ser editados
  const camposPermitidos = [
    'nome',
    'telefone',
    'email',
    'endereco',
    'numero_endereco',
    'complemento',
    'bairro',
    'cidade',
    'cep',
    'cpf_cnpj',
    'empresa',
    'cargo',
    'notas',
    'data_nascimento',
    'ia_desabilitada',
  ]

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const campo of camposPermitidos) {
    if (body[campo] !== undefined) {
      update[campo] = body[campo] === '' ? null : body[campo]
    }
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clientes')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

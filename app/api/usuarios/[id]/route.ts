import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { temPermissao, SCREEN_KEYS } from '@/lib/permissoes'
import { hashPassword } from '@/lib/password'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

function normalizarPermissoes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((k): k is string => typeof k === 'string' && SCREEN_KEYS.includes(k))
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = getTenantId(request)
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await temPermissao(request, 'usuarios'))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const supabase = getSupabase()

  // Garante que o alvo é um sub-usuário deste workspace
  const { data: alvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('parent_id', ownerId)
    .maybeSingle()
  if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (typeof body.nome === 'string') update.nome = body.nome.trim()
  if (body.telefone !== undefined) update.telefone = (body.telefone || '').trim() || null
  if (body.permissoes !== undefined) update.permissoes = normalizarPermissoes(body.permissoes)
  if (typeof body.ativo === 'boolean') update.ativo = body.ativo
  if (typeof body.is_attendant === 'boolean') update.is_attendant = body.is_attendant
  if (body.senha) {
    if (String(body.senha).length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres' }, { status: 400 })
    }
    update.senha_hash = await hashPassword(body.senha)
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })

  const { data, error } = await supabase
    .from('usuarios')
    .update(update)
    .eq('id', id)
    .eq('parent_id', ownerId)
    .select('id, nome, email, telefone, permissoes, ativo, is_attendant, usado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = getTenantId(request)
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await temPermissao(request, 'usuarios'))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const supabase = getSupabase()

  // Garante que o alvo é um sub-usuário deste workspace
  const { data: alvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('parent_id', ownerId)
    .maybeSingle()
  if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Verifica se tem clientes vinculados
  const { data: clientesVinculados } = await supabase
    .from('clientes')
    .select('id', { count: 'exact' })
    .eq('assigned_user_id', id)

  if ((clientesVinculados?.length ?? 0) > 0) {
    return NextResponse.json({
      error: 'Usuário tem clientes vinculados',
      code: 'CLIENTES_VINCULADOS',
      clientesCount: clientesVinculados?.length ?? 0,
    }, { status: 409 })
  }

  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', id)
    .eq('parent_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

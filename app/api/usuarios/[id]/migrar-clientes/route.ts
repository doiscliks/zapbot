import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { temPermissao } from '@/lib/permissoes'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = getTenantId(request)
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await temPermissao(request, 'usuarios'))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const { novoAtendente } = await request.json()

  if (!novoAtendente) {
    return NextResponse.json({ error: 'novoAtendente é obrigatório' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Garante que o usuário original é um sub-usuário deste workspace
  const { data: usuarioOriginal } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('id', id)
    .eq('parent_id', ownerId)
    .maybeSingle()
  if (!usuarioOriginal) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Garante que o novo atendente é um sub-usuário deste workspace e é atendente
  const { data: novoAtendenteDados } = await supabase
    .from('usuarios')
    .select('id, nome, is_attendant, ativo')
    .eq('id', novoAtendente)
    .eq('parent_id', ownerId)
    .maybeSingle()
  if (!novoAtendenteDados) {
    return NextResponse.json({ error: 'Novo atendente não encontrado' }, { status: 404 })
  }
  if (!novoAtendenteDados.is_attendant || !novoAtendenteDados.ativo) {
    return NextResponse.json({ error: 'Novo atendente não é ativo ou não é atendente' }, { status: 400 })
  }

  // Atualiza todos os clientes vinculados ao usuário original
  const { error: updateErr, data: updated } = await supabase
    .from('clientes')
    .update({ assigned_user_id: novoAtendente })
    .eq('assigned_user_id', id)
    .select('id')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  console.log(
    `[Migração de Clientes] ${(updated?.length ?? 0)} clientes transferidos de "${usuarioOriginal.nome}" para "${novoAtendenteDados.nome}"`
  )

  return NextResponse.json({
    ok: true,
    clientesMigrados: updated?.length ?? 0,
    deAtendente: usuarioOriginal.nome,
    paraAtendente: novoAtendenteDados.nome,
  })
}

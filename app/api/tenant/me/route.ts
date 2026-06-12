import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId, getUsuarioId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  const usuarioId = getUsuarioId(request)
  const ownerId = getTenantId(request)
  if (!usuarioId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  // Identidade + permissões vêm do usuário logado de fato
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, ativo, parent_id, permissoes, validade')
    .eq('id', usuarioId)
    .single()

  // Sessão temporária (sem chave vinculada ainda)
  if (!data) {
    return NextResponse.json({ needsKey: true })
  }

  if (!data.ativo) {
    return NextResponse.json({ error: 'Conta desativada' }, { status: 401 })
  }

  // A janela de acesso (validade) é a do dono do workspace
  let validade = data.validade
  if (ownerId && ownerId !== data.id) {
    const { data: owner } = await supabase.from('usuarios').select('validade').eq('id', ownerId).single()
    validade = owner?.validade ?? validade
  }
  if (validade && new Date(validade) < new Date()) {
    return NextResponse.json({ keyExpired: true, nome: data.nome })
  }

  const isAdmin = !data.parent_id
  return NextResponse.json({
    ok: true,
    id: data.id,
    nome: data.nome,
    email: data.email,
    parent_id: data.parent_id ?? null,
    isAdmin,
    permissoes: isAdmin ? '*' : (data.permissoes ?? []),
  })
}

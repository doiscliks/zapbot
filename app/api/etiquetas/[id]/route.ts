import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabase()

  // Verifica se é dono da etiqueta
  const { data: etiqueta } = await supabase
    .from('etiquetas')
    .select('criado_por')
    .eq('id', id)
    .single()

  if (!etiqueta) return NextResponse.json({ error: 'Etiqueta não encontrada' }, { status: 404 })

  // Só o criador ou admin pode deletar
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('parent_id')
    .eq('id', userId)
    .single()

  const isAdmin = !usuario?.parent_id
  const isOwner = etiqueta.criado_por === userId

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Remove todas as associações primeiro
  await supabase
    .from('cliente_etiquetas')
    .delete()
    .eq('etiqueta_id', id)

  // Deleta a etiqueta
  const { error } = await supabase
    .from('etiquetas')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

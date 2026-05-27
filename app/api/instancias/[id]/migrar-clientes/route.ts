import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// POST /api/instancias/[id]/migrar-clientes
// Body: { de_instancia_id: string }
// Migra os clientes da instância origem para a instância [id] (destino)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: destinoId } = await params
  const { de_instancia_id: origemId } = await request.json()

  if (!origemId) return NextResponse.json({ error: 'de_instancia_id é obrigatório' }, { status: 400 })
  if (origemId === destinoId) return NextResponse.json({ error: 'Origem e destino são iguais' }, { status: 400 })

  const supabase = getSupabase()

  // Verifica que ambas as instâncias pertencem ao usuário
  const [{ data: origem }, { data: destino }] = await Promise.all([
    supabase.from('instancias_whatsapp').select('token, nome').eq('id', origemId).eq('user_id', userId).single(),
    supabase.from('instancias_whatsapp').select('token, nome').eq('id', destinoId).eq('user_id', userId).single(),
  ])

  if (!origem) return NextResponse.json({ error: 'Instância de origem não encontrada' }, { status: 404 })
  if (!destino) return NextResponse.json({ error: 'Instância de destino não encontrada' }, { status: 404 })

  // Conta quantos clientes serão migrados
  const { count } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('instancia_id', origem.token)
    .eq('user_id', userId)

  // Migra
  const { error } = await supabase
    .from('clientes')
    .update({ instancia_id: destino.token })
    .eq('instancia_id', origem.token)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, migrados: count ?? 0 })
}

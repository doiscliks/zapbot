import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rotatorId } = await params
  const { url, nome, whatsapp_group_id } = await request.json()
  const supabase = getSupabase()

  // Verifica que o rotator pertence ao usuário
  const { data: rotator } = await supabase.from('grupos_rotators').select('id').eq('id', rotatorId).eq('user_id', userId).single()
  if (!rotator) return NextResponse.json({ error: 'Rotator não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('grupos_links')
    .insert({ rotator_id: rotatorId, url, nome: nome?.trim() || null, whatsapp_group_id: whatsapp_group_id?.trim() || null, user_id: userId })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  // Verifica se o usuário é admin (parent_id nulo) ou atendente
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

  // Se não é admin: atendentes veem apenas clientes atribuídos a eles
  if (!isAdmin && isAtendente) {
    query = query.eq('assigned_user_id', userId)
  }

  const { data, error } = await query.order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

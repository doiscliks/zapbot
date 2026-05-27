import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase
    .from('base_conhecimento')
    .select('*')
    .eq('user_id', userId)
    .order('gerado_em', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Nenhuma base de conhecimento encontrada.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('treinamento_prompt')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conteudo: data?.conteudo ?? '' })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conteudo } = await request.json()
  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from('treinamento_prompt')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('treinamento_prompt')
      .update({ conteudo, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('treinamento_prompt')
      .insert({ conteudo, user_id: userId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

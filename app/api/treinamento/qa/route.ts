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
    .from('treinamento_qa')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pergunta, resposta } = await request.json()
  if (!pergunta?.trim() || !resposta?.trim()) {
    return NextResponse.json({ error: 'Pergunta e resposta são obrigatórias' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('treinamento_qa')
    .insert({ pergunta: pergunta.trim(), resposta: resposta.trim(), user_id: userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

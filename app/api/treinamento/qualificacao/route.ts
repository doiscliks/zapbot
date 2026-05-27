import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('kanban_qualificacao')
    .select('ativo, secoes_config')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ativo: data?.ativo ?? false,
    secoes_config: data?.secoes_config ?? [],
  })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const supabase = getSupabase()

  // Suporta atualização parcial: envia apenas os campos presentes no body
  const campos: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() }
  if (body.ativo !== undefined) campos.ativo = body.ativo
  if (body.secoes_config !== undefined) campos.secoes_config = body.secoes_config

  const { error } = await supabase
    .from('kanban_qualificacao')
    .upsert(campos, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

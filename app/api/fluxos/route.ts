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
    .from('flows')
    .select('id, name, description, status, flow_type, trigger_type, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Busca contagem de execuções
  const flowIds = (data ?? []).map(f => f.id)
  let execCounts: Record<string, number> = {}
  if (flowIds.length > 0) {
    const { data: execs } = await supabase
      .from('flow_executions')
      .select('flow_id')
      .in('flow_id', flowIds)
    if (execs) {
      execs.forEach(e => { execCounts[e.flow_id] = (execCounts[e.flow_id] ?? 0) + 1 })
    }
  }

  return NextResponse.json((data ?? []).map(f => ({ ...f, execution_count: execCounts[f.id] ?? 0 })))
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const {
    name,
    description = '',
    flow_type = 'chatbot',
    trigger_type = 'nova_mensagem',
    trigger_config = {},
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const supabase = getSupabase()

  const { data: flow, error } = await supabase
    .from('flows')
    .insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      status: 'rascunho',
      flow_type,
      trigger_type,
      trigger_config,
      schedule_config: {},
      contact_filters: {},
      whatsapp_instance_id: null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cria nó inicial com o trigger configurado no wizard
  await supabase.from('flow_nodes').insert({
    flow_id: flow.id,
    type: 'start',
    position_x: 300,
    position_y: 100,
    data: {
      nodeType: 'start',
      label: 'Início',
      trigger_type,
      keyword: (trigger_config as Record<string, unknown>).keyword ?? '',
    },
  })

  return NextResponse.json({ id: flow.id })
}

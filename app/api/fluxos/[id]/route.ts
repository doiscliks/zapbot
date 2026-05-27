import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabase()

  const [flowRes, nodesRes, edgesRes] = await Promise.all([
    supabase.from('flows').select('*').eq('id', id).eq('user_id', userId).single(),
    supabase.from('flow_nodes').select('*').eq('flow_id', id).order('created_at'),
    supabase.from('flow_edges').select('*').eq('flow_id', id),
  ])

  if (flowRes.error || !flowRes.data) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

  return NextResponse.json({ ...flowRes.data, nodes: nodesRes.data ?? [], edges: edgesRes.data ?? [] })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const { nodes = [], edges = [], ...meta } = body
  const supabase = getSupabase()

  const { error: flowErr } = await supabase
    .from('flows')
    .update({
      name: meta.name,
      description: meta.description,
      status: meta.status,
      flow_type: meta.flow_type,
      trigger_type: meta.trigger_type,
      trigger_config: meta.trigger_config ?? {},
      whatsapp_instance_id: meta.whatsapp_instance_id || null,
      schedule_config: meta.schedule_config ?? {},
      contact_filters: meta.contact_filters ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (flowErr) return NextResponse.json({ error: flowErr.message }, { status: 500 })

  // Batch replace nodes and edges
  await supabase.from('flow_nodes').delete().eq('flow_id', id)
  await supabase.from('flow_edges').delete().eq('flow_id', id)

  if (nodes.length > 0) {
    await supabase.from('flow_nodes').insert(
      nodes.map((n: Record<string, unknown>) => ({
        id: n.id,
        flow_id: id,
        type: n.type,
        position_x: n.position_x,
        position_y: n.position_y,
        data: n.data,
      }))
    )
  }

  if (edges.length > 0) {
    await supabase.from('flow_edges').insert(
      edges.map((e: Record<string, unknown>) => ({
        id: e.id ?? crypto.randomUUID(),
        flow_id: id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        source_handle: e.source_handle ?? null,
        target_handle: e.target_handle ?? null,
        condition_label: e.condition_label ?? null,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const supabase = getSupabase()

  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) campos.status = body.status
  if (body.name !== undefined) campos.name = body.name

  const { error } = await supabase.from('flows').update(campos).eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabase()

  const { error } = await supabase.from('flows').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

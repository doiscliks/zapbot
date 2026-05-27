import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabase()

  const [flowRes, nodesRes, edgesRes] = await Promise.all([
    supabase.from('flows').select('*').eq('id', id).eq('user_id', userId).single(),
    supabase.from('flow_nodes').select('*').eq('flow_id', id),
    supabase.from('flow_edges').select('*').eq('flow_id', id),
  ])

  if (!flowRes.data) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

  const { data: novoFlow, error } = await supabase
    .from('flows')
    .insert({ ...flowRes.data, id: undefined, name: `${flowRes.data.name} (cópia)`, status: 'inactive', created_at: undefined, updated_at: undefined })
    .select('id')
    .single()

  if (error || !novoFlow) return NextResponse.json({ error: error?.message }, { status: 500 })

  const nodeIdMap: Record<string, string> = {}
  const novosNodes = (nodesRes.data ?? []).map(n => {
    const newId = crypto.randomUUID()
    nodeIdMap[n.id] = newId
    return { ...n, id: newId, flow_id: novoFlow.id, created_at: undefined }
  })

  if (novosNodes.length > 0) await supabase.from('flow_nodes').insert(novosNodes)

  const novosEdges = (edgesRes.data ?? []).map(e => ({
    ...e,
    id: crypto.randomUUID(),
    flow_id: novoFlow.id,
    source_node_id: nodeIdMap[e.source_node_id] ?? e.source_node_id,
    target_node_id: nodeIdMap[e.target_node_id] ?? e.target_node_id,
    created_at: undefined,
  }))

  if (novosEdges.length > 0) await supabase.from('flow_edges').insert(novosEdges)

  return NextResponse.json({ id: novoFlow.id })
}

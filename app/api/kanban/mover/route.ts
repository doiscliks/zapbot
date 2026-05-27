import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { dispatchKanbanFlows } from '@/lib/flow-executor'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clienteId, secaoId } = await request.json()
  const supabase = getSupabase()

  const { error } = await supabase
    .from('clientes')
    .update({ kanban_secao_id: secaoId ?? null })
    .eq('id', clienteId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dispara fluxos vinculados a esta coluna (fire-and-forget)
  if (secaoId) {
    dispatchKanbanFlows(supabase, userId, clienteId, secaoId).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}

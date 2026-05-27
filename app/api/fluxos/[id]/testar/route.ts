import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { startFlowExecution } from '@/lib/flow-executor'
import { readTenantConfig } from '@/lib/tenant-config'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { telefone } = await request.json()
  if (!telefone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
  const supabase = getSupabase()

  const [flowRes, tenantConfig] = await Promise.all([
    supabase.from('flows').select('*').eq('id', id).eq('user_id', userId).single(),
    readTenantConfig(userId),
  ])

  if (!flowRes.data) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

  // Busca instância do usuário para envio
  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token, uazapi_url')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const result = await startFlowExecution(supabase, flowRes.data, null, telefone, '', {
    userId,
    instanciaToken: instancia?.token ?? '',
    uazapiBase: (instancia?.uazapi_url ?? '').replace(/\/+$/, ''),
    openaiKey: tenantConfig?.openaiKey ?? '',
  })

  return NextResponse.json({ ok: true, executionId: result.executionId })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { readTenantConfig } from '@/lib/tenant-config'
import { continueExecution } from '@/lib/flow-executor'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  const secret = process.env.PROCESS_QUEUE_SECRET || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Busca todas as execuções atrasadas prontas para retomar
  const { data: delayed } = await supabase
    .from('flow_executions')
    .select('*, flows!inner(user_id, whatsapp_instance_id, status)')
    .eq('status', 'delayed')
    .lte('resume_at', new Date().toISOString())
    .eq('flows.status', 'active')
    .limit(50)

  if (!delayed || delayed.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Marca como running imediatamente para evitar duplo processamento
  await supabase
    .from('flow_executions')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .in('id', delayed.map(e => e.id))

  const config = await readConfig()
  const base = (config.uazapiUrl || '').replace(/\/+$/, '').replace(/\/send\/.*$/, '')

  // Cache de tenant configs para não buscar o mesmo userId várias vezes
  const tenantCache: Record<string, { openaiKey: string; instanciaToken: string }> = {}

  let processed = 0

  for (const exec of delayed) {
    try {
      const userId = exec.flows?.user_id as string
      if (!userId) continue

      if (!tenantCache[userId]) {
        const tenantConfig = await readTenantConfig(userId)
        const openaiKey = tenantConfig?.openaiKey || ''

        // Resolve token da instância: prioriza whatsapp_instance_id do fluxo, senão lead
        let instanciaToken = ''
        const instanceId = exec.flows?.whatsapp_instance_id as string | null
        if (instanceId) {
          const { data: inst } = await supabase
            .from('instancias_whatsapp')
            .select('token')
            .eq('id', instanceId)
            .maybeSingle()
          instanciaToken = inst?.token || ''
        }
        if (!instanciaToken && exec.lead_id) {
          const { data: lead } = await supabase
            .from('clientes')
            .select('instancia_id')
            .eq('id', exec.lead_id)
            .maybeSingle()
          instanciaToken = (lead?.instancia_id as string) || ''
        }

        tenantCache[userId] = { openaiKey, instanciaToken }
      }

      const { openaiKey, instanciaToken } = tenantCache[userId]

      await continueExecution(supabase, exec, '', {
        userId,
        instanciaToken,
        uazapiBase: base,
        openaiKey,
      })

      processed++
    } catch {
      // Marca como falha para não ficar preso
      await supabase
        .from('flow_executions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', exec.id)
    }
  }

  return NextResponse.json({ processed, total: delayed.length })
}

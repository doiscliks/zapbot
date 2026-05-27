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
    .from('clientes')
    .select('*')
    .eq('user_id', userId)
    .not('dt_ultima_mensagem', 'is', null)
    .order('dt_ultima_mensagem', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplica por telefone (mantém o de maior id)
  const unicosPorTelefone: Record<string, Record<string, unknown>> = {}
  for (const c of data ?? []) {
    if (!c.telefone) continue
    if (!unicosPorTelefone[c.telefone] || (c.id as number) > (unicosPorTelefone[c.telefone].id as number)) {
      unicosPorTelefone[c.telefone] = c
    }
  }

  // Ordena por dt_ultima_mensagem desc
  const resultado = Object.values(unicosPorTelefone).sort((a, b) => {
    const dataA = (a.dt_ultima_mensagem as string) ?? ''
    const dataB = (b.dt_ultima_mensagem as string) ?? ''
    return new Date(dataB).getTime() - new Date(dataA).getTime()
  })

  return NextResponse.json(resultado)
}

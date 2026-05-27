import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

const ETAPAS_FUNIL = [
  { event_name: 'Lead', label: 'Lead', cor: '#6366f1' },
  { event_name: 'Contact', label: 'Contato', cor: '#3b82f6' },
  { event_name: 'ViewContent', label: 'Interesse', cor: '#f59e0b' },
  { event_name: 'InitiateCheckout', label: 'Checkout', cor: '#f97316' },
  { event_name: 'AddToCart', label: 'Carrinho', cor: '#ec4899' },
  { event_name: 'Purchase', label: 'Compra', cor: '#22c55e' },
]

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  const supabase = getSupabase()
  let query = supabase.from('eventos_funil').select('event_name, telefone, valor').eq('user_id', userId)
  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contagem: Record<string, Set<string>> = {}
  const valores: Record<string, number> = {}
  for (const row of data ?? []) {
    if (!contagem[row.event_name]) contagem[row.event_name] = new Set()
    contagem[row.event_name].add(row.telefone)
    valores[row.event_name] = (valores[row.event_name] ?? 0) + (row.valor ?? 0)
  }

  const resultado = ETAPAS_FUNIL.map((etapa, i) => {
    const total = contagem[etapa.event_name]?.size ?? 0
    const anterior = i > 0 ? (contagem[ETAPAS_FUNIL[i - 1].event_name]?.size ?? 0) : null
    const conversao = anterior && anterior > 0 ? Math.round((total / anterior) * 100) : null
    return { ...etapa, total, conversao, valor: valores[etapa.event_name] ?? 0 }
  })

  return NextResponse.json(resultado)
}

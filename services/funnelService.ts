import { supabase } from '@/lib/supabase'

export const ETAPAS_FUNIL = [
  { event_name: 'Lead', label: 'Lead', cor: '#6366f1' },
  { event_name: 'Contact', label: 'Contato', cor: '#3b82f6' },
  { event_name: 'ViewContent', label: 'Interesse', cor: '#f59e0b' },
  { event_name: 'InitiateCheckout', label: 'Checkout', cor: '#f97316' },
  { event_name: 'AddToCart', label: 'Carrinho', cor: '#ec4899' },
  { event_name: 'Purchase', label: 'Compra', cor: '#22c55e' },
]

export interface EtapaFunil {
  event_name: string
  label: string
  cor: string
  total: number
  conversao: number | null
  valor: number
}

export async function getDadosFunil(startDate?: string, endDate?: string): Promise<EtapaFunil[]> {
  let query = supabase
    .from('eventos_funil')
    .select('event_name, telefone, valor')

  if (startDate) query = query.gte('created_at', startDate + 'T00:00:00')
  if (endDate) query = query.lte('created_at', endDate + 'T23:59:59')

  const { data, error } = await query

  if (error) throw error

  // Contar telefones únicos e somar valores por etapa
  const contagem: Record<string, Set<string>> = {}
  const valores: Record<string, number> = {}

  for (const row of data ?? []) {
    if (!contagem[row.event_name]) contagem[row.event_name] = new Set()
    contagem[row.event_name].add(row.telefone)
    valores[row.event_name] = (valores[row.event_name] ?? 0) + (row.valor ?? 0)
  }

  return ETAPAS_FUNIL.map((etapa, i) => {
    const total = contagem[etapa.event_name]?.size ?? 0
    const anterior = i > 0 ? (contagem[ETAPAS_FUNIL[i - 1].event_name]?.size ?? 0) : null
    const conversao = anterior && anterior > 0 ? Math.round((total / anterior) * 100) : null
    const valor = valores[etapa.event_name] ?? 0
    return { ...etapa, total, conversao, valor }
  })
}

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function initSupabaseClient(url: string, key: string) {
  _client = createClient(url, key)
}

function getClient(): SupabaseClient {
  if (_client) return _client

  // Fallback para variáveis de ambiente (compatibilidade)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  _client = createClient(url, key)
  return _client
}

// Proxy transparente — todo código existente continua funcionando sem mudança
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    const client = getClient()
    const value = client[prop as keyof SupabaseClient]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})

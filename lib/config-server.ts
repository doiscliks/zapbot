import { createClient } from '@supabase/supabase-js'

export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  uazapiUrl: string
  uazapiToken: string
  openaiKey: string
  fbPixelId: string
  fbAccessToken: string
  fbTestEventCode: string
  fbAdsToken: string
  fbAdAccountId: string
  instanciasPermitidas: string
}

function getSupabaseForConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export function getSupabaseEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  }
}

export async function readConfig(): Promise<AppConfig> {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  let uazapiUrl = process.env.UAZAPI_URL || ''
  let uazapiToken = process.env.UAZAPI_TOKEN || ''
  let openaiKey = process.env.OPENAI_API_KEY || ''
  let fbPixelId = process.env.FB_PIXEL_ID || ''
  let fbAccessToken = process.env.FB_ACCESS_TOKEN || ''
  let fbTestEventCode = process.env.FB_TEST_EVENT_CODE || ''
  let fbAdsToken = process.env.FB_ADS_TOKEN || ''
  let fbAdAccountId = process.env.FB_AD_ACCOUNT_ID || ''
  let instanciasPermitidas = '1'

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = getSupabaseForConfig()
      const { data } = await supabase.from('configuracoes').select('chave, valor')
      if (data) {
        for (const row of data) {
          if (row.chave === 'uazapi_url' && row.valor) uazapiUrl = row.valor
          if (row.chave === 'uazapi_token' && row.valor) uazapiToken = row.valor
          if (row.chave === 'openai_key' && row.valor) openaiKey = row.valor
          if (row.chave === 'fb_pixel_id' && row.valor) fbPixelId = row.valor
          if (row.chave === 'fb_access_token' && row.valor) fbAccessToken = row.valor
          if (row.chave === 'fb_test_event_code' && row.valor) fbTestEventCode = row.valor
          if (row.chave === 'fb_ads_token' && row.valor) fbAdsToken = row.valor
          if (row.chave === 'fb_ad_account_id' && row.valor) fbAdAccountId = row.valor
          if (row.chave === 'instancias_permitidas' && row.valor) instanciasPermitidas = row.valor
        }
      }
    } catch { /* ignora */ }
  }

  return { supabaseUrl, supabaseAnonKey, uazapiUrl, uazapiToken, openaiKey, fbPixelId, fbAccessToken, fbTestEventCode, fbAdsToken, fbAdAccountId, instanciasPermitidas }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  // Usa as credenciais do próprio config (vindas do formulário) para conectar ao Supabase
  const url = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = config.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!url || !key) throw new Error('URL e Anon Key do Supabase são obrigatórios.')

  const supabase = createClient(url, key)

  const entries = [
    { chave: 'uazapi_url', valor: config.uazapiUrl },
    { chave: 'uazapi_token', valor: config.uazapiToken },
    { chave: 'openai_key', valor: config.openaiKey },
    { chave: 'fb_pixel_id', valor: config.fbPixelId },
    { chave: 'fb_access_token', valor: config.fbAccessToken },
    { chave: 'fb_test_event_code', valor: config.fbTestEventCode },
    { chave: 'fb_ads_token', valor: config.fbAdsToken },
    { chave: 'fb_ad_account_id', valor: config.fbAdAccountId },
    { chave: 'instancias_permitidas', valor: config.instanciasPermitidas },
  ]

  for (const entry of entries) {
    await supabase.from('configuracoes').upsert(entry, { onConflict: 'chave' })
  }
}

export function isConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return !!(url && key)
}

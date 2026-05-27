import { createClient } from '@supabase/supabase-js'

export interface TenantConfig {
  openaiKey: string
  fbPixelId: string
  fbAccessToken: string
  fbTestEventCode: string
  fbAdsToken: string
  fbAdAccountId: string
  iaAtiva: boolean
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function readTenantConfig(userId: string): Promise<TenantConfig> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('configuracoes_usuario')
    .select('*')
    .eq('user_id', userId)
    .single()

  return {
    openaiKey: data?.openai_key || '',
    fbPixelId: data?.fb_pixel_id || '',
    fbAccessToken: data?.fb_access_token || '',
    fbTestEventCode: data?.fb_test_event_code || '',
    fbAdsToken: data?.fb_ads_token || '',
    fbAdAccountId: data?.fb_ad_account_id || '',
    iaAtiva: data?.ia_ativa !== false,
  }
}

export async function writeTenantConfig(userId: string, config: Partial<TenantConfig>): Promise<void> {
  const supabase = getSupabase()
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() }

  if (config.openaiKey !== undefined) row.openai_key = config.openaiKey
  if (config.fbPixelId !== undefined) row.fb_pixel_id = config.fbPixelId
  if (config.fbAccessToken !== undefined) row.fb_access_token = config.fbAccessToken
  if (config.fbTestEventCode !== undefined) row.fb_test_event_code = config.fbTestEventCode
  if (config.fbAdsToken !== undefined) row.fb_ads_token = config.fbAdsToken
  if (config.fbAdAccountId !== undefined) row.fb_ad_account_id = config.fbAdAccountId
  if (config.iaAtiva !== undefined) row.ia_ativa = config.iaAtiva

  await supabase
    .from('configuracoes_usuario')
    .upsert(row, { onConflict: 'user_id' })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'
import { readTenantConfig, TenantConfig } from '@/lib/tenant-config'

const FB_API_VERSION = 'v21.0'
const ACTION_MENSAGEM = 'onsite_conversion.messaging_conversation_started_7d'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function getUazapiBase(uazapiUrl: string): string {
  try {
    const u = new URL(uazapiUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return uazapiUrl.replace(/\/+$/, '').replace(/\/(send|group|message|chat|instance).*$/, '')
  }
}

function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataDeOntemBR(): { since: string; until: string; label: string } {
  const agora = new Date()
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  const since = ontem.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD
  const label = ontem.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return { since, until: since, label }
}

type Resultado = { userId: string; ok: boolean; motivo?: string }

async function enviarRelatorioDoTenant(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  config: TenantConfig
): Promise<Resultado> {
  if (!config.fbAdsToken || !config.fbAdAccountId) {
    return { userId, ok: false, motivo: 'Facebook Ads não configurado' }
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('telefone')
    .eq('id', userId)
    .maybeSingle()

  if (!usuario?.telefone) {
    return { userId, ok: false, motivo: 'Telefone do usuário não cadastrado' }
  }

  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('user_id', userId)
    .eq('status', 'conectado')
    .limit(1)
    .maybeSingle()

  if (!instancia?.token) {
    return { userId, ok: false, motivo: 'Nenhuma instância WhatsApp conectada' }
  }

  const appConfig = await readConfig()
  if (!appConfig.uazapiUrl) {
    return { userId, ok: false, motivo: 'UAZAPI não configurada' }
  }

  const { since, until, label } = dataDeOntemBR()
  const accountId = config.fbAdAccountId.startsWith('act_')
    ? config.fbAdAccountId
    : `act_${config.fbAdAccountId}`

  const fields = ['spend', 'clicks', 'actions', 'cost_per_action_type'].join(',')
  const params = new URLSearchParams({
    level: 'account',
    fields,
    time_range: JSON.stringify({ since, until }),
    access_token: config.fbAdsToken,
  })

  const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights?${params}`)
  const fbJson = await fbRes.json()

  if (!fbRes.ok) {
    return { userId, ok: false, motivo: `Erro ao buscar dados do Facebook: ${JSON.stringify(fbJson)}` }
  }

  const row = fbJson.data?.[0]
  if (!row) {
    return { userId, ok: false, motivo: 'Sem dados de ontem para enviar' }
  }

  const actions = (row.actions as { action_type: string; value: string }[]) ?? []
  const costPerAction = (row.cost_per_action_type as { action_type: string; value: string }[]) ?? []

  const gasto = Number(row.spend ?? 0)
  const cliques = Number(row.clicks ?? 0)
  const leads = actions
    .filter((a) => a.action_type === ACTION_MENSAGEM)
    .reduce((sum, a) => sum + Number(a.value), 0)
  const custoPorLead = costPerAction
    .filter((a) => a.action_type === ACTION_MENSAGEM)
    .reduce((_, a) => Number(a.value), 0)

  const mensagem =
    `📊 *Relatório de Ads - ${label}*\n\n` +
    `💰 Gasto: ${formatarBRL(gasto)}\n` +
    `👆 Cliques: ${cliques.toLocaleString('pt-BR')}\n` +
    `👥 Leads: ${leads}\n` +
    `📉 Custo por lead: ${leads > 0 ? formatarBRL(custoPorLead) : '—'}`

  const uazapiBase = getUazapiBase(appConfig.uazapiUrl)
  const wppRes = await fetch(`${uazapiBase}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: instancia.token },
    body: JSON.stringify({ number: usuario.telefone, text: mensagem }),
  })

  if (!wppRes.ok) {
    const wppJson = await wppRes.json().catch(() => ({}))
    return { userId, ok: false, motivo: `Erro ao enviar WhatsApp: ${JSON.stringify(wppJson)}` }
  }

  return { userId, ok: true }
}

// Cron diário (vercel.json): roda pra todos os tenants com Facebook Ads configurado
export async function GET() {
  const supabase = getSupabase()

  const { data: tenants } = await supabase
    .from('configuracoes_usuario')
    .select('user_id, fb_ads_token, fb_ad_account_id')
    .not('fb_ads_token', 'is', null)
    .not('fb_ad_account_id', 'is', null)

  const resultados: Resultado[] = []
  for (const t of tenants ?? []) {
    const config = await readTenantConfig(t.user_id)
    resultados.push(await enviarRelatorioDoTenant(supabase, t.user_id, config))
  }

  return NextResponse.json({ ok: true, resultados })
}

// Disparo manual pelo botão na tela de Ads: envia só pro tenant logado
export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const config = await readTenantConfig(userId)
  const resultado = await enviarRelatorioDoTenant(supabase, userId, config)

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.motivo }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

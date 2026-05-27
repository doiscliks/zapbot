import { NextResponse } from 'next/server'
import { readConfig } from '@/lib/config-server'

const FB_API_VERSION = 'v19.0'
const NUMERO_DESTINO = '5535991061791'
const ACTION_MENSAGEM = 'onsite_conversion.messaging_conversation_started_7d'

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

function dataHojeBR(): string {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export async function GET() {
  const config = await readConfig()

  if (!config.fbAdsToken || !config.fbAdAccountId) {
    return NextResponse.json({ error: 'Facebook Ads não configurado' }, { status: 400 })
  }

  if (!config.uazapiUrl || !config.uazapiToken) {
    return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 400 })
  }

  // Buscar dados do dia na API do Facebook
  const accountId = config.fbAdAccountId.startsWith('act_')
    ? config.fbAdAccountId
    : `act_${config.fbAdAccountId}`

  const fields = ['spend', 'clicks', 'actions', 'cost_per_action_type'].join(',')
  const params = new URLSearchParams({
    level: 'account',
    fields,
    date_preset: 'today',
    access_token: config.fbAdsToken,
  })

  const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights?${params}`)
  const fbJson = await fbRes.json()

  if (!fbRes.ok) {
    return NextResponse.json({ error: 'Erro ao buscar dados do Facebook', detail: fbJson }, { status: 500 })
  }

  const row = fbJson.data?.[0]

  if (!row) {
    return NextResponse.json({ ok: true, aviso: 'Sem dados de hoje para enviar' })
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
    `📊 *Relatório de Ads - ${dataHojeBR()}*\n\n` +
    `💰 Gasto hoje: ${formatarBRL(gasto)}\n` +
    `👆 Cliques: ${cliques.toLocaleString('pt-BR')}\n` +
    `👥 Leads: ${leads}\n` +
    `📉 Custo por lead: ${leads > 0 ? formatarBRL(custoPorLead) : '—'}`

  // Enviar via UAZAPI
  const uazapiBase = getUazapiBase(config.uazapiUrl)
  const wppRes = await fetch(`${uazapiBase}/send/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': config.uazapiToken,
    },
    body: JSON.stringify({ number: NUMERO_DESTINO, text: mensagem }),
  })

  if (!wppRes.ok) {
    const wppJson = await wppRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Erro ao enviar WhatsApp', detail: wppJson }, { status: 500 })
  }

  return NextResponse.json({ ok: true, gasto, cliques, leads, custoPorLead })
}

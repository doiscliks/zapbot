import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isMasterAuth } from '@/lib/master-auth'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function checarStatusUazapi(uazapiUrl: string, token: string): Promise<'conectado' | 'desconectado'> {
  try {
    const res = await fetch(`${uazapiUrl}/instance/status`, {
      headers: { token },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return 'desconectado'
    const data = await res.json() as Record<string, unknown>
    const inst = (data.instance as Record<string, unknown>) ?? {}
    const rawStatus = (inst.status as string) || (inst.state as string) || (data.status as string) || (data.state as string) || ''
    return rawStatus === 'connected' || rawStatus === 'open' ? 'conectado' : 'desconectado'
  } catch {
    return 'desconectado'
  }
}

async function checarWebhookUazapi(uazapiUrl: string, token: string, webhookEsperado: string): Promise<boolean> {
  try {
    const res = await fetch(`${uazapiUrl}/webhook`, {
      headers: { token },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return false
    const data = await res.json() as unknown
    const lista = Array.isArray(data) ? data as Record<string, unknown>[] : [data as Record<string, unknown>]
    return lista.some((w) => w.enabled === true && typeof w.url === 'string' && w.url.includes(webhookEsperado))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!isMasterAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const config = await readConfig()
  const uazapiUrl = (config.uazapiUrl || '').replace(/\/+$/, '')

  const [usuariosRes, configsRes, instanciasRes, ultimaIARes, ultimoWebhookRes] = await Promise.all([
    supabase.from('usuarios').select('id, email, nome').order('email'),
    supabase.from('configuracoes_usuario').select('user_id, openai_key'),
    supabase.from('instancias_whatsapp').select('id, user_id, nome, token, status, telefone, ativo'),
    supabase
      .from('mensagens_whatsapp')
      .select('user_id, data_criacao')
      .eq('quem_mandou', 'agente')
      .gte('data_criacao', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('data_criacao', { ascending: false }),
    supabase
      .from('webhook_debug')
      .select('payload, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const usuarios = usuariosRes.data ?? []
  const configs = configsRes.data ?? []
  const instancias = instanciasRes.data ?? []
  const mensagensIA = ultimaIARes.data ?? []
  const webhooks = ultimoWebhookRes.data ?? []

  const configMap = Object.fromEntries(configs.map((c) => [c.user_id, c]))

  // Última mensagem IA nos últimos 7 dias por user_id
  const ultimaIAPorUser: Record<string, string> = {}
  for (const m of mensagensIA) {
    if (m.user_id && !ultimaIAPorUser[m.user_id]) {
      ultimaIAPorUser[m.user_id] = m.data_criacao
    }
  }

  // Último webhook recebido por token de instância (step 1)
  const ultimoWebhookPorToken: Record<string, string> = {}
  for (const w of webhooks) {
    try {
      const p = JSON.parse(w.payload)
      if (p.step === '1_payload_recebido' && p.info?.token) {
        const tok = p.info.token as string
        if (!ultimoWebhookPorToken[tok]) ultimoWebhookPorToken[tok] = w.created_at
      }
    } catch { /* ignora */ }
  }

  // Checa status e webhook de todas as instâncias em paralelo
  const statusReais: Record<string, 'conectado' | 'desconectado'> = {}
  const webhookReais: Record<string, boolean> = {}
  if (uazapiUrl) {
    await Promise.all(
      instancias.map(async (i) => {
        const [status, webhook] = await Promise.all([
          checarStatusUazapi(uazapiUrl, i.token),
          checarWebhookUazapi(uazapiUrl, i.token, '/api/webhook/whatsapp'),
        ])
        statusReais[i.id] = status
        webhookReais[i.id] = webhook
      })
    )
  }

  const resultado = usuarios.map((u) => {
    const userConfig = configMap[u.id]
    const instanciasDoUsuario = instancias.filter((i) => i.user_id === u.id)

    return {
      id: u.id,
      email: u.email,
      nome: u.nome || u.email,
      temOpenaiKey: !!(userConfig?.openai_key),
      instancias: instanciasDoUsuario.map((i) => ({
        id: i.id,
        nome: i.nome || i.telefone || i.token?.slice(0, 8),
        status: statusReais[i.id] ?? i.status ?? 'desconectado',
        telefone: i.telefone,
        ativo: i.ativo,
        webhookAtivo: webhookReais[i.id] ?? false,
        ultimoWebhook: ultimoWebhookPorToken[i.token] ?? null,
      })),
      ultimaMensagemIA: ultimaIAPorUser[u.id] ?? null,
      iaRespondendo: !!ultimaIAPorUser[u.id],
    }
  })

  return NextResponse.json(resultado)
}

import { NextRequest, NextResponse } from 'next/server'
import { readConfig } from '@/lib/config-server'
import { createHash } from 'crypto'

const FB_API_VERSION = 'v21.0'

const FB_EVENTOS = [
  'Lead',
  'Contact',
  'CompleteRegistration',
  'Schedule',
  'SubmitApplication',
  'Purchase',
  'InitiateCheckout',
  'AddToCart',
  'ViewContent',
  'Search',
  'CustomEvent',
] as const

function hash(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Número brasileiro sem código do país (10 ou 11 dígitos) → adiciona 55
  if (digits.length === 10 || digits.length === 11) return '55' + digits
  return digits
}

interface ClientePayload {
  nome: string
  telefone: string
}

const EVENTOS_COM_VALOR = ['Purchase', 'InitiateCheckout', 'AddToCart']

export async function POST(request: NextRequest) {
  const body = await request.json() as { clientes: ClientePayload[]; eventName: string }
  const { clientes, eventName } = body

  if (!clientes?.length || !eventName) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  if (!FB_EVENTOS.includes(eventName as typeof FB_EVENTOS[number])) {
    return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
  }

  const config = await readConfig()

  if (!config.fbPixelId || !config.fbAccessToken) {
    return NextResponse.json({ error: 'Facebook Conversions API não configurada' }, { status: 400 })
  }

  const eventTime = Math.floor(Date.now() / 1000)

  const data = clientes.map((c) => {
    const partes = c.nome.trim().split(' ')
    const fn = partes[0] ?? ''
    const ln = partes.length > 1 ? partes.slice(1).join(' ') : ''

    const userData: Record<string, string[]> = {
      ph: [hash(normalizePhone(c.telefone))],
      fn: [hash(fn)],
    }
    if (ln) userData.ln = [hash(ln)]

    const event: Record<string, unknown> = {
      event_name: eventName,
      event_time: eventTime,
      action_source: 'other',
      user_data: userData,
    }

    if (EVENTOS_COM_VALOR.includes(eventName)) {
      event.custom_data = { currency: 'BRL', value: 0 }
    }

    return event
  })

  const payload: Record<string, unknown> = {
    data,
    access_token: config.fbAccessToken,
  }
  if (config.fbTestEventCode) {
    payload.test_event_code = config.fbTestEventCode
  }

  const url = `https://graph.facebook.com/${FB_API_VERSION}/${config.fbPixelId}/events`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const result = await res.json()

  if (!res.ok) {
    console.error('[FB CAPI] Erro:', JSON.stringify(result))
    return NextResponse.json({ ok: false, error: result }, { status: res.status })
  }

  return NextResponse.json({ ok: true, events_received: result.events_received, fbtrace_id: result.fbtrace_id })
}

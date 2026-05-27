import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

function getBase(uazapiUrl: string) {
  return uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '') || ''
}

function getPaircode(data: Record<string, unknown>): string | null {
  // Campo confirmado pela UAZAPI: instance.paircode
  const inst = (data.instance as Record<string, unknown>) ?? {}
  const code = (inst.paircode as string) || (inst.pairingCode as string) ||
    (data.paircode as string) || (data.pairingCode as string) || null
  if (code && code.trim().length >= 4) return code.trim()
  return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params

  const { data: instancia, error } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('id', id)
    .single()

  if (error || !instancia) {
    return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
  }

  const config = await readConfig()
  const base = getBase(config.uazapiUrl)

  if (!base) {
    return NextResponse.json({ error: 'URL da UAZAPI não configurada' }, { status: 500 })
  }

  const body = await request.json()
  const telefone: string = (body.telefone ?? '').replace(/\D/g, '')

  if (!telefone || telefone.length < 10) {
    return NextResponse.json({ error: 'Número de telefone inválido (use DDI+DDD+número, ex: 5511999999999)' }, { status: 400 })
  }

  // Garante webhook configurado para este token (silencioso)
  fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: instancia.token },
    body: JSON.stringify({
      enabled: true,
      url: `${request.nextUrl.origin}/api/webhook/whatsapp`,
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi', 'isGroupYes'],
    }),
  }).catch(() => {})

  try {
    // 1. Dispara connect com phone para gerar o paircode na UAZAPI
    const connectRes = await fetch(`${base}/instance/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instancia.token },
      body: JSON.stringify({ phone: telefone }),
    })

    if (!connectRes.ok) {
      const errText = await connectRes.text().catch(() => '')
      let msg = `Erro UAZAPI (${connectRes.status})`
      try { msg = JSON.parse(errText)?.message || errText || msg } catch { msg = errText || msg }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Verifica se o connect já retornou o código
    const connectData = await connectRes.json() as Record<string, unknown>
    const codeFromConnect = getPaircode(connectData)
    if (codeFromConnect) return NextResponse.json({ code: codeFromConnect })

    // 2. Polling no /instance/status até encontrar o paircode (máx 5 tentativas × 2s = 10s)
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(r => setTimeout(r, 2000))

      const statusRes = await fetch(`${base}/instance/status`, {
        headers: { token: instancia.token },
      }).catch(() => null)

      if (!statusRes?.ok) continue

      const statusData = await statusRes.json() as Record<string, unknown>
      const code = getPaircode(statusData)
      if (code) return NextResponse.json({ code })
    }

    return NextResponse.json({
      error: 'Código não gerado pela UAZAPI. Verifique se o número está correto e a instância está desconectada.',
    }, { status: 500 })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

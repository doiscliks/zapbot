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

function extractQr(data: Record<string, unknown>): string | null {
  const inst = (data.instance as Record<string, unknown>) ?? {}
  return (
    (inst.qrcode as string) ||
    (inst.qr as string) ||
    (data.qrcode as string) ||
    (data.qr as string) ||
    (data.base64 as string) ||
    null
  ) || null
}

function extractStatus(data: Record<string, unknown>): string {
  const inst = (data.instance as Record<string, unknown>) ?? {}
  return (
    (inst.status as string) ||
    (inst.state as string) ||
    (data.status as string) ||
    (data.state as string) ||
    'unknown'
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    // /instance/connect sem phone = gera QR code
    try {
      await fetch(`${base}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instancia.token },
        body: JSON.stringify({}),
      })
    } catch { /* ignora — tenta buscar status mesmo assim */ }

    // Pequena pausa para UAZAPI processar o connect e gerar o QR
    await new Promise(r => setTimeout(r, 1500))

    const res = await fetch(`${base}/instance/status`, {
      headers: { token: instancia.token },
    })
    if (!res.ok) return NextResponse.json({ qr: null, status: 'unknown' })

    const data = await res.json() as Record<string, unknown>
    const qr = extractQr(data)
    const status = extractStatus(data)

    return NextResponse.json({ qr, status, raw: data })
  } catch {
    return NextResponse.json({ qr: null, status: 'unknown' })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

function getBase(uazapiUrl: string) {
  return uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '') || ''
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabase()

  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!instancia) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

  const body = await request.json()
  const excludeMessages: string[] = body.excludeMessages ?? ['wasSentByApi']

  const config = await readConfig()
  const base = getBase(config.uazapiUrl)
  if (!base) return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })

  const webhookUrl = `${request.nextUrl.origin}/api/webhook/whatsapp`

  const res = await fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: instancia.token },
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      events: ['messages', 'connection'],
      excludeMessages,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return NextResponse.json({ error: `UAZAPI (${res.status}): ${text}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, webhookUrl })
}

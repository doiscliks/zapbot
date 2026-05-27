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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const res = await fetch(`${base}/instance/status`, {
      headers: { token: instancia.token },
    })
    const data = await res.json() as Record<string, unknown>

    const inst = (data.instance as Record<string, unknown>) ?? {}

    const rawStatus =
      (inst.status as string) ||
      (inst.state as string) ||
      (data.status as string) ||
      (data.state as string) ||
      ''

    const conectado = rawStatus === 'connected' || rawStatus === 'open'

    const telefone =
      (inst.phone as string) ||
      (data.phone as string) ||
      ((inst.me as Record<string, unknown>)?.id as string)?.split('@')[0] ||
      null

    const qr =
      (inst.qrcode as string) ||
      (inst.qr as string) ||
      (data.qrcode as string) ||
      (data.qr as string) ||
      null

    await supabase
      .from('instancias_whatsapp')
      .update({
        status: conectado ? 'conectado' : rawStatus === 'connecting' ? 'connecting' : 'desconectado',
        ...(telefone ? { telefone } : {}),
      })
      .eq('id', id)

    return NextResponse.json({ conectado, telefone, qr, state: rawStatus, raw: data })
  } catch {
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 })
  }
}

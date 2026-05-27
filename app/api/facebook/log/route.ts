import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { clientes, evento, secao, events_received, fbtrace_id, erro } = body

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const rows = clientes.map((c: { id: number; telefone: string }) => ({
    cliente_id: c.id,
    telefone: c.telefone,
    evento,
    secao,
    events_received: events_received ?? null,
    fbtrace_id: fbtrace_id ?? null,
    erro: erro ?? null,
  }))

  await supabase.from('facebook_eventos_enviados').insert(rows)

  return NextResponse.json({ ok: true })
}

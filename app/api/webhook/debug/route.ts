import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const supabase = createClient(url, key)

  const body = await request.text()

  await supabase.from('webhook_debug').insert({
    payload: body,
    headers: JSON.stringify(Object.fromEntries(request.headers)),
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Mostra URL mascarada para diagnóstico
  const urlMasked = url
    ? url.slice(0, 15) + '...' + url.slice(-10)
    : '(não definida)'
  const keyOk = key.startsWith('eyJ') && key.length > 100

  // Tenta conectar
  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from('webhook_debug')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    supabaseUrl: urlMasked,
    keyValida: keyOk,
    erro: error?.message ?? null,
    registros: data ?? [],
  })
}

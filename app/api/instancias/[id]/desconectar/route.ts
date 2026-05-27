import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { id } = await params

  const { data: instancia, error } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !instancia) {
    return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
  }

  const config = await readConfig()
  const base = config.uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '')

  if (!base) {
    return NextResponse.json({ error: 'URL da UAZAPI não configurada' }, { status: 500 })
  }

  try {
    await fetch(`${base}/instance/logout`, {
      method: 'DELETE',
      headers: { token: instancia.token },
    })
  } catch { /* ignora erro da UAZAPI */ }

  await supabase
    .from('instancias_whatsapp')
    .update({ status: 'desconectado', telefone: null })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}

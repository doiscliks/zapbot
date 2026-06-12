import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readConfig()
  const uazapiBase = config.uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '')

  const { numero, mensagem, instancia_id } = await request.json()

  if (!numero || !mensagem) {
    return NextResponse.json({ error: 'numero e mensagem são obrigatórios' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Busca token da instância: por instancia_id se passado, senão pega a conectada do usuário
  let uazapiToken: string | null = null
  if (instancia_id) {
    const { data } = await supabase
      .from('instancias_whatsapp')
      .select('token')
      .eq('id', instancia_id)
      .eq('user_id', userId)
      .single()
    uazapiToken = data?.token ?? null
  } else {
    const { data } = await supabase
      .from('instancias_whatsapp')
      .select('token')
      .eq('user_id', userId)
      .eq('status', 'conectado')
      .limit(1)
      .single()
    uazapiToken = data?.token ?? null
  }

  if (!uazapiBase || !uazapiToken) {
    return NextResponse.json({ error: 'Nenhuma instância WhatsApp conectada' }, { status: 400 })
  }

  const response = await fetch(`${uazapiBase}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: uazapiToken },
    body: JSON.stringify({ number: numero, text: mensagem }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return NextResponse.json({ error: 'Falha ao enviar mensagem', detail: data }, { status: response.status })
  }

  // Persiste a mensagem enviada com o user_id do workspace, para aparecer no
  // histórico (o webhook ignora o echo wasSentByApi, então a gravação é aqui).
  const { error: insertErr } = await supabase.from('mensagens_whatsapp').insert({
    numero_cliente: String(numero).split('@')[0],
    mensagem,
    quem_mandou: 'manual',
    status: 'enviada',
    data_criacao: new Date().toISOString(),
    user_id: userId,
  })

  return NextResponse.json({ ok: true, data, salvo: !insertErr, erro_salvar: insertErr?.message })
}

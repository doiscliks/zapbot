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

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('instancias_whatsapp')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const body = await request.json()
  const nome: string = body.nome ?? ''
  const excludeMessages: string[] = body.excludeMessages ?? ['wasSentByApi']

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const config = await readConfig()
  const base = getBase(config.uazapiUrl)
  const adminToken = config.uazapiToken

  if (!base || !adminToken) {
    return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })
  }

  // Verifica limite de instâncias do usuário
  const [{ data: usuario }, { count }] = await Promise.all([
    supabase.from('usuarios').select('instancias_permitidas').eq('id', userId).single(),
    supabase.from('instancias_whatsapp').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  const limite = Math.max(1, Number(usuario?.instancias_permitidas) || 1)
  if ((count ?? 0) >= limite) {
    return NextResponse.json(
      { error: `Limite de ${limite} instância${limite !== 1 ? 's' : ''} atingido para este plano.` },
      { status: 403 }
    )
  }

  // 1. Cria instância na UAZAPI
  const createRes = await fetch(`${base}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', admintoken: adminToken },
    body: JSON.stringify({ name: nome.trim() }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '')
    let errMsg = 'Erro ao criar instância na UAZAPI'
    try { errMsg = JSON.parse(errText)?.message || errText || errMsg } catch { errMsg = errText || errMsg }
    return NextResponse.json({ error: `UAZAPI (${createRes.status}): ${errMsg}` }, { status: 500 })
  }

  const createData = await createRes.json() as Record<string, unknown>
  const instanceToken =
    (createData.token as string) ||
    ((createData.instance as Record<string, unknown>)?.token as string) ||
    ''

  if (!instanceToken) {
    return NextResponse.json({ error: 'Token não retornado pela UAZAPI' }, { status: 500 })
  }

  // 2. Inicia conexão (corpo vazio = gera QR code)
  let qrcode: string | null = null
  try {
    const connectRes = await fetch(`${base}/instance/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({}),
    })
    if (connectRes.ok) {
      const connectData = await connectRes.json() as Record<string, unknown>
      const inst = (connectData.instance as Record<string, unknown>) ?? {}
      qrcode = (inst.qrcode as string) || (connectData.qrcode as string) || (connectData.qr as string) || null
    }
  } catch { /* frontend vai buscar via polling */ }

  // 3. Configura webhook automaticamente para esta instância
  const appOrigin = request.nextUrl.origin
  const webhookUrl = `${appOrigin}/api/webhook/whatsapp`
  try {
    await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        events: ['messages', 'connection'],
        excludeMessages,
      }),
    })
  } catch { /* ignora — usuário pode reconfigurar manualmente */ }

  // 4. Salva no banco
  const { data, error } = await supabase
    .from('instancias_whatsapp')
    .insert({ nome: nome.trim(), token: instanceToken, status: 'connecting', user_id: userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, qrcode })
}

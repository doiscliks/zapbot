import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inviteUrl } = await request.json()
  if (!inviteUrl?.trim()) return NextResponse.json({ error: 'Link do grupo obrigatório' }, { status: 400 })

  const supabase = getSupabase()
  const config = await readConfig()
  const uazapiUrl = (config.uazapiUrl || '').replace(/\/+$/, '')
  if (!uazapiUrl) return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })

  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('user_id', userId)
    .eq('status', 'conectado')
    .limit(1)
    .maybeSingle()

  if (!instancia?.token) {
    return NextResponse.json({ error: 'Nenhuma instância conectada. Conecte um número em Conexão primeiro.' }, { status: 400 })
  }

  // Passo 1: resolve o link convite → obtém JID e nome do grupo
  let groupJid: string
  let groupNome: string
  try {
    const infoRes = await fetch(`${uazapiUrl}/group/inviteInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instancia.token },
      body: JSON.stringify({ invitecode: inviteUrl.trim() }),
      signal: AbortSignal.timeout(10000),
    })
    if (!infoRes.ok) {
      return NextResponse.json({ error: 'Link de convite inválido ou expirado.' }, { status: 400 })
    }
    const info = await infoRes.json() as Record<string, unknown>
    const group = (info.group as Record<string, unknown>) ?? info
    groupJid = (group.JID as string) || (group.id as string) || ''
    groupNome = (group.Name as string) || (group.subject as string) || ''
    if (!groupJid) return NextResponse.json({ error: 'Não foi possível obter o ID do grupo.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Erro ao consultar informações do grupo.' }, { status: 500 })
  }

  // Passo 2: verifica se a instância está no grupo
  try {
    const listRes = await fetch(`${uazapiUrl}/group/list?noparticipants=true`, {
      headers: { token: instancia.token },
      signal: AbortSignal.timeout(10000),
    })
    if (!listRes.ok) return NextResponse.json({ error: 'Erro ao consultar grupos da instância.' }, { status: 500 })

    const grupos = await listRes.json() as Record<string, unknown>[]
    const membro = Array.isArray(grupos) && grupos.some((g) => g.id === groupJid || g.wa_chatid === groupJid)

    // Retorna sempre o JID e nome — o frontend decide o que fazer com membro=false
    return NextResponse.json({ ok: membro, groupJid, groupNome, membro })
  } catch {
    return NextResponse.json({ error: 'Erro ao verificar participação no grupo.' }, { status: 500 })
  }
}

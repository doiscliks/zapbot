import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

// Busca o link de convite de um grupo administrado, tentando variações de endpoint/campo da uazapi
async function buscarInviteLink(uazapiUrl: string, token: string, groupJid: string): Promise<string | null> {
  const tentativas = [
    `${uazapiUrl}/group/invitelink`,
    `${uazapiUrl}/group/InviteLink`,
    `${uazapiUrl}/group/getInviteLink`,
  ]
  for (const url of tentativas) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify({ groupjid: groupJid }),
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) continue
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      const link = data.InviteLink ?? data.inviteLink ?? data.link ?? data.url ?? data.invitelink ?? data.InviteUrl
      if (typeof link === 'string' && link.includes('chat.whatsapp.com')) return link
      const code = data.InviteCode ?? data.inviteCode ?? data.code
      if (typeof code === 'string' && code) return `https://chat.whatsapp.com/${code}`
    } catch { /* tenta o próximo endpoint */ }
  }
  return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: rotatorId } = await params
  const { groupJid, nome } = await request.json()
  if (!groupJid?.trim()) return NextResponse.json({ error: 'groupJid obrigatório' }, { status: 400 })

  const supabase = getSupabase()

  // Verifica que o rotator pertence ao usuário
  const { data: rotator } = await supabase
    .from('grupos_rotators')
    .select('id')
    .eq('id', rotatorId)
    .eq('user_id', userId)
    .single()
  if (!rotator) return NextResponse.json({ error: 'Rotator não encontrado' }, { status: 404 })

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
    return NextResponse.json({ error: 'Nenhuma instância conectada.' }, { status: 400 })
  }

  const url = await buscarInviteLink(uazapiUrl, instancia.token, groupJid.trim())
  if (!url) {
    return NextResponse.json(
      { error: 'Não foi possível obter o link de convite deste grupo. Confirme que você é administrador dele.' },
      { status: 502 }
    )
  }

  const { data, error } = await supabase
    .from('grupos_links')
    .insert({ rotator_id: rotatorId, url, nome: nome?.trim() || null, whatsapp_group_id: groupJid.trim(), user_id: userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

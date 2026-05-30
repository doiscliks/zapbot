import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

function digits(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\D/g, '') : ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ehAdmin(g: Record<string, any>, ownDigits: string): boolean {
  // Flag em nível de grupo (algumas versões da uazapi retornam o admin do próprio número)
  if (g.IsAdmin === true || g.isAdmin === true || g.amAdmin === true) return true
  // Dono do grupo é o próprio número
  const owner = digits(g.OwnerJID ?? g.ownerJid ?? g.Owner ?? g.owner)
  if (ownDigits && owner && (owner.includes(ownDigits) || ownDigits.includes(owner))) return true
  // Participante == próprio número e com flag de admin
  const parts = g.Participants ?? g.participants
  if (Array.isArray(parts) && ownDigits) {
    return parts.some((p: Record<string, unknown>) => {
      const pj = digits(p.JID ?? p.jid ?? p.id ?? p.phone ?? p.PhoneNumber)
      const isAdm = p.IsAdmin || p.isAdmin || p.admin || p.IsSuperAdmin || p.isSuperAdmin || p.superadmin
      return pj && (pj.includes(ownDigits) || ownDigits.includes(pj)) && !!isAdm
    })
  }
  return false
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rotatorId = request.nextUrl.searchParams.get('rotator_id')

  const supabase = getSupabase()
  const config = await readConfig()
  const uazapiUrl = (config.uazapiUrl || '').replace(/\/+$/, '')
  if (!uazapiUrl) return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })

  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token, telefone')
    .eq('user_id', userId)
    .eq('status', 'conectado')
    .limit(1)
    .maybeSingle()

  if (!instancia?.token) {
    return NextResponse.json({ error: 'Nenhuma instância conectada. Conecte um número em Conexão primeiro.' }, { status: 400 })
  }

  // Grupos já adicionados (no rotator alvo, se informado; senão todos do usuário)
  let jaQuery = supabase.from('grupos_links').select('whatsapp_group_id').eq('user_id', userId)
  if (rotatorId) jaQuery = jaQuery.eq('rotator_id', rotatorId)
  const { data: existentes } = await jaQuery
  const jaAdicionados = new Set((existentes ?? []).map((l) => l.whatsapp_group_id).filter(Boolean))

  // Lista os grupos da instância (com participantes para detectar admin)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let grupos: Record<string, any>[] = []
  try {
    const res = await fetch(`${uazapiUrl}/group/list`, {
      headers: { token: instancia.token },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return NextResponse.json({ error: `Erro ao listar grupos (HTTP ${res.status})`, detalhe: txt.slice(0, 200) }, { status: 502 })
    }
    const json = await res.json()
    grupos = Array.isArray(json)
      ? json
      : (Array.isArray(json?.groups) ? json.groups : (Array.isArray(json?.Groups) ? json.Groups : []))
  } catch {
    return NextResponse.json({ error: 'Falha ao consultar grupos da instância.' }, { status: 502 })
  }

  const ownDigits = digits(instancia.telefone)

  const lista = grupos
    .map((g) => {
      const jid = String(g.JID ?? g.id ?? g.wa_chatid ?? g.Jid ?? '')
      const nome = String(g.Name ?? g.name ?? g.subject ?? g.Subject ?? g.Topic ?? '')
      const parts = g.Participants ?? g.participants
      const participantes = Array.isArray(parts) ? parts.length : (typeof g.Size === 'number' ? g.Size : null)
      return {
        jid,
        nome: nome || jid,
        participantes,
        isAdmin: ehAdmin(g, ownDigits),
        jaAdicionado: jaAdicionados.has(jid),
      }
    })
    .filter((g) => g.jid)
    // Admin primeiro, depois alfabético
    .sort((a, b) => (Number(b.isAdmin) - Number(a.isAdmin)) || a.nome.localeCompare(b.nome))

  return NextResponse.json(lista)
}

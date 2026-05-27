import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv, readConfig } from '@/lib/config-server'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

function getUazapiBase(uazapiUrl: string): string {
  try {
    const u = new URL(uazapiUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return uazapiUrl.replace(/\/+$/, '').replace(/\/(send|group|message|chat|instance).*$/, '')
  }
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rotator_id } = await request.json()

  if (!rotator_id) {
    return NextResponse.json({ error: 'rotator_id obrigatório' }, { status: 400 })
  }

  const config = await readConfig()
  const uazapiBase = config.uazapiUrl ? getUazapiBase(config.uazapiUrl) : ''
  const uazapiToken = config.uazapiToken

  if (!uazapiBase || !uazapiToken) {
    return NextResponse.json({ error: 'UAZAPI não configurada' }, { status: 500 })
  }

  const supabase = getSupabase()

  const { data: links, error } = await supabase
    .from('grupos_links')
    .select('id, url, whatsapp_group_id')
    .eq('rotator_id', rotator_id)
    .eq('user_id', userId)
    .eq('ativo', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!links || links.length === 0) {
    return NextResponse.json({ ok: true, resultados: [], aviso: 'Nenhum link ativo encontrado' })
  }

  const resultados: { id: string; participantes: number | null; erro?: string; detalhe?: string }[] = []

  for (const link of links) {
    if (!link.whatsapp_group_id) {
      resultados.push({ id: link.id, participantes: null, erro: 'Group ID não informado' })
      continue
    }

    try {
      const instanceToken = '97361a80-1d97-4894-b1b7-99a74fc18b15'
      const resp = await fetch(`${uazapiBase}/group/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instanceToken,
        },
        body: JSON.stringify({ groupjid: link.whatsapp_group_id, force: true }),
      })

      const text = await resp.text()
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(text) } catch { /* não era JSON */ }

      if (!resp.ok) {
        resultados.push({ id: link.id, participantes: null, erro: `HTTP ${resp.status}`, detalhe: text.slice(0, 200) })
        continue
      }

      const participantes: number = Array.isArray(data.Participants) ? (data.Participants as unknown[]).length : 0

      await supabase
        .from('grupos_links')
        .update({ participantes })
        .eq('id', link.id)

      resultados.push({ id: link.id, participantes })
    } catch (e: unknown) {
      resultados.push({ id: link.id, participantes: null, erro: e instanceof Error ? e.message : 'Erro desconhecido' })
    }
  }

  return NextResponse.json({ ok: true, resultados })
}

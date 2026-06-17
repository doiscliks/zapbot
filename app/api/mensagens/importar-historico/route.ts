import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUsuarioId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function extrairTexto(msg: Record<string, unknown>): string {
  const text = (msg.text as string) || ''
  if (text) return text
  const content = msg.content as Record<string, unknown> | undefined
  if (!content) return ''
  return (content.text as string) || (content.caption as string) || ''
}

export async function POST(request: NextRequest) {
  const userId = getUsuarioId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { telefone } = await request.json()
  if (!telefone) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })

  const supabase = getSupabase()
  const telefoneLimpo = telefone.replace('@s.whatsapp.net', '')
  const chatid = `${telefoneLimpo}@s.whatsapp.net`

  // Busca o token da instância associada ao cliente
  const { data: cliente } = await supabase
    .from('clientes')
    .select('instancia_id')
    .eq('user_id', userId)
    .or(`telefone.eq.${telefoneLimpo},telefone.eq.${chatid}`)
    .maybeSingle()

  if (!cliente?.instancia_id) {
    return NextResponse.json({ error: 'Cliente sem instância associada' }, { status: 400 })
  }

  const config = await readConfig()
  const uazapiUrl = (config.uazapiUrl || '').replace(/\/+$/, '')
  const instanceToken = cliente.instancia_id

  if (!uazapiUrl) {
    return NextResponse.json({ error: 'URL UAZAPI não configurada' }, { status: 400 })
  }

  // Busca mensagens com paginação (máx 500)
  type UazapiMsg = Record<string, unknown>
  const todasMensagens: UazapiMsg[] = []
  let offset = 0
  const limit = 100
  let hasMore = true
  let paginas = 0

  while (hasMore && paginas < 5) {
    let res: Response
    try {
      res = await fetch(`${uazapiUrl}/message/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instanceToken },
        body: JSON.stringify({ chatid, limit, offset }),
      })
    } catch {
      break
    }
    if (!res.ok) break

    const data = await res.json()
    const msgs: UazapiMsg[] = data.messages ?? []
    todasMensagens.push(...msgs)
    hasMore = data.hasMore ?? false
    offset = data.nextOffset ?? offset + limit
    paginas++
  }

  // Mapeia para o formato do banco
  const registros = todasMensagens
    .map((msg) => {
      const texto = extrairTexto(msg)
      if (!texto) return null
      const ts = msg.messageTimestamp as number
      const data_criacao = new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
      const fromMe = msg.fromMe as boolean
      return {
        numero_cliente: telefoneLimpo,
        mensagem: texto,
        quem_mandou: fromMe ? 'agente' : 'cliente',
        status: (msg.status as string) || null,
        data_criacao,
        message_id: msg.messageid as string,
        user_id: userId,
      }
    })
    .filter(Boolean)

  if (registros.length === 0) {
    return NextResponse.json({ importados: 0 })
  }

  // Upsert ignorando duplicatas pelo message_id
  const { error } = await supabase
    .from('mensagens_whatsapp')
    .upsert(registros, { onConflict: 'message_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ importados: registros.length })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'
import { readConfig } from '@/lib/config-server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

type UazapiMsg = Record<string, unknown>
type UazapiChat = Record<string, unknown>

function extrairTexto(msg: UazapiMsg): string {
  const text = (msg.text as string) || ''
  if (text) return text
  const content = msg.content as Record<string, unknown> | undefined
  if (content) {
    const t = (content.text as string) || (content.caption as string) || ''
    if (t) return t
  }
  // Placeholder para mídias
  const tipo = (msg.type as string) || (msg.messageType as string) || ''
  if (tipo.includes('image') || tipo === 'imageMessage') return '[Imagem]'
  if (tipo.includes('audio') || tipo === 'audioMessage' || tipo === 'pttMessage') return '[Áudio]'
  if (tipo.includes('video') || tipo === 'videoMessage') return '[Vídeo]'
  if (tipo.includes('document') || tipo === 'documentMessage') return '[Documento]'
  if (tipo.includes('sticker') || tipo === 'stickerMessage') return '[Figurinha]'
  if (tipo.includes('location') || tipo === 'locationMessage') return '[Localização]'
  if (tipo.includes('contact') || tipo === 'contactMessage') return '[Contato]'
  if (tipo) return `[${tipo}]`
  return ''
}

// Busca todos os chats individuais via /chat/find (pagina até acabar)
async function buscarChatsIndividuais(
  uazapiUrl: string,
  instanceToken: string
): Promise<UazapiChat[]> {
  const chats: UazapiChat[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    let res: Response
    try {
      res = await fetch(`${uazapiUrl}/chat/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instanceToken },
        body: JSON.stringify({
          operator: 'AND',
          wa_isGroup: false,
          sort: '-wa_lastMsgTimestamp',
          limit,
          offset,
        }),
      })
    } catch { break }
    if (!res.ok) break

    const data = await res.json()
    const pagina: UazapiChat[] = Array.isArray(data) ? data : (data.chats ?? data.data ?? [])
    if (pagina.length === 0) break
    chats.push(...pagina)
    hasMore = pagina.length === limit
    offset += limit
  }

  return chats
}

// Busca todas as mensagens de um chat específico (pagina até acabar)
async function buscarMensagensChat(
  uazapiUrl: string,
  instanceToken: string,
  chatid: string
): Promise<UazapiMsg[]> {
  const msgs: UazapiMsg[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    let res: Response
    try {
      res = await fetch(`${uazapiUrl}/message/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instanceToken },
        body: JSON.stringify({ chatid, limit, offset }),
      })
    } catch { break }
    if (!res.ok) break

    const data = await res.json()
    // UAZAPI pode retornar messages em campos diferentes dependendo da versão
    const pagina: UazapiMsg[] = data.messages ?? data.data ?? (Array.isArray(data) ? data : [])
    if (pagina.length === 0) break
    msgs.push(...pagina)
    hasMore = data.hasMore ?? data.has_more ?? false
    offset = data.nextOffset ?? data.next_offset ?? (offset + limit)
  }

  return msgs
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabase()

  const { data: instancia } = await supabase
    .from('instancias_whatsapp')
    .select('token')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!instancia?.token) {
    return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
  }

  const config = await readConfig()
  const uazapiUrl = (config.uazapiUrl || '').replace(/\/+$/, '')
  const instanceToken = instancia.token

  if (!uazapiUrl) {
    return NextResponse.json({ error: 'URL UAZAPI não configurada' }, { status: 400 })
  }

  // PASSO 1: busca todos os chats individuais via /chat/find
  const chats = await buscarChatsIndividuais(uazapiUrl, instanceToken)

  const chatidsUnicos = new Set<string>()
  const nomesPorChat: Record<string, string> = {}

  for (const chat of chats) {
    const chatid = (chat.wa_chatid as string) || ''
    if (!chatid || chatid.endsWith('@lid') || chatid.endsWith('@g.us')) continue
    chatidsUnicos.add(chatid)
    const nome = (chat.wa_contactName as string) || (chat.wa_name as string) || (chat.name as string) || ''
    if (nome) nomesPorChat[chatid] = nome
  }

  const chatids = Array.from(chatidsUnicos)
  if (chatids.length === 0) {
    return NextResponse.json({ sincronizados: 0, clientes: 0, clientesNovos: 0 })
  }

  // PASSO 2: para cada chatid, busca o histórico completo e salva
  let totalMensagens = 0
  let totalEncontradas = 0
  let clientesNovos = 0

  for (const chatid of chatids) {
    const telefone = chatid.replace('@s.whatsapp.net', '')
    const nome = nomesPorChat[chatid] || telefone

    // Busca mensagens ANTES de criar o cliente — só cria se tiver histórico
    const msgs = await buscarMensagensChat(uazapiUrl, instanceToken, chatid)
    totalEncontradas += msgs.length

    const registros = msgs
      .map((msg) => {
        const texto = extrairTexto(msg)
        if (!texto) return null
        const ts = msg.messageTimestamp as number
        const data_criacao = new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
        return {
          numero_cliente: telefone,
          mensagem: texto,
          quem_mandou: (msg.fromMe as boolean) ? 'agente' : 'cliente',
          status: (msg.status as string) || null,
          data_criacao,
          message_id: (msg.messageid as string) || (msg.id as string) || null,
          user_id: userId,
        }
      })
      .filter(Boolean)

    // Sem mensagens = sem cliente na lista
    if (registros.length === 0) continue

    // Determina dt_ultima_mensagem real (mais recente do histórico)
    const ultimoTs = msgs.reduce((max, m) => {
      const ts = m.messageTimestamp as number
      return ts > max ? ts : max
    }, 0)
    const dtUltima = ultimoTs
      ? new Date(ultimoTs > 1e12 ? ultimoTs : ultimoTs * 1000).toISOString()
      : new Date().toISOString()

    const { data: clienteExistente } = await supabase
      .from('clientes')
      .select('id, historico_sincronizado')
      .eq('telefone', telefone)
      .eq('user_id', userId)
      .maybeSingle()

    if (!clienteExistente) {
      await supabase.from('clientes').insert({
        nome,
        telefone,
        instancia_id: instanceToken,
        historico_sincronizado: true,
        user_id: userId,
        dt_ultima_mensagem: dtUltima,
      })
      clientesNovos++
    } else {
      await supabase.from('clientes')
        .update({ historico_sincronizado: true, dt_ultima_mensagem: dtUltima })
        .eq('id', clienteExistente.id)
    }

    const comId = registros.filter((r) => r && (r as Record<string, unknown>).message_id)
    const semId = registros.filter((r) => r && !(r as Record<string, unknown>).message_id)

    if (comId.length > 0) {
      const { error: upsertError } = await supabase
        .from('mensagens_whatsapp')
        .upsert(comId, { onConflict: 'message_id' })
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message, chatid, registros: comId.length }, { status: 500 })
      }
    }
    if (semId.length > 0) {
      await supabase.from('mensagens_whatsapp').insert(semId)
    }
    totalMensagens += registros.length
  }

  return NextResponse.json({
    sincronizados: totalMensagens,
    encontradas: totalEncontradas,
    clientes: chatids.length,
    clientesNovos,
  })
}

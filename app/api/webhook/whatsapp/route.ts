import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { readTenantConfig } from '@/lib/tenant-config'
import { handleFlowExecution, dispatchKanbanFlows } from '@/lib/flow-executor'
import { buscarFotoPerfil } from '@/lib/uazapi'
import { atribuirClienteAAtendente } from '@/lib/attendant-distribution'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

async function log(supabase: ReturnType<typeof getSupabase>, step: string, info: unknown) {
  try {
    await supabase.from('webhook_debug').insert({
      payload: JSON.stringify({ step, info }),
    })
  } catch { /* ignora */ }
}

type SupabaseClient = ReturnType<typeof getSupabase>

function extrairTextoMsg(msg: Record<string, unknown>): string {
  const text = (msg.text as string) || ''
  if (text) return text
  const content = msg.content as Record<string, unknown> | undefined
  if (content) {
    const t = (content.text as string) || (content.caption as string) || ''
    if (t) return t
  }
  const tipo = (msg.type as string) || (msg.messageType as string) || ''
  if (tipo.includes('image') || tipo === 'imageMessage') return '[Imagem]'
  if (tipo.includes('audio') || tipo === 'audioMessage' || tipo === 'pttMessage') return '[Áudio]'
  if (tipo.includes('video') || tipo === 'videoMessage') return '[Vídeo]'
  if (tipo.includes('document') || tipo === 'documentMessage') return '[Documento]'
  if (tipo.includes('sticker') || tipo === 'stickerMessage') return '[Figurinha]'
  if (tipo.includes('location') || tipo === 'locationMessage') return '[Localização]'
  if (tipo.includes('contact') || tipo === 'contactMessage') return '[Contato]'
  return ''
}

async function qualificarLead(
  supabase: SupabaseClient,
  userId: string,
  clienteId: number,
  texto: string,
  openaiKey: string
): Promise<number | null> {
  const { data: qualConfig } = await supabase
    .from('kanban_qualificacao')
    .select('ativo, secoes_config')
    .eq('user_id', userId)
    .maybeSingle()

  if (!qualConfig?.ativo) return null

  const secoesConfig = (qualConfig.secoes_config ?? []) as { secao_id: number; descricao: string }[]
  if (secoesConfig.length === 0) return null

  const secaoIds = secoesConfig.map((s) => s.secao_id)
  const { data: secoes } = await supabase
    .from('kanban_secoes')
    .select('id, nome')
    .in('id', secaoIds)

  const secoesMap = Object.fromEntries((secoes ?? []).map((s) => [s.id, s.nome]))

  const listagem = secoesConfig
    .filter((s) => secoesMap[s.secao_id])
    .map((s) => `ID ${s.secao_id}: ${secoesMap[s.secao_id]}${s.descricao ? ` — ${s.descricao}` : ''}`)
    .join('\n')

  if (!listagem) return null

  const prompt = `Você é um classificador de leads. Com base na mensagem do cliente, classifique o lead na seção mais adequada do Kanban.

Seções disponíveis:
${listagem}

Mensagem do cliente: "${texto}"

Responda APENAS com o número do ID da seção. Se não for possível classificar com segurança, responda com "null".`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 10,
    }),
  })

  if (!res.ok) return null

  const data = await res.json()
  const resposta = ((data.choices?.[0]?.message?.content as string) || '').trim()
  const secaoId = parseInt(resposta, 10)

  if (!isNaN(secaoId) && secaoIds.includes(secaoId)) {
    await supabase.from('clientes').update({ kanban_secao_id: secaoId }).eq('id', clienteId)
    return secaoId
  }
  return null
}

type CampoColeta = { chave: string; label: string; descricao?: string }

// Extrai dados do cliente (nome, email, etc.) da mensagem e salva em clientes.dados_coletados.
// Roda em paralelo à resposta da IA — não bloqueia o atendimento.
async function extrairDadosCliente(
  supabase: SupabaseClient,
  clienteId: number,
  campos: CampoColeta[],
  dadosAtuais: Record<string, unknown>,
  texto: string,
  openaiKey: string
): Promise<void> {
  // Só busca campos ainda não preenchidos
  const faltantes = campos.filter((c) => {
    const v = dadosAtuais?.[c.chave]
    return v === undefined || v === null || String(v).trim() === ''
  })
  if (faltantes.length === 0) return

  const listagem = faltantes
    .map((c) => `- "${c.chave}": ${c.label}${c.descricao ? ` (${c.descricao})` : ''}`)
    .join('\n')

  const prompt = `Extraia da mensagem do cliente APENAS os dados abaixo que ele tenha informado explicitamente. Não invente, não deduza, não use exemplos.

Campos:
${listagem}

Mensagem do cliente: "${texto}"

Responda APENAS com um objeto JSON contendo somente as chaves que você conseguiu extrair com certeza (omita as demais). Se não houver nenhuma, responda {}.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) return

  const data = await res.json()
  let extraidos: Record<string, unknown> = {}
  try { extraidos = JSON.parse((data.choices?.[0]?.message?.content as string) || '{}') } catch { return }

  const validos: Record<string, unknown> = {}
  for (const c of faltantes) {
    const v = extraidos[c.chave]
    if (v != null && String(v).trim() !== '') validos[c.chave] = String(v).trim()
  }
  if (Object.keys(validos).length === 0) return

  const novos = { ...(dadosAtuais || {}), ...validos }
  const update: Record<string, unknown> = { dados_coletados: novos }
  // Se coletou "nome", reflete também no campo nome do cliente
  if (typeof validos.nome === 'string' && validos.nome.trim()) update.nome = validos.nome.trim()
  await supabase.from('clientes').update(update).eq('id', clienteId)
}

async function sincronizarHistorico(
  supabase: SupabaseClient,
  chatid: string,
  instanceToken: string,
  uazapiBase: string,
  userId: string
) {
  type UazapiMsg = Record<string, unknown>
  const todasMensagens: UazapiMsg[] = []
  let offset = 0
  const limit = 100
  let hasMore = true
  let paginas = 0

  while (hasMore && paginas < 5) {
    let res: Response
    try {
      res = await fetch(`${uazapiBase}/message/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instanceToken },
        body: JSON.stringify({ chatid, limit, offset }),
      })
    } catch { break }
    if (!res.ok) break

    const data = await res.json()
    const msgs: UazapiMsg[] = data.messages ?? []
    todasMensagens.push(...msgs)
    hasMore = data.hasMore ?? false
    offset = data.nextOffset ?? offset + limit
    paginas++
  }

  const registros = todasMensagens
    .map((msg) => {
      const texto = extrairTextoMsg(msg)
      if (!texto) return null
      const ts = msg.messageTimestamp as number
      const data_criacao = new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
      const fromMe = msg.fromMe as boolean
      return {
        numero_cliente: chatid.replace('@s.whatsapp.net', ''),
        mensagem: texto,
        quem_mandou: fromMe ? 'agente' : 'cliente',
        status: (msg.status as string) || null,
        data_criacao,
        message_id: msg.messageid as string,
        user_id: userId,
      }
    })
    .filter(Boolean)

  if (registros.length > 0) {
    await supabase
      .from('mensagens_whatsapp')
      .upsert(registros, { onConflict: 'message_id', ignoreDuplicates: true })
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  await log(supabase, '1_payload_recebido', {
    EventType: body.EventType,
    token: body.token,
    BaseUrl: body.BaseUrl,
    message: body.message,
  })

  const eventType = (body.EventType as string) || ''

  if (eventType === 'connection') {
    const token = (body.token as string) || ''
    if (token) {
      const rawState = (body.state as string) || (body.status as string) || ''
      const isConnected = rawState === 'open' || rawState === 'connected'
      const inst = (body.instance as Record<string, unknown>) ?? {}
      const telefone = ((inst.phone as string) || '').split('@')[0] || null

      if (isConnected) {
        const update: Record<string, unknown> = { status: 'conectado' }
        if (telefone) update.telefone = telefone
        await supabase.from('instancias_whatsapp').update(update).eq('token', token)
        await log(supabase, 'connection_event', { rawState, novoStatus: 'conectado', telefone })
      } else {
        // Antes de marcar como desconectado, confirma direto na UAZAPI
        const uazapiBase = ((body.BaseUrl as string) || '').replace(/\/+$/, '')
        if (uazapiBase) {
          await new Promise(r => setTimeout(r, 3000))
          const check = await fetch(`${uazapiBase}/instance/status`, {
            headers: { token },
          }).catch(() => null)
          if (check?.ok) {
            const checkData = await check.json() as Record<string, unknown>
            const checkInst = (checkData.instance as Record<string, unknown>) ?? {}
            const checkState = (checkInst.status as string) || (checkInst.state as string) || (checkData.state as string) || ''
            const aindaConectado = checkState === 'open' || checkState === 'connected'
            if (!aindaConectado) {
              const novoStatus = checkState === 'connecting' ? 'connecting' : 'desconectado'
              await supabase.from('instancias_whatsapp').update({ status: novoStatus }).eq('token', token)
              await log(supabase, 'connection_event', { rawState, checkState, novoStatus })
            } else {
              await log(supabase, 'connection_event_ignorado', { rawState, checkState, motivo: 'ainda conectado' })
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (eventType !== 'messages') {
    await log(supabase, '2_ignorado_event_type', { eventType })
    return NextResponse.json({ ok: true })
  }

  const msg = (body.message as Record<string, unknown>) || {}
  const fromMe: boolean = msg.fromMe === true
  const isGroup: boolean = msg.isGroup === true
  const wasSentByApi: boolean = msg.wasSentByApi === true
  const conteudoObj = (msg.content && typeof msg.content === 'object') ? (msg.content as Record<string, unknown>) : null
  const texto: string = (
    (msg.text as string) ||
    (typeof msg.content === 'string' ? msg.content : '') ||
    (conteudoObj?.text as string) ||
    (conteudoObj?.caption as string) ||
    ''
  ).trim()
  const remoteJid: string = (msg.chatid as string) || ''
  const messageType: string = ((msg.messageType as string) || (msg.type as string) || 'conversation').toLowerCase()
  const isAudio = messageType === 'audiomessage' || messageType === 'pttmessage'
  const isImage = messageType === 'imagemessage'

  const telefone = remoteJid.replace('@s.whatsapp.net', '')
  const pushName: string = (msg.senderName as string) || ''
  const instanciaToken: string = (body.token as string) || ''
  const uazapiBase: string = ((body.BaseUrl as string) || '').replace(/\/+$/, '')

  const isLid = remoteJid.endsWith('@lid')
  if (isGroup || wasSentByApi || !remoteJid || isLid) {
    await log(supabase, '2_ignorado_filtro', { fromMe, isGroup, wasSentByApi, texto, remoteJid, isLid })
    return NextResponse.json({ ok: true })
  }
  if (!isAudio && !isImage && !texto) {
    await log(supabase, '2_ignorado_sem_texto', { messageType })
    return NextResponse.json({ ok: true })
  }

  // Mensagem enviada manualmente pelo celular (não pelo sistema): salva como agente e retorna
  if (fromMe && !wasSentByApi) {
    await log(supabase, '2_manual_fromMe', { telefone, texto })

    // Resolve userId pelo token da instância
    let userIdManual: string | null = null
    if (instanciaToken) {
      const { data: inst } = await supabase
        .from('instancias_whatsapp')
        .select('user_id')
        .eq('token', instanciaToken)
        .maybeSingle()
      userIdManual = inst?.user_id ?? null
    }

    await supabase.from('mensagens_whatsapp').upsert({
      numero_cliente: telefone,
      mensagem: texto,
      quem_mandou: 'agente',
      status: 'enviada',
      message_id: (msg.messageid as string) || null,
      data_criacao: new Date().toISOString(),
      ...(userIdManual ? { user_id: userIdManual } : {}),
    }, { onConflict: 'message_id', ignoreDuplicates: true })

    const agora = new Date().toISOString()
    const { data: clienteManual } = await supabase
      .from('clientes')
      .select('id')
      .eq('telefone', telefone)
      .eq('user_id', userIdManual ?? '')
      .maybeSingle()

    if (clienteManual) {
      await supabase.from('clientes')
        .update({ dt_ultima_mensagem: agora, instancia_id: instanciaToken })
        .eq('id', clienteManual.id)
    } else if (userIdManual) {
      await supabase.from('clientes').insert({
        nome: pushName || telefone,
        telefone,
        instancia_id: instanciaToken,
        dt_ultima_mensagem: agora,
        user_id: userIdManual,
      })
    }

    return NextResponse.json({ ok: true })
  }

  // Resolve user_id a partir do token da instância
  let userId: string | null = null
  if (instanciaToken) {
    const { data: instancia } = await supabase
      .from('instancias_whatsapp')
      .select('user_id')
      .eq('token', instanciaToken)
      .maybeSingle()
    userId = instancia?.user_id ?? null
  }

  // Fallback: busca user_id pelo telefone do cliente (caso RLS bloqueie instancias_whatsapp)
  if (!userId) {
    const { data: clienteFallback } = await supabase
      .from('clientes')
      .select('user_id')
      .eq('telefone', telefone)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    userId = clienteFallback?.user_id ?? null
  }

  await log(supabase, '3_processando', { telefone, texto, instanciaToken, uazapiBase, userId })

  // 1. Upsert cliente
  const clienteQuery = supabase
    .from('clientes')
    .select('id, ia_desabilitada, historico_sincronizado, dados_coletados, foto, assigned_user_id')
    .eq('telefone', telefone)
  if (userId) clienteQuery.eq('user_id', userId)
  const { data: clienteExistente } = await clienteQuery.maybeSingle()

  let clienteId: number | null = clienteExistente?.id ?? null

  if (clienteExistente) {
    await supabase.from('clientes')
      .update({ dt_ultima_mensagem: new Date().toISOString(), instancia_id: instanciaToken })
      .eq('id', clienteExistente.id)
  } else {
    const { data: novoCliente } = await supabase.from('clientes').insert({
      nome: pushName || telefone,
      telefone,
      instancia_id: instanciaToken,
      dt_ultima_mensagem: new Date().toISOString(),
      ...(userId ? { user_id: userId } : {}),
    }).select('id').single()
    clienteId = novoCliente?.id ?? null
  }

  // 1a. Distribuição automática para atendentes (apenas se é novo cliente e workspace tem atendentes)
  if (clienteId && userId && !clienteExistente) {
    try {
      // Resolve o workspace admin ID
      const { data: usuarioAtual } = await supabase
        .from('usuarios')
        .select('parent_id')
        .eq('id', userId)
        .maybeSingle()

      const workspaceAdminId = usuarioAtual?.parent_id ?? userId

      await atribuirClienteAAtendente(
        supabase,
        clienteId,
        workspaceAdminId,
        pushName || telefone,
        telefone
      )
    } catch (e) {
      await log(supabase, '1a_distribuicao_erro', { error: String(e), clienteId })
    }
  }

  // 1b. Busca a foto de perfil do WhatsApp se ainda não temos uma
  if (clienteId && uazapiBase && instanciaToken && !clienteExistente?.foto) {
    const foto = await buscarFotoPerfil(uazapiBase, instanciaToken, telefone)
    if (foto) await supabase.from('clientes').update({ foto }).eq('id', clienteId)
  }

  // 2. Sincroniza histórico automaticamente na primeira vez
  const precisaSincronizar = !clienteExistente?.historico_sincronizado
  if (precisaSincronizar && uazapiBase && instanciaToken && userId && clienteId) {
    try {
      await sincronizarHistorico(supabase, remoteJid, instanciaToken, uazapiBase, userId)
      await supabase.from('clientes').update({ historico_sincronizado: true }).eq('id', clienteId)
      await log(supabase, '3_historico_sincronizado', { clienteId, chatid: remoteJid })
    } catch (e) {
      await log(supabase, '3_historico_erro', { error: String(e) })
    }
  }

  if (clienteExistente?.ia_desabilitada) {
    await log(supabase, '3_ia_desabilitada', { telefone })
    await supabase.from('mensagens_whatsapp').insert({
      numero_cliente: telefone,
      mensagem: texto || (isAudio ? '[Áudio]' : isImage ? '[Imagem]' : ''),
      quem_mandou: 'cliente',
      status: 'recebida',
      message_id: (msg.messageid as string) || null,
      ...(userId ? { user_id: userId } : {}),
    })
    return NextResponse.json({ ok: true })
  }

  // 3. Deduplicação por message_id
  const messageId = (msg.messageid as string) || null
  if (messageId) {
    const { data: jaExiste } = await supabase
      .from('mensagens_whatsapp')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle()
    if (jaExiste) {
      await log(supabase, '3_webhook_duplicado', { messageId })
      return NextResponse.json({ ok: true })
    }
  }

  // 4. Carrega config (necessário antes de baixar mídia)
  const [config, tenantConfig] = await Promise.all([
    readConfig(),
    userId ? readTenantConfig(userId) : Promise.resolve(null),
  ])

  const openaiKey = tenantConfig?.openaiKey || ''
  const iaAtiva = tenantConfig?.iaAtiva !== false
  await log(supabase, '4_config', { temOpenaiKey: !!openaiKey, iaAtiva, uazapiUrl: config.uazapiUrl, userId })

  if (!iaAtiva) {
    await log(supabase, '4_ia_desativada_globalmente', { userId })
    return NextResponse.json({ ok: true })
  }

  if (!openaiKey) {
    await log(supabase, '4_sem_openai_key', {})
    return NextResponse.json({ ok: true })
  }

  // 5. Resolve inputTexto — transcreve áudio ou descreve imagem via UAZAPI + OpenAI
  let inputTexto = texto
  let mediaUrl: string | null = null
  let mediaType: string | null = null

  if (isAudio || isImage) {
    const msgIdMidia = (msg.messageid as string) || ''
    if (msgIdMidia && uazapiBase && instanciaToken) {
      try {
        const dlRes = await fetch(`${uazapiBase}/message/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: instanciaToken },
          body: JSON.stringify({
            id: msgIdMidia,
            transcribe: isAudio,
            generate_mp3: isAudio,
            return_link: true,
            ...(isAudio ? { openai_apikey: openaiKey } : {}),
          }),
        })

        if (dlRes.ok) {
          const dlData = await dlRes.json()
          const fileURL: string = dlData.fileURL || ''
          await log(supabase, '5_midia_download', { isAudio, isImage, temTranscricao: !!dlData.transcription, temURL: !!fileURL })

          if (isAudio) {
            if (fileURL) mediaUrl = fileURL
            mediaType = 'audio'
            if (dlData.transcription) {
              inputTexto = dlData.transcription
            } else {
              inputTexto = '[cliente enviou um áudio]'
            }
          } else if (isImage && fileURL) {
            mediaUrl = fileURL
            mediaType = 'image'
            const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Descreva de forma objetiva o que está nesta imagem, focando no contexto de atendimento ao cliente.' },
                    { type: 'image_url', image_url: { url: fileURL } },
                  ],
                }],
                max_tokens: 400,
              }),
            })
            if (visionRes.ok) {
              const visionData = await visionRes.json()
              const descricao = ((visionData.choices?.[0]?.message?.content as string) || '').trim()
              inputTexto = descricao || '[cliente enviou uma imagem]'
            } else {
              inputTexto = '[cliente enviou uma imagem]'
            }
          }
        } else {
          await log(supabase, '5_midia_download_erro', { status: dlRes.status })
        }
      } catch (e) {
        await log(supabase, '5_midia_erro', { error: String(e) })
      }
    }

    if (!inputTexto) {
      await log(supabase, '5_midia_sem_texto', { messageType })
      return NextResponse.json({ ok: true })
    }
  }

  // 6. Salva mensagem recebida com texto real (transcrição/descrição para áudio/imagem)
  //    INSERT (não upsert) para dedup ATÔMICO: dois webhooks quase simultâneos podem
  //    passar pelo SELECT do passo 3; aqui a constraint unique de message_id garante que
  //    só um grava. O duplicado recebe 23505 e retornamos ANTES de responder de novo.
  console.log('[WEBHOOK] Inserindo mensagem:', { telefone, userId, temMensagem: !!inputTexto, messageId })

  const { error: insertRecebidaErr } = await supabase.from('mensagens_whatsapp').insert({
    numero_cliente: telefone,
    mensagem: inputTexto,
    quem_mandou: 'cliente',
    status: 'recebida',
    message_id: messageId,
    data_criacao: new Date().toISOString(),
    ...(mediaUrl ? { media_url: mediaUrl } : {}),
    ...(mediaType ? { media_type: mediaType } : {}),
    ...(userId ? { user_id: userId } : {}),
  })

  console.log('[WEBHOOK] Insert result:', { erro: !!insertRecebidaErr, code: insertRecebidaErr?.code, message: insertRecebidaErr?.message })

  if (insertRecebidaErr) {
    await log(supabase, '6_insert_recebida_erro', { code: insertRecebidaErr.code, message: insertRecebidaErr.message })
    if (messageId && insertRecebidaErr.code === '23505') {
      // Webhook duplicado (mesmo message_id) — não responde de novo
      return NextResponse.json({ ok: true })
    }
    // Outro erro: segue o fluxo (mantém o comportamento anterior de tentar responder)
  }

  // 7. Verifica fluxos ativos antes de chamar a IA
  if (userId && clienteId) {
    const flowHandled = await handleFlowExecution(supabase, {
      userId,
      clienteId,
      telefone,
      inputTexto,
      instanciaToken,
      uazapiBase,
      openaiKey,
    }).catch(() => false)
    if (flowHandled) return NextResponse.json({ ok: true })
  }

  // 8. Monta system prompt e histórico
  const baseQuery = supabase.from('base_conhecimento').select('conteudo').order('gerado_em', { ascending: false }).limit(1)
  const promptQuery = supabase.from('treinamento_prompt').select('conteudo').limit(1)
  const qaQuery = supabase.from('treinamento_qa').select('pergunta, resposta').order('created_at', { ascending: true })
  const textosQuery = supabase.from('treinamento_textos').select('titulo, conteudo').order('created_at', { ascending: true })

  if (userId) {
    baseQuery.eq('user_id', userId)
    promptQuery.eq('user_id', userId)
    qaQuery.eq('user_id', userId)
    textosQuery.eq('user_id', userId)
  }

  const coletaQuery = supabase.from('coleta_dados_config').select('ativo, campos')
  if (userId) coletaQuery.eq('user_id', userId)

  const [templateGlobalRes, baseRes, promptRes, qaRes, textosRes, historicoRes, coletaRes] = await Promise.all([
    supabase.from('configuracoes').select('valor').eq('chave', 'prompt_template').maybeSingle(),
    baseQuery.maybeSingle(),
    promptQuery.maybeSingle(),
    qaQuery,
    textosQuery,
    (() => {
      const q = supabase.from('mensagens_whatsapp').select('mensagem, quem_mandou').eq('numero_cliente', telefone).order('data_criacao', { ascending: false }).limit(20)
      if (userId) q.eq('user_id', userId)
      return q
    })(),
    coletaQuery.maybeSingle(),
  ])

  // Config de coleta de dados (campos a obter do cliente)
  const coletaAtiva = coletaRes.data?.ativo === true
  const camposColeta: CampoColeta[] = Array.isArray(coletaRes.data?.campos) ? coletaRes.data.campos : []
  const dadosColetados = (clienteExistente?.dados_coletados as Record<string, unknown>) ?? {}

  const globalTemplate: string = templateGlobalRes.data?.valor ?? ''

  let systemPrompt: string
  if (globalTemplate) {
    const promptText = promptRes.data?.conteudo ?? ''
    const qaText = (qaRes.data ?? [])
      .map((qa: { pergunta: string; resposta: string }) => `P: ${qa.pergunta}\nR: ${qa.resposta}`)
      .join('\n\n')
    const textosText = (textosRes.data ?? [])
      .map((t: { titulo: string; conteudo: string }) => `### ${t.titulo}\n${t.conteudo}`)
      .join('\n\n')

    systemPrompt = globalTemplate
      .replace(/\{\{prompt\}\}/gi, promptText)
      .replace(/\{\{qa\}\}/gi, qaText)
      .replace(/\{\{textos\}\}/gi, textosText)
  } else {
    systemPrompt = baseRes.data?.conteudo
      || promptRes.data?.conteudo
      || 'Você é um assistente de atendimento via WhatsApp. Seja cordial e objetivo.'

    const qas = qaRes.data ?? []
    if (qas.length > 0) {
      const pares = qas.map((qa: { pergunta: string; resposta: string }) => `P: ${qa.pergunta}\nR: ${qa.resposta}`).join('\n\n')
      systemPrompt += `\n\n---\nPerguntas e respostas frequentes:\n${pares}`
    }

    const textos = textosRes.data ?? []
    if (textos.length > 0) {
      const textosText = textos.map((t: { titulo: string; conteudo: string }) => `### ${t.titulo}\n${t.conteudo}`).join('\n\n')
      systemPrompt += `\n\n---\nConteúdo de apoio:\n${textosText}`
    }
  }

  // Injeta data/hora atual (Brasília) para que a IA possa verificar horários de entrega
  const agora = new Date()
  const dataHoraAtual = agora.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  systemPrompt += `\n\n---\nData e hora atual (horário de Brasília): ${dataHoraAtual}`

  // Se já há histórico de conversa, instrui a IA a não repetir saudações
  const qtdHistorico = (historicoRes.data ?? []).length
  if (qtdHistorico > 2) {
    systemPrompt += '\n\nIMPORTANTE: Você já está no meio de uma conversa com este cliente. NÃO envie saudação (oi, olá, tudo certo, etc.) novamente. Responda diretamente à última mensagem do cliente, mantendo o contexto do que já foi discutido.'
  }

  // Coleta de dados — instrui a IA a obter, de forma natural, os campos que ainda faltam
  if (coletaAtiva && camposColeta.length > 0) {
    const faltantes = camposColeta.filter((c) => {
      const v = dadosColetados?.[c.chave]
      return v === undefined || v === null || String(v).trim() === ''
    })
    if (faltantes.length > 0) {
      const labels = faltantes.map((c) => c.label).join(', ')
      systemPrompt += `\n\n---\nIMPORTANTE: Durante a conversa, de forma natural e educada (sem parecer um formulário), procure obter do cliente os seguintes dados que ainda não temos: ${labels}. Não peça todos de uma vez nem insista caso o cliente não queira informar.`
    }
  }

  const mensagensHistorico = [...(historicoRes.data ?? [])].reverse()
    .map((m: { mensagem: string; quem_mandou: string }) => ({
      role: m.quem_mandou === 'cliente' ? ('user' as const) : ('assistant' as const),
      content: m.mensagem,
    }))

  // 8. Chama OpenAI para resposta + qualificação em paralelo
  let resposta = ''
  try {
    const [openaiRes] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...mensagensHistorico],
          temperature: 0.7,
        }),
      }),
      (userId && clienteId && openaiKey)
        ? qualificarLead(supabase, userId, clienteId, inputTexto, openaiKey)
            .then(secaoId => {
              if (secaoId && userId && clienteId) {
                dispatchKanbanFlows(supabase, userId, clienteId, secaoId).catch(() => {})
              }
            })
            .catch(() => {})
        : Promise.resolve(),
      (clienteId && openaiKey && coletaAtiva && camposColeta.length > 0)
        ? extrairDadosCliente(supabase, clienteId, camposColeta, dadosColetados, inputTexto, openaiKey).catch(() => {})
        : Promise.resolve(),
    ])

    const openaiData = await openaiRes.json()
    await log(supabase, '5_openai', { status: openaiRes.status, error: openaiData.error })

    if (!openaiRes.ok) return NextResponse.json({ ok: true })
    resposta = ((openaiData.choices[0]?.message?.content as string) || '').trim()
  } catch (e) {
    await log(supabase, '5_openai_erro', { error: String(e) })
    return NextResponse.json({ ok: true })
  }

  if (!resposta) return NextResponse.json({ ok: true })

  // 9. Envia via UAZAPI
  const urlEnvio = uazapiBase || config.uazapiUrl?.replace(/\/+$/, '') || ''
  const tokenEnvio = instanciaToken

  if (!urlEnvio || !tokenEnvio) {
    await log(supabase, '6_sem_instancia_token', { urlEnvio, instanciaToken })
    return NextResponse.json({ ok: true })
  }

  await log(supabase, '6_enviando', { urlEnvio, tokenEnvio: tokenEnvio.slice(0, 8) + '...', telefone, resposta })

  const sendRes = await fetch(`${urlEnvio}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: tokenEnvio },
    body: JSON.stringify({ number: telefone, text: resposta }),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }))

  const sendData = await (sendRes as Response).json().catch(() => ({}))
  await log(supabase, '7_uazapi_send', { status: (sendRes as Response).status, body: sendData })

  // 10. Salva resposta do agente
  await supabase.from('mensagens_whatsapp').insert({
    numero_cliente: telefone,
    mensagem: resposta,
    quem_mandou: 'agente',
    status: 'enviada',
    data_criacao: new Date().toISOString(),
    ...(userId ? { user_id: userId } : {}),
  })

  return NextResponse.json({ ok: true })
}

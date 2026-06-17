import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { enviarEmailConfirmacaoAgendamento } from '@/lib/resend-email'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function getAccessToken(config: { google_access_token: string; google_refresh_token: string | null; user_id: string }) {
  if (!config.google_access_token) return null

  // Testa se o token atual é válido
  const test = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + config.google_access_token)
  if (test.ok) return config.google_access_token

  // Token expirado — usa refresh token
  if (!config.google_refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: config.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  if (!data.access_token) return null

  // Salva novo access token
  const supabase = getSupabase()
  await supabase
    .from('agenda_config')
    .update({ google_access_token: data.access_token })
    .eq('user_id', config.user_id)

  return data.access_token as string
}

async function criarEventoCalendar(accessToken: string, calendarId: string, evento: {
  titulo: string; nome: string; email: string | null; telefone: string; assunto: string | null;
  dataHoraInicio: string; dataHoraFim: string
}) {
  const body = {
    summary: `${evento.titulo} — ${evento.nome}`,
    description: [
      evento.assunto ? `Assunto: ${evento.assunto}` : null,
      `Telefone: ${evento.telefone}`,
      evento.email ? `E-mail: ${evento.email}` : null,
    ].filter(Boolean).join('\n'),
    start: { dateTime: evento.dataHoraInicio, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: evento.dataHoraFim,   timeZone: 'America/Sao_Paulo' },
    attendees: [
      { email: 'projetodoisclicks@gmail.com', responseStatus: 'accepted' },
      ...(evento.email ? [{ email: evento.email }] : []),
    ],
    conferenceData: {
      createRequest: {
        requestId: `zapbot-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  return res.json()
}

async function enviarWhatsApp(uazapiBase: string, instanceToken: string, telefone: string, texto: string): Promise<string> {
  try {
    const base = uazapiBase.replace(/\/+$/, '').replace(/\/send\/.*$/, '')
    const res = await fetch(`${base}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({ number: telefone, text: texto }),
    })
    if (res.ok) return 'ok'
    const t = await res.text().catch(() => '')
    return `http_${res.status}: ${t.slice(0, 150)}`
  } catch (e) {
    return e instanceof Error ? e.message : 'fetch_falhou'
  }
}

export async function POST(request: NextRequest) {
  const { slug, nome, telefone, email, assunto, data, hora } = await request.json()

  if (!slug || !nome || !telefone || !data || !hora) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Busca config pelo slug
  const { data: config } = await supabase
    .from('agenda_config')
    .select('*')
    .eq('slug', slug)
    .eq('ativo', true)
    .single()

  if (!config) return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })

  console.log('[AGENDAR] Config encontrada:', { slug, user_id: config.user_id, titulo: config.titulo })

  // Se não tem Google conectado, procura na árvore (no pai)
  let configGoogle = config
  if (!config.google_access_token) {
    console.log('[AGENDAR] Usuário sem Google, procurando na árvore...')
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('parent_id')
      .eq('id', config.user_id)
      .single()

    if (usuario?.parent_id) {
      const { data: configPai } = await supabase
        .from('agenda_config')
        .select('*')
        .eq('user_id', usuario.parent_id)
        .eq('ativo', true)
        .single()

      if (configPai?.google_access_token) {
        console.log('[AGENDAR] Encontrado Google na árvore (pai)')
        configGoogle = configPai
      }
    }
  }

  // Verifica se o slot ainda está disponível
  const [sh, sm] = hora.split(':').map(Number)
  const dataHoraInicio = new Date(`${data}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00-03:00`)
  const dataHoraFim = new Date(dataHoraInicio.getTime() + config.duracao_minutos * 60000)

  const { data: conflito } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('user_id', config.user_id)
    .eq('status', 'confirmado')
    .gte('data_hora', dataHoraInicio.toISOString())
    .lt('data_hora', dataHoraFim.toISOString())
    .limit(1)

  if (conflito && conflito.length > 0) {
    return NextResponse.json({ error: 'Horário não disponível' }, { status: 409 })
  }

  // Cria agendamento no banco
  const { data: agendamento, error: errAg } = await supabase
    .from('agendamentos')
    .insert({
      user_id: config.user_id,
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email?.trim() || null,
      assunto: assunto?.trim() || null,
      data_hora: dataHoraInicio.toISOString(),
      duracao_minutos: config.duracao_minutos,
      status: 'confirmado',
    })
    .select()
    .single()

  if (errAg) return NextResponse.json({ error: errAg.message }, { status: 500 })

  let meetLink: string | null = null
  let googleEventId: string | null = null
  let googleErro: string | null = null

  // Cria evento no Google Calendar
  console.log('[MEET] google_access_token presente?', !!configGoogle.google_access_token)
  console.log('[MEET] google_calendar_id?', configGoogle.google_calendar_id)

  if (configGoogle.google_access_token) {
    try {
      console.log('[MEET] Token presente, validando...')
      const accessToken = await getAccessToken(configGoogle)
      console.log('[MEET] Access token após validação?', !!accessToken)

      if (accessToken) {
        console.log('[MEET] Criando evento no Google Calendar...')
        const evento = await criarEventoCalendar(accessToken, configGoogle.google_calendar_id, {
          titulo: config.titulo,
          nome: nome.trim(),
          email: email?.trim() || null,
          telefone: telefone.trim(),
          assunto: assunto?.trim() || null,
          dataHoraInicio: dataHoraInicio.toISOString(),
          dataHoraFim: dataHoraFim.toISOString(),
        })
        console.log('[MEET] Resposta do Google:', { temError: !!evento.error, temConference: !!evento.conferenceData, temId: !!evento.id })

        if (evento.error) {
          googleErro = `${evento.error.code}: ${evento.error.message}`
          console.log('[MEET] Erro do Google:', googleErro)
        } else {
          meetLink = evento.conferenceData?.entryPoints?.find((e: { entryPointType: string; uri: string }) => e.entryPointType === 'video')?.uri ?? null
          googleEventId = evento.id ?? null
          console.log('[MEET] Link gerado?', !!meetLink)
          await supabase
            .from('agendamentos')
            .update({ google_event_id: googleEventId, meet_link: meetLink })
            .eq('id', agendamento.id)
        }
      } else {
        googleErro = 'token_invalido_ou_expirado'
        console.log('[MEET]', googleErro)
      }
    } catch (e) {
      googleErro = e instanceof Error ? e.message : 'erro_desconhecido'
      console.log('[MEET] Erro na catch:', googleErro)
    }
  } else {
    googleErro = 'google_nao_conectado'
    console.log('[MEET]', googleErro)
  }

  // Envia Email de confirmação
  let emailDebug = 'nao_tentado'
  if (email?.trim()) {
    try {
      const emailEnviado = await enviarEmailConfirmacaoAgendamento(
        email.trim(),
        nome.trim(),
        dataHoraInicio,
        config.duracao_minutos,
        telefone.trim(),
        assunto?.trim(),
        meetLink || undefined
      )
      emailDebug = emailEnviado ? 'ok' : 'falha_ao_enviar'
    } catch (e) {
      emailDebug = `excecao: ${e instanceof Error ? e.message : 'desconhecida'}`
    }
  } else {
    emailDebug = 'sem_email_do_cliente'
  }

  // Envia WhatsApp de confirmação
  let whatsappDebug = 'nao_tentado'
  if (!config.whatsapp_instancia_id) {
    whatsappDebug = 'sem_instancia_na_config_da_agenda'
  } else {
    try {
      const { data: instancia } = await supabase
        .from('instancias_whatsapp')
        .select('token')
        .eq('id', config.whatsapp_instancia_id)
        .single()

      const appConfig = await readConfig()
      const uazapiUrl = appConfig.uazapiUrl || ''

      if (!instancia?.token) {
        whatsappDebug = 'instancia_sem_token'
      } else if (!uazapiUrl) {
        whatsappDebug = 'sem_uazapi_url'
      } else {
        const dataFormatada = dataHoraInicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
        const horaFormatada = dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false })

        let msg = `Olá, ${nome.trim()}! ✅\n\n`
        msg += `Seu agendamento foi confirmado:\n`
        msg += `📅 ${dataFormatada}\n`
        msg += `⏰ ${horaFormatada}\n`
        msg += `⏱ Duração: ${config.duracao_minutos} minutos\n`
        if (assunto) msg += `📋 Assunto: ${assunto.trim()}\n`
        if (meetLink) msg += `\n🎥 Link do Google Meet:\n${meetLink}`

        whatsappDebug = await enviarWhatsApp(uazapiUrl, instancia.token, telefone.trim(), msg)
        if (whatsappDebug === 'ok') {
          await supabase.from('agendamentos').update({ whatsapp_enviado: true }).eq('id', agendamento.id)
        }
      }
    } catch (e) {
      whatsappDebug = `excecao: ${e instanceof Error ? e.message : 'desconhecida'}`
    }
  }

  return NextResponse.json({
    ok: true,
    agendamento: { id: agendamento.id, data_hora: agendamento.data_hora },
    meet_link: meetLink,
    _debug: {
      google_token_presente: !!config.google_access_token,
      google_erro: googleErro,
      email: emailDebug,
      whatsapp_instancia_configurada: !!config.whatsapp_instancia_id,
      whatsapp: whatsappDebug,
    },
  })
}

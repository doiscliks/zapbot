import { createClient } from '@supabase/supabase-js'

interface GoogleMeetLink {
  link: string
  eventId: string
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}


async function renovarTokenGoogle(userId: string, refreshToken: string): Promise<string | null> {
  try {
    console.log('[MEET] Renovando token...')

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[MEET] Credenciais Google não configuradas')
      return null
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('[MEET] Erro ao renovar:', response.status)
      return null
    }

    const tokens = await response.json()

    if (!tokens.access_token) {
      console.error('[MEET] Novo token não recebido')
      return null
    }

    // Atualiza no banco
    const supabase = getSupabase()
    await supabase
      .from('agenda_config')
      .update({
        google_access_token: tokens.access_token,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    console.log('[MEET] Token renovado com sucesso')
    return tokens.access_token
  } catch (error) {
    console.error('[MEET] Erro ao renovar token:', error)
    return null
  }
}

export async function gerarLinkMeetComCalendar(
  titulo: string,
  dataHoraInicio: Date,
  dataHoraFim: Date,
  nomeCliente: string,
  emailCliente?: string,
  telefoneCliente?: string,
  assuntoCliente?: string,
  userId?: string
): Promise<GoogleMeetLink | null> {
  try {
    console.log('[MEET] Iniciando geração...')

    if (!userId) {
      console.error('[MEET] userId não fornecido')
      return null
    }

    const supabase = getSupabase()
    console.log('[MEET] Buscando config...')

    const { data: config, error } = await supabase
      .from('agenda_config')
      .select('google_access_token, google_refresh_token')
      .eq('user_id', userId)
      .single()

    console.log('[MEET] Config:', { temToken: !!config?.google_access_token, temRefresh: !!config?.google_refresh_token, erro: error })

    if (error || !config?.google_access_token) {
      console.error('[MEET] Token não configurado:', error)
      return null
    }

    let accessToken = config.google_access_token
    console.log('[MEET] Token original:', accessToken.slice(0, 20) + '...')

    // Se tem refresh token, tenta renovar
    if (config.google_refresh_token) {
      console.log('[MEET] Tentando renovar token...')
      const novoToken = await renovarTokenGoogle(userId, config.google_refresh_token)
      if (novoToken) {
        accessToken = novoToken
        console.log('[MEET] Token renovado com sucesso:', novoToken.slice(0, 20) + '...')
      } else {
        console.log('[MEET] Falha ao renovar, usando token original')
      }
    } else {
      console.log('[MEET] Sem refresh token, usando access token atual')
    }

    // Cria evento no calendário SEM Meet primeiro
    const eventData = {
      summary: titulo,
      description: `Cliente: ${nomeCliente}\nTelefone: ${telefoneCliente}${assuntoCliente ? `\nAssunto: ${assuntoCliente}` : ''}`,
      start: {
        dateTime: dataHoraInicio.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: dataHoraFim.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    }

    console.log('[MEET] Criando evento no calendário...')

    const createResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventData),
    })

    console.log('[MEET] Create response status:', createResponse.status)

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('[MEET] Erro ao criar evento:', createResponse.status, errorText)
      return null
    }

    const event = await createResponse.json()
    console.log('[MEET] Evento criado:', event.id)

    // Agora adiciona Meet via PATCH
    console.log('[MEET] Adicionando Google Meet ao evento...')

    const patchData = {
      conferenceData: {
        generateConferenceRequest: {
          conferenceSolutionKey: {
            key: 'hangoutsMeet',
          },
        },
      },
    }

    const patchResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}?conferenceDataVersion=1`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(patchData),
      }
    )

    console.log('[MEET] Patch response status:', patchResponse.status)

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text()
      console.error('[MEET] Erro ao adicionar Meet:', patchResponse.status, errorText)
      return null
    }

    const eventWithMeet = await patchResponse.json()
    console.log('[MEET] Conference data:', JSON.stringify(eventWithMeet.conferenceData, null, 2))

    const meetLink = eventWithMeet.conferenceData?.entryPoints?.[0]?.uri || null
    console.log('[MEET] Link gerado pelo Google:', meetLink)

    if (!meetLink) {
      console.error('[MEET] Google não gerou o link de Meet')
      return null
    }

    return {
      link: meetLink,
      eventId: eventWithMeet.id,
    }
  } catch (error) {
    console.error('[MEET] Erro catch:', error)
    return null
  }
}

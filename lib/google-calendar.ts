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
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[GOOGLE] Credenciais não configuradas')
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
      console.error('[GOOGLE] Erro ao renovar token:', response.status)
      return null
    }

    const tokens = await response.json()

    if (!tokens.access_token) {
      console.error('[GOOGLE] Novo access token não recebido')
      return null
    }

    const supabase = getSupabase()
    await supabase
      .from('agenda_config')
      .update({
        google_access_token: tokens.access_token,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    console.log('[GOOGLE] Token renovado com sucesso')
    return tokens.access_token
  } catch (error) {
    console.error('[GOOGLE] Erro ao renovar token:', error)
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
    if (!userId) {
      console.error('[GOOGLE] userId não fornecido')
      return null
    }

    const supabase = getSupabase()

    const { data: config, error } = await supabase
      .from('agenda_config')
      .select('google_access_token, google_refresh_token')
      .eq('user_id', userId)
      .single()

    if (error || !config?.google_access_token) {
      console.error('[GOOGLE] Token não configurado:', error)
      return null
    }

    let accessToken = config.google_access_token

    if (config.google_refresh_token) {
      console.log('[GOOGLE] Tentando renovar token...')
      const novoToken = await renovarTokenGoogle(userId, config.google_refresh_token)
      if (novoToken) {
        accessToken = novoToken
      }
    }

    // Cria evento com Google Meet via conferenceData
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
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: {
            key: 'hangoutsMeet',
          },
        },
      },
    }

    console.log('[GOOGLE] Criando evento com Google Meet...')

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GOOGLE] Erro ao criar evento:', response.status, errorText)
      return null
    }

    const event = await response.json()

    const meetLink = event.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri

    if (!meetLink) {
      console.error('[GOOGLE] Google Meet link não encontrado')
      return null
    }

    console.log('[GOOGLE] Google Meet criado com sucesso:', meetLink)

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('[GOOGLE] Erro geral:', error)
    return null
  }
}

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

function gerarMeetIdUnico(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const grupos = [3, 4, 3]
  const partes: string[] = []
  for (const tamanho of grupos) {
    let grupo = ''
    for (let i = 0; i < tamanho; i++) {
      grupo += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    partes.push(grupo)
  }
  return partes.join('-')
}

async function criarEventoComConferencia(
  accessToken: string,
  titulo: string,
  dataHoraInicio: Date,
  dataHoraFim: Date,
  nomeCliente: string,
  telefoneCliente?: string,
  assuntoCliente?: string
): Promise<string | null> {
  try {
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
      console.log('[MEET] ConferenceData falhou, usando fallback:', response.status)
      return null
    }

    const event = await response.json()
    const meetLink = event.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri

    if (meetLink) {
      console.log('[MEET] Google Meet válido criado via API')
      return meetLink
    }

    return null
  } catch (error) {
    console.log('[MEET] ConferenceData exception, usando fallback')
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
      console.error('[MEET] userId não fornecido')
      return null
    }

    const supabase = getSupabase()

    const { data: config, error } = await supabase
      .from('agenda_config')
      .select('google_access_token')
      .eq('user_id', userId)
      .single()

    if (error || !config?.google_access_token) {
      console.error('[MEET] Token não configurado')
      return null
    }

    // Cria com conferenceData (Google Meet válido)
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

    console.log('[MEET] Criando evento com Google Meet...')

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.google_access_token}`,
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[MEET] Erro resposta:', response.status, errorText)
      return null
    }

    const event = await response.json()

    const meetLink = event.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri

    if (!meetLink) {
      console.error('[MEET] Link não encontrado na resposta:', JSON.stringify(event.conferenceData))
      return null
    }

    console.log('[MEET] Google Meet criado:', meetLink)

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('[MEET] Erro:', error)
    return null
  }
}

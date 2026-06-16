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

    const accessToken = config.google_access_token

    // Criar evento com Google Meet usando conferenceData
    const requestId = `meet-${Date.now()}`

    const eventPayload = {
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
          requestId: requestId,
          conferenceSolutionKey: {
            key: 'hangoutsMeet',
          },
        },
      },
    }

    console.log('[MEET] Criando evento com conferenceData...')

    const createResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(eventPayload),
      }
    )

    if (!createResponse.ok) {
      const errorData = await createResponse.text()
      console.error('[MEET] Erro na criação:', createResponse.status, errorData)
      return null
    }

    const eventData = await createResponse.json()

    // Extrair o link do Google Meet
    const meetLink = eventData.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri

    if (!meetLink) {
      console.error('[MEET] Link não encontrado na resposta')
      return null
    }

    console.log('[MEET] Google Meet link criado:', meetLink)

    return {
      link: meetLink,
      eventId: eventData.id,
    }
  } catch (error) {
    console.error('[MEET] Erro:', error)
    return null
  }
}

import { JWT } from 'google-auth-library'

interface GoogleMeetLink {
  link: string
  eventId: string
}

export async function gerarLinkMeetComCalendar(
  titulo: string,
  dataHoraInicio: Date,
  dataHoraFim: Date,
  nomeCliente: string,
  emailCliente?: string,
  telefoneCliente?: string,
  assuntoCliente?: string
): Promise<GoogleMeetLink | null> {
  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!serviceAccountJson) {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado')
      return null
    }

    const serviceAccount = JSON.parse(serviceAccountJson)

    // Cria JWT para autenticação
    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })

    const accessToken = await jwtClient.getAccessToken()

    // Prepara dados do evento
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
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            key: 'hangoutsMeet',
          },
        },
      },
      attendees: emailCliente ? [{ email: emailCliente }] : [],
    }

    // Cria evento no Google Calendar
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao criar evento no Google Calendar:', response.status, errorText)
      return null
    }

    const event = await response.json()

    if (!event.conferenceData?.entryPoints) {
      console.error('Evento criado mas sem Google Meet link')
      return null
    }

    // Extrai o link do Google Meet
    const meetLink = event.conferenceData.entryPoints.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri

    if (!meetLink) {
      console.error('Google Meet link não encontrado nos entry points')
      return null
    }

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('Erro ao gerar Google Meet link:', error)
    return null
  }
}

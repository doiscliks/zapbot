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

    // Prepara dados do evento com Google Meet
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
          requestId: `req-${Date.now()}`,
          conferenceSolutionKey: {
            key: 'eventHangout',
          },
        },
      },
    }

    // Cria evento no Google Calendar com conferenciaData
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify(eventData),
    })

    const responseData = await response.text()

    if (!response.ok) {
      console.error('Erro ao criar evento:', response.status, responseData)
      return null
    }

    const event = JSON.parse(responseData)

    // Extrai o Google Meet link
    const meetLink = event.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri

    if (!meetLink) {
      console.error('Google Meet link não gerado. Event data:', JSON.stringify(event.conferenceData))
      return null
    }

    console.log('Google Meet criado com sucesso:', meetLink)

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('Erro ao gerar Google Meet link:', error)
    return null
  }
}

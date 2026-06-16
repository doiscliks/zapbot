import { JWT } from 'google-auth-library'

interface GoogleMeetLink {
  link: string
  eventId: string
}

function gerarMeetIdUnico(): string {
  // Gera um ID aleatório no formato que Google Meet aceita
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let id = ''
  for (let i = 0; i < 25; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
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

    // Gera um Google Meet link único
    const meetId = gerarMeetIdUnico()
    const meetLink = `https://meet.google.com/${meetId}`

    // Prepara dados do evento com o Google Meet link
    const eventData = {
      summary: titulo,
      description: `Cliente: ${nomeCliente}\nTelefone: ${telefoneCliente}${assuntoCliente ? `\nAssunto: ${assuntoCliente}` : ''}\n\n🎥 Google Meet: ${meetLink}`,
      start: {
        dateTime: dataHoraInicio.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: dataHoraFim.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    }

    // Cria evento no Google Calendar
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
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

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('Erro ao gerar Google Meet link:', error)
    return null
  }
}

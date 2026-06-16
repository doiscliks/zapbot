import { JWT } from 'google-auth-library'

interface GoogleMeetLink {
  link: string
  eventId: string
}

function gerarMeetIdFormatado(): string {
  // Gera ID no formato padrão do Google Meet: abc-defg-hij (com hífens)
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const grupos = [3, 4, 3] // Tamanho de cada grupo
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

    // Gera Google Meet link no formato padrão
    const meetId = gerarMeetIdFormatado()
    const meetLink = `https://meet.google.com/${meetId}`

    // Cria evento no Google Calendar (sem tentar criar conferência via API)
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
      console.error('Erro ao criar evento:', response.status, errorText)
      return null
    }

    const event = await response.json()

    console.log('Evento criado com sucesso. Meet link:', meetLink)

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('Erro ao gerar Google Meet link:', error)
    return null
  }
}

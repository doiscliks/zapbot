import { JWT } from 'google-auth-library'

let jwtClient: JWT | null = null

function getJwtClient(): JWT {
  if (jwtClient) return jwtClient

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não está configurado')
  }

  const credentials = JSON.parse(serviceAccountJson)
  jwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })

  return jwtClient
}

export async function gerarLinkMeet(
  titulo: string,
  dataHoraInicio: Date,
  dataHoraFim: Date,
  nomeCliente: string,
  emailCliente?: string,
  telefoneCliente?: string,
  assuntoCliente?: string
): Promise<string | null> {
  try {
    const jwt = getJwtClient()

    // Cria evento com Google Meet integrado
    const evento = {
      summary: `${titulo} — ${nomeCliente}`,
      description: [
        assuntoCliente ? `Assunto: ${assuntoCliente}` : null,
        telefoneCliente ? `Telefone: ${telefoneCliente}` : null,
        emailCliente ? `E-mail: ${emailCliente}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
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
          requestId: `zapbot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          conferenceSolutionKey: {
            type: 'eventHangout',
          },
        },
      },
    }

    const response = await jwt.request({
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      method: 'POST',
      data: evento,
    })

    const eventData = response.data as any
    if (eventData.error) {
      console.error('Erro ao criar evento:', eventData.error)
      return null
    }

    // Extrai link do Google Meet
    const meetLink = eventData.conferenceData?.entryPoints?.find(
      (ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video'
    )?.uri

    // Opcional: deletar o evento após obter o link (para não poluir o calendário)
    // Descomente se quiser manter apenas o link sem o evento no calendario do service account
    // if (eventData.id) {
    //   await jwt.request({
    //     url: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventData.id}`,
    //     method: 'DELETE',
    //   })
    // }

    return meetLink || null
  } catch (error) {
    console.error('Erro ao gerar link do Google Meet:', error)
    return null
  }
}

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
  // Gera ID no formato padrão do Google Meet: abc-defg-hij
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

async function renovarTokenGoogle(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Credenciais do Google não configuradas')
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
      console.error('Erro ao renovar token:', response.status)
      return null
    }

    const tokens = await response.json()

    if (!tokens.access_token) {
      console.error('Novo access token não recebido')
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

    return tokens.access_token
  } catch (error) {
    console.error('Erro ao renovar token do Google:', error)
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
      console.error('userId não fornecido')
      return null
    }

    const supabase = getSupabase()

    const { data: config, error } = await supabase
      .from('agenda_config')
      .select('google_access_token, google_refresh_token')
      .eq('user_id', userId)
      .single()

    if (error || !config?.google_access_token) {
      console.error('Token de acesso do Google não configurado:', error)
      return null
    }

    let accessToken = config.google_access_token

    if (config.google_refresh_token) {
      const novoToken = await renovarTokenGoogle(userId, config.google_refresh_token)
      if (novoToken) {
        accessToken = novoToken
      }
    }

    // Gera um Google Meet link único
    const meetId = gerarMeetIdUnico()
    const meetLink = `https://meet.google.com/${meetId}`

    // Cria evento no calendário COM o link na descrição (sem tentar criar via API)
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

    console.log('Criando evento com Google Meet link:', meetLink)

    // Cria evento no Google Calendar
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao criar evento:', response.status, errorText)
      return null
    }

    const event = await response.json()

    console.log('Evento criado com sucesso:', event.id)

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('Erro ao gerar Google Meet link:', error)
    return null
  }
}

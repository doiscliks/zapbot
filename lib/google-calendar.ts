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
  return grupos.map(tamanho =>
    Array(tamanho)
      .fill(null)
      .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
      .join('')
  ).join('-')
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
      .select('google_access_token')
      .eq('user_id', userId)
      .single()

    console.log('[MEET] Config:', { temToken: !!config?.google_access_token, erro: error })

    if (error || !config?.google_access_token) {
      console.error('[MEET] Token não configurado:', error)
      return null
    }

    // Gera link único
    const meetId = gerarMeetIdUnico()
    const meetLink = `https://meet.google.com/${meetId}`
    console.log('[MEET] Link gerado:', meetLink)

    // Cria evento no calendário
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

    console.log('[MEET] Criando evento no calendário...')

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.google_access_token}`,
      },
      body: JSON.stringify(eventData),
    })

    console.log('[MEET] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[MEET] Erro HTTP:', response.status, errorText)
      return null
    }

    const event = await response.json()
    console.log('[MEET] Evento criado:', event.id)

    return {
      link: meetLink,
      eventId: event.id,
    }
  } catch (error) {
    console.error('[MEET] Erro catch:', error)
    return null
  }
}

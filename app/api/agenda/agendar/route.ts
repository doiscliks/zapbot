import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readConfig } from '@/lib/config-server'
import { gerarLinkMeetComCalendar } from '@/lib/google-calendar'
import { enviarEmailConfirmacaoAgendamento } from '@/lib/resend-email'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function enviarWhatsApp(uazapiBase: string, instanceToken: string, telefone: string, texto: string): Promise<string> {
  try {
    const base = uazapiBase.replace(/\/+$/, '').replace(/\/send\/.*$/, '')
    const res = await fetch(`${base}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({ number: telefone, text: texto }),
    })
    if (res.ok) return 'ok'
    const t = await res.text().catch(() => '')
    return `http_${res.status}: ${t.slice(0, 150)}`
  } catch (e) {
    return e instanceof Error ? e.message : 'fetch_falhou'
  }
}

export async function POST(request: NextRequest) {
  // Force rebuild v2
  const { slug, nome, telefone, email, assunto, data, hora } = await request.json()

  if (!slug || !nome || !telefone || !data || !hora) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Busca config pelo slug
  const { data: config } = await supabase
    .from('agenda_config')
    .select('*')
    .eq('slug', slug)
    .eq('ativo', true)
    .single()

  if (!config) return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })

  // Verifica se o slot ainda está disponível
  const [sh, sm] = hora.split(':').map(Number)
  // Interpreta o horário como horário de Brasília (UTC-3) para armazenar corretamente em UTC
  const dataHoraInicio = new Date(`${data}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00-03:00`)
  const dataHoraFim = new Date(dataHoraInicio.getTime() + config.duracao_minutos * 60000)

  const { data: conflito } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('user_id', config.user_id)
    .eq('status', 'confirmado')
    .gte('data_hora', dataHoraInicio.toISOString())
    .lt('data_hora', dataHoraFim.toISOString())
    .limit(1)

  if (conflito && conflito.length > 0) {
    return NextResponse.json({ error: 'Horário não disponível' }, { status: 409 })
  }

  // Cria agendamento no banco
  const { data: agendamento, error: errAg } = await supabase
    .from('agendamentos')
    .insert({
      user_id: config.user_id,
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email?.trim() || null,
      assunto: assunto?.trim() || null,
      data_hora: dataHoraInicio.toISOString(),
      duracao_minutos: config.duracao_minutos,
      status: 'confirmado',
    })
    .select()
    .single()

  if (errAg) return NextResponse.json({ error: errAg.message }, { status: 500 })

  let meetLink: string | null = null
  let googleErro: string | null = null

  // Gera link do Google Meet via Google Calendar API (usando token OAuth do usuário)
  try {
    const meetResult = await gerarLinkMeetComCalendar(
      config.titulo,
      dataHoraInicio,
      dataHoraFim,
      nome.trim(),
      email?.trim() || undefined,
      telefone.trim(),
      assunto?.trim() || undefined,
      config.user_id
    )

    if (meetResult) {
      meetLink = meetResult.link
      await supabase
        .from('agendamentos')
        .update({ meet_link: meetLink })
        .eq('id', agendamento.id)
      googleErro = 'ok'
    } else {
      googleErro = 'falha_ao_gerar_link'
    }
  } catch (e) {
    googleErro = e instanceof Error ? e.message : 'erro_desconhecido'
  }

  // Envia Email de confirmação
  let emailDebug = 'nao_tentado'
  if (email?.trim()) {
    try {
      console.log('Tentando enviar email para:', email.trim())
      const emailEnviado = await enviarEmailConfirmacaoAgendamento(
        email.trim(),
        nome.trim(),
        dataHoraInicio,
        config.duracao_minutos,
        telefone.trim(),
        assunto?.trim(),
        meetLink || undefined
      )
      emailDebug = emailEnviado ? 'ok' : 'falha_ao_enviar'
      console.log('Email resultado:', emailDebug)
    } catch (e) {
      emailDebug = `excecao: ${e instanceof Error ? e.message : 'desconhecida'}`
      console.error('Erro ao enviar email:', e)
    }
  } else {
    emailDebug = 'sem_email_do_cliente'
  }

  // Envia WhatsApp de confirmação
  let whatsappDebug = 'nao_tentado'
  if (!config.whatsapp_instancia_id) {
    whatsappDebug = 'sem_instancia_na_config_da_agenda'
  } else {
    try {
      const { data: instancia } = await supabase
        .from('instancias_whatsapp')
        .select('token')
        .eq('id', config.whatsapp_instancia_id)
        .single()

      const appConfig = await readConfig()
      const uazapiUrl = appConfig.uazapiUrl || ''

      if (!instancia?.token) {
        whatsappDebug = 'instancia_sem_token'
      } else if (!uazapiUrl) {
        whatsappDebug = 'sem_uazapi_url'
      } else {
        const dataFormatada = dataHoraInicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
        const horaFormatada = dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false })

        let msg = `Olá, ${nome.trim()}! ✅\n\n`
        msg += `Seu agendamento foi confirmado:\n`
        msg += `📅 ${dataFormatada}\n`
        msg += `⏰ ${horaFormatada}\n`
        msg += `⏱ Duração: ${config.duracao_minutos} minutos\n`
        if (assunto) msg += `📋 Assunto: ${assunto.trim()}\n`
        if (meetLink) msg += `\n🎥 Link do Google Meet:\n${meetLink}`

        whatsappDebug = await enviarWhatsApp(uazapiUrl, instancia.token, telefone.trim(), msg)
        if (whatsappDebug === 'ok') {
          await supabase.from('agendamentos').update({ whatsapp_enviado: true }).eq('id', agendamento.id)
        }
      }
    } catch (e) {
      whatsappDebug = `excecao: ${e instanceof Error ? e.message : 'desconhecida'}`
    }
  }

  return NextResponse.json({
    ok: true,
    agendamento: { id: agendamento.id, data_hora: agendamento.data_hora },
    meet_link: meetLink,
    _debug: {
      versao_codigo: 'v3-com-email',
      google_meet: googleErro,
      email: emailDebug,
      whatsapp_instancia_configurada: !!config.whatsapp_instancia_id,
      whatsapp: whatsappDebug,
    },
  })
}

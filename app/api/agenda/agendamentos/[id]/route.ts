import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from '@/lib/tenant-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function formatarMensagem(template: string, vars: { nome: string; data: string; hora: string }) {
  return template
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{data\}/g, vars.data)
    .replace(/\{hora\}/g, vars.hora)
}

async function deletarEventoCalendar(accessToken: string, calendarId: string, eventId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    // 200/204 = deletado; 404/410 = evento já não existe (tratamos como sucesso)
    if (res.ok || res.status === 404 || res.status === 410) return 'ok'
    const txt = await res.text().catch(() => '')
    return `http_${res.status}: ${txt.slice(0, 200)}`
  } catch (e) {
    return e instanceof Error ? e.message : 'fetch_falhou'
  }
}

async function enviarWhatsApp(uazapiBase: string, instanceToken: string, telefone: string, texto: string) {
  const base = uazapiBase.replace(/\/+$/, '').replace(/\/send\/.*$/, '')
  await fetch(`${base}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: instanceToken },
    body: JSON.stringify({ number: telefone, text: texto }),
  }).catch(() => {})
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = getSupabase()

  const { data: ag, error: errAg } = await supabase
    .from('agendamentos')
    .update({ status: body.status })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (errAg) return NextResponse.json({ error: errAg.message }, { status: 500 })

  // Se cancelou, envia WA + deleta Calendar
  let _debug
  if (body.status === 'cancelado' && ag) {
    _debug = await executarCancelamento(supabase, userId, ag)
  }

  return NextResponse.json({ ...ag, _debug })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabase()

  // Busca agendamento antes de deletar
  const { data: ag } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  let _debug
  if (ag) _debug = await executarCancelamento(supabase, userId, ag)

  const { error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, _debug })
}

async function executarCancelamento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ag: any,
): Promise<{ calendar: string; whatsapp: string }> {
  const debug = { calendar: 'nao_tentado', whatsapp: 'nao_tentado' }
  try {
    const { data: config } = await supabase
      .from('agenda_config')
      .select('mensagem_cancelamento, whatsapp_instancia_id, google_access_token, google_refresh_token, google_calendar_id')
      .eq('user_id', userId)
      .single()

    if (!config) { debug.calendar = 'sem_config'; return debug }

    const dataObj = new Date(ag.data_hora)
    const opts = { timeZone: 'America/Sao_Paulo' } as const
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', ...opts })
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, ...opts })

    // Deleta evento do Google Calendar
    if (!config.google_access_token) {
      debug.calendar = 'google_nao_conectado'
    } else if (!ag.google_event_id) {
      debug.calendar = 'agendamento_sem_event_id'
    } else {
      let token = config.google_access_token
      const testRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token)
      if (!testRes.ok) {
        if (!config.google_refresh_token) {
          debug.calendar = 'token_expirado_sem_refresh_token'
        } else {
          const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: config.google_refresh_token,
              grant_type: 'refresh_token',
            }),
          })
          const refreshData = await refreshRes.json()
          if (refreshData.access_token) {
            token = refreshData.access_token
            await supabase.from('agenda_config').update({ google_access_token: token }).eq('user_id', userId)
          } else {
            debug.calendar = `refresh_falhou: ${refreshData.error || 'desconhecido'}`
          }
        }
      }
      if (debug.calendar === 'nao_tentado') {
        debug.calendar = await deletarEventoCalendar(token, config.google_calendar_id || 'primary', ag.google_event_id)
      }
    }

    // Envia WhatsApp de cancelamento
    if (config.whatsapp_instancia_id && config.mensagem_cancelamento && ag.telefone) {
      const { data: instancia } = await supabase
        .from('instancias_whatsapp')
        .select('token')
        .eq('id', config.whatsapp_instancia_id)
        .single()

      const { data: configApp } = await supabase
        .from('configuracoes')
        .select('chave, valor')

      const uazapiUrl = configApp?.find((c: { chave: string }) => c.chave === 'uazapi_url')?.valor || ''

      if (instancia?.token && uazapiUrl) {
        const msg = formatarMensagem(config.mensagem_cancelamento, {
          nome: ag.nome,
          data: dataFormatada,
          hora: horaFormatada,
        })
        await enviarWhatsApp(uazapiUrl, instancia.token, ag.telefone, msg)
        debug.whatsapp = 'enviado'
      } else {
        debug.whatsapp = 'instancia_ou_url_ausente'
      }
    }
  } catch (e) {
    debug.calendar = `excecao: ${e instanceof Error ? e.message : 'desconhecida'}`
  }
  return debug
}

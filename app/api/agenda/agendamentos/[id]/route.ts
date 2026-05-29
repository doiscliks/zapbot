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

async function deletarEventoCalendar(accessToken: string, calendarId: string, eventId: string) {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  ).catch(() => {})
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
  if (body.status === 'cancelado' && ag) {
    await executarCancelamento(supabase, userId, ag)
  }

  return NextResponse.json(ag)
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

  if (ag) await executarCancelamento(supabase, userId, ag)

  const { error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

async function executarCancelamento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ag: any,
) {
  try {
    const { data: config } = await supabase
      .from('agenda_config')
      .select('mensagem_cancelamento, whatsapp_instancia_id, google_access_token, google_refresh_token, google_calendar_id')
      .eq('user_id', userId)
      .single()

    if (!config) return

    const dataObj = new Date(ag.data_hora)
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    // Deleta evento do Google Calendar
    if (config.google_access_token && ag.google_event_id) {
      let token = config.google_access_token
      const testRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token)
      if (!testRes.ok && config.google_refresh_token) {
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
        }
      }
      await deletarEventoCalendar(token, config.google_calendar_id, ag.google_event_id)
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
      }
    }
  } catch { /* ignora */ }
}

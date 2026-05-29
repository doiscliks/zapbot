import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function formatarMensagem(template: string, vars: { nome: string; data: string; hora: string; meet_link?: string }) {
  return template
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{data\}/g, vars.data)
    .replace(/\{hora\}/g, vars.hora)
    .replace(/\{meet_link\}/g, vars.meet_link || '')
}

async function enviarWhatsApp(uazapiBase: string, instanceToken: string, telefone: string, texto: string) {
  const base = uazapiBase.replace(/\/+$/, '').replace(/\/send\/.*$/, '')
  await fetch(`${base}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: instanceToken },
    body: JSON.stringify({ number: telefone, text: texto }),
  }).catch(() => {})
}

export async function GET(request: NextRequest) {
  // Protege com Authorization header (Vercel Cron) ou master password
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET || process.env.MASTER_PASSWORD || 'admin123'}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const agora = new Date()
  let enviados = 0

  // Busca todas as configs com lembrete ativo
  const { data: configs } = await supabase
    .from('agenda_config')
    .select('user_id, lembrete_antecedencia_horas, whatsapp_instancia_id')
    .gt('lembrete_antecedencia_horas', 0)
    .not('whatsapp_instancia_id', 'is', null)

  if (!configs || configs.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  for (const config of configs) {
    // Janela: agendamentos que estão entre agora+horas e agora+horas+1h
    const inicioJanela = new Date(agora.getTime() + config.lembrete_antecedencia_horas * 3600000)
    const fimJanela = new Date(inicioJanela.getTime() + 3600000) // 1h de margem

    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('id, nome, telefone, data_hora, meet_link')
      .eq('user_id', config.user_id)
      .eq('status', 'confirmado')
      .eq('lembrete_enviado', false)
      .gte('data_hora', inicioJanela.toISOString())
      .lt('data_hora', fimJanela.toISOString())

    if (!agendamentos || agendamentos.length === 0) continue

    // Busca instância e URL
    const { data: instancia } = await supabase
      .from('instancias_whatsapp')
      .select('token')
      .eq('id', config.whatsapp_instancia_id)
      .single()

    const { data: configApp } = await supabase
      .from('configuracoes')
      .select('chave, valor')

    const uazapiUrl = configApp?.find((c: { chave: string }) => c.chave === 'uazapi_url')?.valor || ''

    if (!instancia?.token || !uazapiUrl) continue

    for (const ag of agendamentos) {
      const dataObj = new Date(ag.data_hora)
      const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      const horas = config.lembrete_antecedencia_horas
      const textoTempo = horas >= 24 ? `${horas / 24} dia(s)` : `${horas} hora(s)`

      const template = `Olá, {nome}! 🔔 Lembrete: você tem uma reunião em ${textoTempo}.\n\n📅 {data}\n⏰ {hora}${ag.meet_link ? '\n\n🎥 Link do Meet:\n{meet_link}' : ''}`

      const msg = formatarMensagem(template, {
        nome: ag.nome,
        data: dataFormatada,
        hora: horaFormatada,
        meet_link: ag.meet_link ?? undefined,
      })

      await enviarWhatsApp(uazapiUrl, instancia.token, ag.telefone, msg)
      await supabase.from('agendamentos').update({ lembrete_enviado: true }).eq('id', ag.id)
      enviados++
    }
  }

  return NextResponse.json({ ok: true, enviados, timestamp: agora.toISOString() })
}

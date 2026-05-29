import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const data = searchParams.get('data') // YYYY-MM-DD

  if (!slug || !data) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

  const supabase = getSupabase()

  const { data: config } = await supabase
    .from('agenda_config')
    .select('user_id, periodos, duracao_minutos, dias_semana, antecedencia_minima_horas, ativo')
    .eq('slug', slug)
    .single()

  if (!config || !config.ativo) return NextResponse.json([])

  const [ano, mes, dia] = data.split('-').map(Number)
  const dataObj = new Date(ano, mes - 1, dia)
  const diaSemana = dataObj.getDay()

  if (!config.dias_semana.includes(diaSemana)) return NextResponse.json([])

  const duracao = config.duracao_minutos
  const periodos: { inicio: string; fim: string }[] = config.periodos ?? [{ inicio: '09:00', fim: '18:00' }]

  // Gera slots de todos os períodos em ordem
  const slots: string[] = []
  for (const periodo of periodos) {
    const [hI, mI] = periodo.inicio.split(':').map(Number)
    const [hF, mF] = periodo.fim.split(':').map(Number)
    const inicioMin = hI * 60 + mI
    const fimMin = hF * 60 + mF
    for (let min = inicioMin; min + duracao <= fimMin; min += duracao) {
      const h = String(Math.floor(min / 60)).padStart(2, '0')
      const m = String(min % 60).padStart(2, '0')
      const slot = `${h}:${m}`
      if (!slots.includes(slot)) slots.push(slot)
    }
  }

  // Busca agendamentos já existentes no dia
  const { data: ocupados } = await supabase
    .from('agendamentos')
    .select('data_hora')
    .eq('user_id', config.user_id)
    .eq('status', 'confirmado')
    .gte('data_hora', `${data}T00:00:00`)
    .lte('data_hora', `${data}T23:59:59`)

  const horasOcupadas = new Set(
    (ocupados ?? []).map((a) => {
      const d = new Date(a.data_hora)
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    })
  )

  const agora = new Date()
  const antecedenciaMs = config.antecedencia_minima_horas * 60 * 60 * 1000

  const disponiveis = slots.filter((slot) => {
    if (horasOcupadas.has(slot)) return false
    const [sh, sm] = slot.split(':').map(Number)
    const slotDate = new Date(ano, mes - 1, dia, sh, sm)
    if (slotDate.getTime() - agora.getTime() < antecedenciaMs) return false
    return true
  })

  return NextResponse.json(disponiveis)
}

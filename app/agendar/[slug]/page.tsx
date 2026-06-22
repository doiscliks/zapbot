'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Clock, Video, ChevronLeft, ChevronRight, CheckCircle, Calendar, Mail, Phone, User, FileText } from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const DIAS_SEMANA_LABELS: Record<number, string> = { 0:'Domingo',1:'Segunda',2:'Terça',3:'Quarta',4:'Quinta',5:'Sexta',6:'Sábado' }

function pad(n: number) { return String(n).padStart(2,'0') }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function formatDataLonga(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('pt-BR',{ weekday:'long', day:'2-digit', month:'long', year:'numeric' })
}

interface Config {
  titulo: string
  descricao: string | null
  duracao_minutos: number
  dias_semana: number[]
  dias_antecedencia_maxima: number
  periodos?: { inicio: string; fim: string }[]
  ativo: boolean
}

function addMinutos(hora: string, min: number) {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + min
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
}

function getAllSlots(periodos: { inicio: string; fim: string }[], duracao: number): string[] {
  const all: string[] = []
  for (const p of periodos) {
    const [hI, mI] = p.inicio.split(':').map(Number)
    const [hF, mF] = p.fim.split(':').map(Number)
    for (let t = hI * 60 + mI; t + duracao <= hF * 60 + mF; t += duracao) {
      all.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`)
    }
  }
  return all
}

// Detecta se há um intervalo entre dois slots (gap maior que a duração)
function isGap(slotA: string, slotB: string, duracao: number) {
  const [hA, mA] = slotA.split(':').map(Number)
  const [hB, mB] = slotB.split(':').map(Number)
  return (hB * 60 + mB) - (hA * 60 + mA) > duracao
}

type Step = 'data' | 'hora' | 'form' | 'confirmado'

export default function AgendarPage() {
  const { slug } = useParams<{ slug: string }>()

  const [config, setConfig] = useState<Config | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [step, setStep] = useState<Step>('data')

  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [dataSel, setDataSel] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [horaSel, setHoraSel] = useState<string | null>(null)
  const [form, setForm] = useState({ nome:'', telefone:'', email:'', assunto:'' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [meetLink, setMeetLink] = useState<string | null>(null)
  const [confirmadoInfo, setConfirmadoInfo] = useState<{ data: string; hora: string } | null>(null)

  useEffect(() => {
    fetch(`/api/agenda/publica?slug=${slug}`)
      .then(r => r.json())
      .then(data => setConfig(data))
      .catch(() => {})
      .finally(() => setLoadingConfig(false))
  }, [slug])

  useEffect(() => {
    if (!dataSel) return
    setLoadingSlots(true)
    setSlots([])
    fetch(`/api/agenda/slots?slug=${slug}&data=${dataSel}`)
      .then(r => r.json())
      .then(data => setSlots(Array.isArray(data) ? data : []))
      .finally(() => setLoadingSlots(false))
  }, [dataSel, slug])

  async function handleAgendar(e: React.FormEvent) {
    e.preventDefault()
    if (!dataSel || !horaSel) return
    setEnviando(true)
    setErro(null)
    const telefoneCompleto = form.telefone.startsWith('55') ? form.telefone : `55${form.telefone}`

    const res = await fetch('/api/agenda/agendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...form, telefone: telefoneCompleto, data: dataSel, hora: horaSel }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error ?? 'Erro ao agendar'); setEnviando(false); return }
    setMeetLink(data.meet_link ?? null)
    setConfirmadoInfo({ data: dataSel, hora: horaSel })
    setStep('confirmado')
    setEnviando(false)
  }

  function buildCalendar() {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1).getDay()
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const maxDias = config?.dias_antecedencia_maxima ?? 30
    const limite = new Date(hoje.getTime() + maxDias * 86400000)

    const cells: { data: string; dia: number; disabled: boolean; isToday: boolean }[] = []
    for (let i = 0; i < primeiroDia; i++) cells.push({ data:'', dia:0, disabled:true, isToday:false })
    for (let d = 1; d <= diasNoMes; d++) {
      const date = new Date(ano, mes, d)
      const iso = toISO(date)
      const isToday = iso === toISO(hoje)
      const disabled =
        date < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) ||
        date > limite ||
        !(config?.dias_semana ?? [1,2,3,4,5]).includes(date.getDay())
      cells.push({ data: iso, dia: d, disabled, isToday })
    }
    return cells
  }

  // ── Info lateral ──
  const InfoPanel = () => (
    <div className="flex flex-col h-full p-8 lg:p-10">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0"
          style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 14px rgba(18,198,214,0.4)' }}>
          2
        </div>
        <div>
          <p className="font-bold text-sm" style={{ color: '#1F2937' }}>2Cliks</p>
          <p className="text-xs" style={{ color: '#12C6D6' }}>Contabilidade</p>
        </div>
      </div>

      {/* Título */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-tight mb-2" style={{ color: '#1F2937' }}>
          {config?.titulo ?? 'Agendar Reunião'}
        </h1>
        {config?.descricao && (
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{config.descricao}</p>
        )}
      </div>

      {/* Detalhes */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FAFB' }}>
            <Clock size={15} style={{ color: '#12C6D6' }} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Duração</p>
            <p className="text-sm font-semibold" style={{ color: '#1F2937' }}>{config?.duracao_minutos ?? 60} minutos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FAFB' }}>
            <Video size={15} style={{ color: '#12C6D6' }} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Formato</p>
            <p className="text-sm font-semibold" style={{ color: '#1F2937' }}>Google Meet</p>
          </div>
        </div>

        {config && config.dias_semana.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FAFB' }}>
              <Calendar size={15} style={{ color: '#12C6D6' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Disponível</p>
              <p className="text-sm font-semibold" style={{ color: '#1F2937' }}>
                {config.dias_semana.map(d => DIAS_SEMANA_LABELS[d]?.slice(0,3)).join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Seleção atual */}
      {(dataSel || horaSel) && step !== 'confirmado' && (
        <div className="mt-8 p-4 rounded-xl" style={{ backgroundColor: '#F0FAFB', border: '1px solid rgba(18,198,214,0.2)' }}>
          {dataSel && (
            <p className="text-sm font-semibold" style={{ color: '#12C6D6' }}>
              📅 {formatDataLonga(dataSel)}
            </p>
          )}
          {horaSel && (
            <p className="text-sm font-semibold mt-1" style={{ color: '#12C6D6' }}>
              ⏰ {horaSel}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto pt-8">
        <p className="text-xs" style={{ color: '#D1D5DB' }}>© {new Date().getFullYear()} 2Cliks Contabilidade</p>
      </div>
    </div>
  )

  if (loadingConfig) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: '#12C6D6' }} />
    </div>
  )

  if (!config || !config.ativo) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="text-center">
        <p className="text-lg font-semibold" style={{ color: '#1F2937' }}>Agenda não encontrada</p>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Este link não está disponível.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #E8F9FB 0%, #F8FAFC 50%, #EEF4FF 100%)' }}>
      {/* Fundo decorativo */}
      <span className="fixed select-none pointer-events-none font-black" aria-hidden
        style={{ fontSize: 'clamp(300px, 50vw, 700px)', color: '#12C6D6', opacity: 0.03, top: '-10%', right: '-8%', lineHeight: 1 }}>
        2
      </span>

      <div className="w-full max-w-4xl relative z-10">
        <div className="bg-white rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 32px 80px rgba(18,198,214,0.12), 0 8px 32px rgba(0,0,0,0.06)', border: '1px solid rgba(18,198,214,0.1)' }}>

          <div className="flex flex-col lg:flex-row min-h-[580px]">
            {/* Painel esquerdo */}
            <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r" style={{ borderColor: '#F1F5F9' }}>
              <InfoPanel />
            </div>

            {/* Painel direito */}
            <div className="flex-1 p-8 lg:p-10">

              {/* ── Confirmado ── */}
              {step === 'confirmado' && confirmadoInfo && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                    style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 8px 24px rgba(18,198,214,0.4)' }}>
                    <CheckCircle size={38} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: '#1F2937' }}>Confirmado!</h2>
                  <p className="text-sm mb-1" style={{ color: '#6B7280' }}>
                    {formatDataLonga(confirmadoInfo.data)}
                  </p>
                  <p className="text-lg font-bold mb-6" style={{ color: '#12C6D6' }}>às {confirmadoInfo.hora}</p>

                  {meetLink && (
                    <a href={meetLink} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-white font-semibold text-sm mb-4"
                      style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 16px rgba(18,198,214,0.4)' }}>
                      <Video size={17} /> Entrar no Google Meet
                    </a>
                  )}

                  <div className="mt-2 px-5 py-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FAFB', color: '#6B7280' }}>
                    Você receberá a confirmação e o link do Meet via WhatsApp.
                  </div>
                </div>
              )}

              {/* ── Calendário ── */}
              {step === 'data' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-bold" style={{ color: '#1F2937' }}>Selecione uma data</h2>
                    <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>Escolha um dia disponível no calendário</p>
                  </div>

                  {/* Navegação do mês */}
                  <div className="flex items-center justify-between mb-5">
                    <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
                      style={{ color: '#6B7280', border: '1px solid #E9EEF2' }}>
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-semibold" style={{ color: '#1F2937' }}>
                      {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
                    </span>
                    <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
                      style={{ color: '#6B7280', border: '1px solid #E9EEF2' }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Dias da semana */}
                  <div className="grid grid-cols-7 mb-2">
                    {DIAS_SEMANA_CURTO.map(d => (
                      <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: '#9CA3AF' }}>{d}</div>
                    ))}
                  </div>

                  {/* Grid de dias */}
                  <div className="grid grid-cols-7 gap-1">
                    {buildCalendar().map((cell, i) => (
                      <button key={i}
                        disabled={!cell.data || cell.disabled}
                        onClick={() => { if (cell.data && !cell.disabled) { setDataSel(cell.data); setStep('hora') } }}
                        className="relative aspect-square rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center"
                        style={!cell.dia ? {} :
                          dataSel === cell.data
                          ? { background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', color: 'white', boxShadow: '0 4px 12px rgba(18,198,214,0.4)' }
                          : cell.disabled
                          ? { color: '#E5E7EB' }
                          : cell.isToday
                          ? { color: '#12C6D6', fontWeight: 700, backgroundColor: '#F0FAFB', border: '1.5px solid rgba(18,198,214,0.4)' }
                          : { color: '#1F2937', backgroundColor: '#F8FAFC' }
                        }
                      >
                        {cell.dia || ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Horários — estilo Google Calendar ── */}
              {step === 'hora' && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => { setStep('data'); setHoraSel(null) }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
                      style={{ color: '#6B7280', border: '1px solid #E9EEF2' }}>
                      <ChevronLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: '#1F2937' }}>Selecione um horário</h2>
                      <p className="text-sm capitalize" style={{ color: '#9CA3AF' }}>
                        {dataSel && formatDataLonga(dataSel)}
                      </p>
                    </div>
                  </div>

                  {loadingSlots && (
                    <div className="flex justify-center py-10">
                      <Loader2 size={22} className="animate-spin" style={{ color: '#12C6D6' }} />
                    </div>
                  )}

                  {!loadingSlots && (() => {
                    const periodos = config?.periodos ?? [{ inicio: '09:00', fim: '18:00' }]
                    const duracao = config?.duracao_minutos ?? 60
                    const todosSlots = getAllSlots(periodos, duracao)

                    if (todosSlots.length === 0) return (
                      <div className="text-center py-10 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
                        <Clock size={28} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Sem horários configurados neste dia.</p>
                      </div>
                    )

                    return (
                      <div className="space-y-1.5">
                        {todosSlots.map((slot, i) => {
                          const disponivel = slots.includes(slot)
                          const selecionado = horaSel === slot
                          const fim = addMinutos(slot, duracao)
                          const prev = todosSlots[i - 1]
                          const gap = prev ? isGap(prev, slot, duracao) : false

                          return (
                            <div key={slot}>
                              {/* Separador de intervalo entre períodos */}
                              {gap && (
                                <div className="flex items-center gap-2 py-2 px-1">
                                  <div className="flex-1 h-px" style={{ backgroundColor: '#E9EEF2' }} />
                                  <span className="text-[11px] font-medium px-2" style={{ color: '#9CA3AF' }}>intervalo</span>
                                  <div className="flex-1 h-px" style={{ backgroundColor: '#E9EEF2' }} />
                                </div>
                              )}

                              <button
                                disabled={!disponivel}
                                onClick={() => disponivel && (setHoraSel(slot), setStep('form'))}
                                className="w-full flex items-stretch rounded-xl overflow-hidden transition-all duration-150"
                                style={{
                                  ...(selecionado
                                    ? { background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 14px rgba(18,198,214,0.35)' }
                                    : disponivel
                                    ? { backgroundColor: '#F0FAFB', border: '1.5px solid rgba(18,198,214,0.25)' }
                                    : { backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', cursor: 'not-allowed', opacity: 0.6 }),
                                }}
                              >
                                {/* Barra lateral colorida */}
                                <div className="w-1 shrink-0 rounded-l-xl"
                                  style={{ backgroundColor: selecionado ? 'rgba(255,255,255,0.4)' : disponivel ? '#12C6D6' : '#D1D5DB' }}
                                />

                                <div className="flex items-center gap-4 px-4 py-3 flex-1">
                                  {/* Hora */}
                                  <div className="text-left shrink-0 w-24">
                                    <p className="text-sm font-bold" style={{ color: selecionado ? 'white' : disponivel ? '#1F2937' : '#9CA3AF' }}>
                                      {slot}
                                    </p>
                                    <p className="text-xs" style={{ color: selecionado ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}>
                                      até {fim}
                                    </p>
                                  </div>

                                  {/* Status */}
                                  <div className="flex-1 text-left">
                                    {disponivel ? (
                                      <span className="text-sm font-semibold" style={{ color: selecionado ? 'white' : '#12C6D6' }}>
                                        {selecionado ? '✓ Selecionado' : 'Disponível'}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Agendado</span>
                                    )}
                                  </div>

                                  {/* Duração */}
                                  <span className="text-xs shrink-0" style={{ color: selecionado ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>
                                    {duracao}min
                                  </span>
                                </div>
                              </button>
                            </div>
                          )
                        })}

                        {slots.length === 0 && (
                          <div className="mt-4 text-center">
                            <p className="text-sm" style={{ color: '#9CA3AF' }}>Todos os horários já estão agendados.</p>
                            <button onClick={() => setStep('data')} className="mt-2 text-sm font-semibold" style={{ color: '#12C6D6' }}>
                              Escolher outra data
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── Formulário ── */}
              {step === 'form' && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setStep('hora')}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
                      style={{ color: '#6B7280', border: '1px solid #E9EEF2' }}>
                      <ChevronLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: '#1F2937' }}>Seus dados</h2>
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>Preencha para confirmar o agendamento</p>
                    </div>
                  </div>

                  <form onSubmit={handleAgendar} className="space-y-4">
                    {/* Nome */}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                        Nome completo
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                          type="text"
                          value={form.nome}
                          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                          placeholder="Seu nome completo"
                          className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-all"
                          style={{ borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties}
                        />
                      </div>
                    </div>

                    {/* WhatsApp com prefixo +55 */}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                        WhatsApp
                      </label>
                      <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 bg-white transition-all"
                        style={{ borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties}>
                        <div className="flex items-center gap-1.5 px-3 py-3 shrink-0 border-r" style={{ borderColor: '#E9EEF2', backgroundColor: '#F8FAFC' }}>
                          <Phone size={14} style={{ color: '#9CA3AF' }} />
                          <span className="text-sm font-semibold" style={{ color: '#6B7280' }}>+55</span>
                        </div>
                        <input
                          type="tel"
                          value={form.telefone}
                          onChange={e => setForm(f => ({ ...f, telefone: e.target.value.replace(/\D/g, '') }))}
                          placeholder="11999999999"
                          maxLength={11}
                          className="flex-1 px-3 py-3 text-sm focus:outline-none bg-transparent"
                          style={{ color: '#1F2937' }}
                        />
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>DDD + número, sem espaços</p>
                    </div>

                    {/* E-mail */}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="seu@email.com"
                          className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-all"
                          style={{ borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>
                        Assunto / Motivo
                      </label>
                      <div className="relative">
                        <FileText size={15} className="absolute left-3.5 top-3.5" style={{ color: '#9CA3AF' }} />
                        <textarea
                          rows={2}
                          value={form.assunto}
                          onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))}
                          placeholder="Ex: Abertura de empresa, consultoria fiscal..."
                          className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white resize-none transition-all"
                          style={{ borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties}
                        />
                      </div>
                    </div>

                    {erro && (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                        {erro}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={enviando}
                      className="w-full flex items-center justify-center gap-2.5 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 transition-all"
                      style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 16px rgba(18,198,214,0.4)' }}
                    >
                      {enviando ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle size={17} />}
                      {enviando ? 'Confirmando...' : 'Confirmar agendamento'}
                    </button>
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

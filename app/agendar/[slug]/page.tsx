'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, Video } from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function pad(n: number) { return String(n).padStart(2, '0') }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

interface Config {
  titulo: string
  descricao: string | null
  duracao_minutos: number
  dias_semana: number[]
  dias_antecedencia_maxima: number
  ativo: boolean
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

  const [form, setForm] = useState({ nome: '', telefone: '', email: '', assunto: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [meetLink, setMeetLink] = useState<string | null>(null)
  const [confirmadoInfo, setConfirmadoInfo] = useState<{ data: string; hora: string } | null>(null)

  useEffect(() => {
    fetch(`/api/agenda/slots?slug=${slug}&data=${toISO(hoje)}`)
      .then(() => {})
      .catch(() => {})

    fetch(`/api/agenda/publica?slug=${slug}`)
      .then(r => r.json())
      .then(data => setConfig(data))
      .catch(() => {})
      .finally(() => setLoadingConfig(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleDiaClick(data: string) {
    setDataSel(data)
    setHoraSel(null)
    setStep('hora')
  }

  function handleHoraClick(hora: string) {
    setHoraSel(hora)
    setStep('form')
  }

  async function handleAgendar(e: React.FormEvent) {
    e.preventDefault()
    if (!dataSel || !horaSel) return
    setEnviando(true)
    setErro(null)

    const res = await fetch('/api/agenda/agendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...form, data: dataSel, hora: horaSel }),
    })
    const data = await res.json()

    if (!res.ok) { setErro(data.error ?? 'Erro ao agendar'); setEnviando(false); return }

    setMeetLink(data.meet_link ?? null)
    setConfirmadoInfo({ data: dataSel, hora: horaSel })
    setStep('confirmado')
    setEnviando(false)
  }

  // Calendário
  function buildCalendar() {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1).getDay()
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const maxDias = config?.dias_antecedencia_maxima ?? 30
    const limite = new Date(hoje.getTime() + maxDias * 86400000)

    const cells: { data: string; dia: number; disabled: boolean }[] = []
    for (let i = 0; i < primeiroDia; i++) cells.push({ data: '', dia: 0, disabled: true })
    for (let d = 1; d <= diasNoMes; d++) {
      const date = new Date(ano, mes, d)
      const iso = toISO(date)
      const diasemana = date.getDay()
      const disabled =
        date < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) ||
        date > limite ||
        !(config?.dias_semana ?? [1,2,3,4,5]).includes(diasemana)
      cells.push({ data: iso, dia: d, disabled })
    }
    return cells
  }

  const inputClass = 'w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-all'
  const inputStyle = { borderColor: '#E9EEF2', '--tw-ring-color': '#12C6D6' } as React.CSSProperties

  if (loadingConfig) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: '#12C6D6' }} />
    </div>
  )

  if (!config || !config.ativo) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="text-center">
        <p className="text-lg font-semibold" style={{ color: '#1F2937' }}>Agenda não encontrada</p>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Este link de agendamento não está disponível.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #E8F9FB 0%, #F8FAFC 45%, #EEF4FF 100%)' }}>
      {/* Decorative "2" */}
      <span className="absolute select-none pointer-events-none font-black" aria-hidden
        style={{ fontSize: 'clamp(200px, 40vw, 500px)', color: '#12C6D6', opacity: 0.04, top: '-5%', right: '-5%', lineHeight: 1 }}>
        2
      </span>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 8px 24px rgba(18,198,214,0.35)' }}>
            2
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1F2937' }}>{config.titulo}</h1>
          {config.descricao && <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: '#6B7280' }}>{config.descricao}</p>}
          <div className="flex items-center justify-center gap-4 mt-3 text-sm" style={{ color: '#6B7280' }}>
            <span className="flex items-center gap-1"><Clock size={13} /> {config.duracao_minutos} minutos</span>
            <span className="flex items-center gap-1"><Video size={13} /> Google Meet</span>
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-white rounded-3xl p-6"
          style={{ boxShadow: '0 25px 60px rgba(18,198,214,0.1), 0 8px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(18,198,214,0.12)' }}>

          {/* ── Confirmado ── */}
          {step === 'confirmado' && confirmadoInfo && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 16px rgba(18,198,214,0.35)' }}>
                <CheckCircle size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#1F2937' }}>Agendamento confirmado!</h2>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                {new Date(`${confirmadoInfo.data}T${confirmadoInfo.hora}`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às {confirmadoInfo.hora}
              </p>
              {meetLink && (
                <a href={meetLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 14px rgba(18,198,214,0.35)' }}>
                  <Video size={16} /> Entrar no Google Meet
                </a>
              )}
              <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>Uma confirmação foi enviada via WhatsApp.</p>
            </div>
          )}

          {/* ── Calendário ── */}
          {step === 'data' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="p-2 rounded-lg hover:bg-gray-50" style={{ color: '#6B7280' }}>
                  <ChevronLeft size={18} />
                </button>
                <span className="font-semibold text-sm" style={{ color: '#1F2937' }}>
                  {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
                </span>
                <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="p-2 rounded-lg hover:bg-gray-50" style={{ color: '#6B7280' }}>
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold py-1" style={{ color: '#9CA3AF' }}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {buildCalendar().map((cell, i) => (
                  <button
                    key={i}
                    disabled={!cell.data || cell.disabled}
                    onClick={() => cell.data && !cell.disabled && handleDiaClick(cell.data)}
                    className="aspect-square rounded-xl text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={!cell.data ? {} : dataSel === cell.data
                      ? { background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', color: 'white', boxShadow: '0 2px 8px rgba(18,198,214,0.35)' }
                      : cell.disabled ? { color: '#D1D5DB' }
                      : { color: '#1F2937', backgroundColor: '#F0FAFB' }
                    }
                  >
                    {cell.dia || ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Horários ── */}
          {step === 'hora' && (
            <div>
              <button onClick={() => setStep('data')} className="flex items-center gap-1 text-sm mb-4" style={{ color: '#6B7280' }}>
                <ChevronLeft size={16} /> Voltar
              </button>
              <h3 className="font-semibold mb-4 text-sm" style={{ color: '#1F2937' }}>
                <Calendar size={14} className="inline mr-1.5" style={{ color: '#12C6D6' }} />
                {dataSel && new Date(`${dataSel}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </h3>

              {loadingSlots && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: '#12C6D6' }} /></div>}

              {!loadingSlots && slots.length === 0 && (
                <p className="text-center text-sm py-6" style={{ color: '#9CA3AF' }}>Sem horários disponíveis neste dia.</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => handleHoraClick(slot)}
                    className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={horaSel === slot
                      ? { background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', color: 'white', boxShadow: '0 2px 8px rgba(18,198,214,0.3)' }
                      : { backgroundColor: '#F0FAFB', color: '#1F2937', border: '1px solid #E9EEF2' }
                    }
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Formulário ── */}
          {step === 'form' && (
            <div>
              <button onClick={() => setStep('hora')} className="flex items-center gap-1 text-sm mb-4" style={{ color: '#6B7280' }}>
                <ChevronLeft size={16} /> Voltar
              </button>

              <div className="rounded-xl px-4 py-3 mb-5 text-sm" style={{ backgroundColor: '#F0FAFB', border: '1px solid rgba(18,198,214,0.2)' }}>
                <span style={{ color: '#12C6D6' }} className="font-semibold">
                  📅 {dataSel && new Date(`${dataSel}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às {horaSel}
                </span>
              </div>

              <form onSubmit={handleAgendar} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Nome *</label>
                  <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome completo" className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>WhatsApp *</label>
                  <input required value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="5511999999999" className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>E-mail</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#6B7280' }}>Assunto / Motivo</label>
                  <textarea rows={2} value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))} placeholder="Ex: Consultoria fiscal, abertura de empresa..." className={`${inputClass} resize-none`} style={inputStyle} />
                </div>

                {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl disabled:opacity-60 mt-2"
                  style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 4px 14px rgba(18,198,214,0.35)' }}
                >
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {enviando ? 'Confirmando...' : 'Confirmar agendamento'}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#9CA3AF' }}>
          © {new Date().getFullYear()} 2Cliks Contabilidade
        </p>
      </div>
    </div>
  )
}

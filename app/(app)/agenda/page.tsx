'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Settings, ChevronLeft, ChevronRight, Video, Phone, Mail, CheckCircle, XCircle, Trash2, X, List, CalendarDays, FileText } from 'lucide-react'

interface Agendamento {
  id: string
  nome: string
  telefone: string
  email: string | null
  assunto: string | null
  data_hora: string
  duracao_minutos: number
  status: 'confirmado' | 'cancelado' | 'realizado'
  meet_link: string | null
  whatsapp_enviado: boolean
}

const DIAS_CURTOS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const HOUR_HEIGHT = 64
const GRID_START = 7
const GRID_END = 20

function getWeekDays(offset: number): Date[] {
  const today = new Date()
  const sun = new Date(today)
  sun.setDate(today.getDate() - today.getDay() + offset * 7)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return d })
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function isToday(d: Date) {
  const t = new Date()
  return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear()
}

function getBrDate(iso: string) {
  const d = new Date(iso)
  const s = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  return new Date(s)
}

function isSameDay(iso: string, day: Date) {
  const br = getBrDate(iso)
  return br.getDate()===day.getDate() && br.getMonth()===day.getMonth() && br.getFullYear()===day.getFullYear()
}

function getEventTop(iso: string) {
  const br = getBrDate(iso)
  return (br.getHours() - GRID_START + br.getMinutes()/60) * HOUR_HEIGHT
}

function getEventHeight(min: number) { return Math.max((min/60)*HOUR_HEIGHT, 24) }

function formatHora(iso: string) {
  return getBrDate(iso).toLocaleTimeString('pt-BR',{ hour:'2-digit', minute:'2-digit', hour12:false })
}

function formatDataHora(iso: string) {
  return getBrDate(iso).toLocaleString('pt-BR',{ weekday:'long', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function addMinutos(iso: string, min: number) {
  const d = new Date(new Date(iso).getTime() + min*60000)
  return getBrDate(d.toISOString()).toLocaleTimeString('pt-BR',{ hour:'2-digit', minute:'2-digit', hour12:false })
}

const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i)
const STATUS_COLOR: Record<string,string> = {
  confirmado: 'linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))',
  realizado:  'linear-gradient(135deg,#22c55e,#16a34a)',
  cancelado:  'linear-gradient(135deg,#9CA3AF,#6B7280)',
}
const STATUS_LABEL: Record<string,string> = { confirmado:'Confirmado', realizado:'Realizado', cancelado:'Cancelado' }

export default function AgendaPage() {
  const router = useRouter()
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [view, setView] = useState<'semana'|'lista'>('semana')
  const [selected, setSelected] = useState<Agendamento | null>(null)
  const [filtro, setFiltro] = useState<'proximos'|'todos'|'cancelados'>('proximos')

  const semana = getWeekDays(offset)
  const w0 = semana[0], w6 = semana[6]
  const weekLabel = w0.getMonth()===w6.getMonth()
    ? `${MESES_CURTOS[w0.getMonth()]} ${w0.getFullYear()}`
    : `${MESES_CURTOS[w0.getMonth()]} – ${MESES_CURTOS[w6.getMonth()]} ${w0.getFullYear()}`

  useEffect(() => {
    fetch('/api/agenda/agendamentos')
      .then(r=>r.json())
      .then(d=>{ if(Array.isArray(d)) setAgendamentos(d) })
      .finally(()=>setLoading(false))
  },[])

  async function alterarStatus(id: string, status: string) {
    await fetch(`/api/agenda/agendamentos/${id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    setAgendamentos(p=>p.map(a=>a.id===id?{...a,status:status as Agendamento['status']}:a))
    setSelected(s=>s&&s.id===id?{...s,status:status as Agendamento['status']}:s)
  }

  async function excluir(id: string) {
    if(!confirm('Excluir este agendamento?')) return
    const res = await fetch(`/api/agenda/agendamentos/${id}`,{method:'DELETE'})
    const data = await res.json().catch(()=>null)
    if(data?._debug && data._debug.calendar !== 'ok' && data._debug.calendar !== 'google_nao_conectado') {
      alert(`Aviso: o evento não foi removido do Google Calendar.\nMotivo: ${data._debug.calendar}`)
    }
    setAgendamentos(p=>p.filter(a=>a.id!==id))
    setSelected(null)
  }

  const cardBorder = { border: '1px solid #E9EEF2' }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
      {/* ── Header ── */}
      <div className="shrink-0 px-5 py-3 bg-white border-b flex items-center gap-3 flex-wrap" style={{ borderColor: '#E9EEF2' }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={19} style={{ color: 'var(--brand-primary)' }} />
          <span className="font-bold" style={{ color: '#1F2937' }}>Agenda</span>
        </div>

        {view === 'semana' && (
          <div className="flex items-center gap-1">
            <button onClick={()=>setOffset(0)} className="px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all hover:bg-gray-50" style={{ borderColor:'#E9EEF2', color:'#1F2937' }}>Hoje</button>
            <button onClick={()=>setOffset(o=>o-1)} className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color:'#6B7280' }}><ChevronLeft size={16}/></button>
            <button onClick={()=>setOffset(o=>o+1)} className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color:'#6B7280' }}><ChevronRight size={16}/></button>
            <span className="text-sm font-semibold ml-1" style={{ color:'#1F2937' }}>{weekLabel}</span>
          </div>
        )}

        <span className="flex-1"/>

        {/* View toggle */}
        <div className="flex rounded-xl p-0.5" style={{ backgroundColor:'var(--brand-tint-bg)' }}>
          {(['semana','lista'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize"
              style={view===v ? { background:'linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))', color:'white', boxShadow:'var(--brand-shadow-sm)' } : { color:'#6B7280' }}>
              {v==='semana' ? <CalendarDays size={13}/> : <List size={13}/>} {v}
            </button>
          ))}
        </div>

        <button onClick={()=>router.push('/agenda/config')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
          style={{ background:'linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))', boxShadow:'var(--brand-shadow-xs)' }}>
          <Settings size={13}/> Configurar
        </button>
      </div>

      {loading && <div className="flex items-center justify-center flex-1"><Loader2 size={22} className="animate-spin" style={{ color:'var(--brand-primary)' }}/></div>}

      {/* ── Vista Semana ── */}
      {!loading && view==='semana' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {/* Cabeçalho dias */}
          <div className="flex shrink-0 border-b" style={{ borderColor:'#E9EEF2' }}>
            <div className="w-14 shrink-0 border-r" style={{ borderColor:'#F1F5F9' }}/>
            {semana.map((day,i)=>(
              <div key={i} className="flex-1 text-center py-2.5 border-r" style={{ borderColor:'#F1F5F9' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color:'#9CA3AF' }}>{DIAS_CURTOS[day.getDay()]}</p>
                <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-0.5 text-sm font-bold"
                  style={isToday(day) ? { background:'linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))', color:'white', boxShadow:'var(--brand-shadow-sm)' } : { color:'#1F2937' }}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Grid scrollável */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>
              {/* Coluna de horas */}
              <div className="w-14 shrink-0 border-r" style={{ borderColor:'#F1F5F9' }}>
                {HOURS.map(h=>(
                  <div key={h} className="flex items-start justify-end pr-2 pt-1 border-b" style={{ height:HOUR_HEIGHT, borderColor:'#F1F5F9' }}>
                    <span className="text-[10px]" style={{ color:'#9CA3AF' }}>{String(h).padStart(2,'0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Colunas dos dias */}
              <div className="flex-1 relative">
                {/* Linhas horizontais de hora */}
                {HOURS.map(h=>(
                  <div key={h} className="absolute w-full border-b" style={{ top:(h-GRID_START)*HOUR_HEIGHT, height:HOUR_HEIGHT, borderColor:'#F1F5F9' }}/>
                ))}

                {/* Linhas verticais dos dias */}
                {[1,2,3,4,5,6].map(i=>(
                  <div key={i} className="absolute top-0 bottom-0 border-r" style={{ left:`${i*100/7}%`, borderColor:'#F1F5F9' }}/>
                ))}

                {/* Linha do horário atual */}
                {offset===0 && (() => {
                  const now = new Date()
                  const br = getBrDate(now.toISOString())
                  const top = (br.getHours()-GRID_START+br.getMinutes()/60)*HOUR_HEIGHT
                  if(top>=0 && top<=HOURS.length*HOUR_HEIGHT) return (
                    <div className="absolute w-full flex items-center z-20" style={{ top }}>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor:'var(--brand-primary)', marginLeft:'-5px' }}/>
                      <div className="flex-1 h-px" style={{ backgroundColor:'var(--brand-primary)' }}/>
                    </div>
                  )
                })()}

                {/* Eventos */}
                {semana.map((day,colIdx)=>{
                  const dayAgs = agendamentos.filter(ag=>isSameDay(ag.data_hora,day))
                  return dayAgs.map(ag=>{
                    const top = getEventTop(ag.data_hora)
                    const height = getEventHeight(ag.duracao_minutos)
                    const colW = 100/7
                    const isSelected = selected?.id===ag.id
                    if(top < 0) return null
                    return (
                      <div key={ag.id}
                        className="absolute rounded-lg px-2 py-1 overflow-hidden cursor-pointer transition-all duration-150"
                        style={{
                          top, height,
                          left:`${colIdx*colW+0.3}%`,
                          width:`${colW-0.6}%`,
                          background: STATUS_COLOR[ag.status] ?? STATUS_COLOR.confirmado,
                          boxShadow: isSelected ? 'var(--brand-shadow)' : '0 1px 4px rgba(0,0,0,0.15)',
                          transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                          zIndex: isSelected ? 10 : 1,
                          opacity: ag.status==='cancelado' ? 0.5 : 1,
                        }}
                        onClick={()=>setSelected(ag)}>
                        <p className="text-white font-bold leading-tight" style={{ fontSize:10 }}>{ag.nome}</p>
                        {height > 28 && <p className="text-white/80 leading-tight" style={{ fontSize:9 }}>{formatHora(ag.data_hora)}</p>}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista Lista ── */}
      {!loading && view==='lista' && (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit" style={{ backgroundColor:'var(--brand-tint-bg)' }}>
            {(['proximos','todos','cancelados'] as const).map(f=>(
              <button key={f} onClick={()=>setFiltro(f)}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all capitalize"
                style={filtro===f ? { background:'linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))', color:'white', boxShadow:'var(--brand-shadow-sm)' } : { color:'#6B7280' }}>
                {f==='proximos'?'Próximos':f==='todos'?'Todos':'Cancelados'}
              </button>
            ))}
          </div>
          <div className="space-y-3 max-w-2xl">
            {agendamentos
              .filter(a=>{
                const futuro = new Date(a.data_hora) >= new Date()
                if(filtro==='proximos') return a.status==='confirmado' && futuro
                if(filtro==='cancelados') return a.status==='cancelado'
                return true
              })
              .map(ag=>(
                <div key={ag.id} className="bg-white rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md" style={{ ...cardBorder }} onClick={()=>setSelected(ag)}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm" style={{ color:'#1F2937' }}>{ag.nome}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background:STATUS_COLOR[ag.status] }}>{STATUS_LABEL[ag.status]}</span>
                  </div>
                  <p className="text-xs" style={{ color:'#6B7280' }}>{formatDataHora(ag.data_hora)} — {ag.duracao_minutos}min</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Popup de detalhe ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={()=>setSelected(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up" style={{ border:'var(--brand-border-15)' }} onClick={e=>e.stopPropagation()}>
            {/* Topo */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ background:STATUS_COLOR[selected.status] }}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                  {selected.whatsapp_enviado && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor:'#F0FDF4', color:'#16a34a' }}>WhatsApp ✓</span>}
                </div>
                <h3 className="text-lg font-bold" style={{ color:'#1F2937' }}>{selected.nome}</h3>
                <p className="text-sm mt-0.5 capitalize" style={{ color:'#6B7280' }}>{formatDataHora(selected.data_hora)}</p>
                <p className="text-xs mt-0.5" style={{ color:'#9CA3AF' }}>
                  {formatHora(selected.data_hora)} — {addMinutos(selected.data_hora, selected.duracao_minutos)} · {selected.duracao_minutos}min
                </p>
              </div>
              <button onClick={()=>setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color:'#9CA3AF' }}><X size={16}/></button>
            </div>

            {/* Detalhes */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm" style={{ color:'#6B7280' }}>
                <Phone size={14} style={{ color:'var(--brand-primary)' }}/> {selected.telefone}
              </div>
              {selected.email && (
                <div className="flex items-center gap-2 text-sm" style={{ color:'#6B7280' }}>
                  <Mail size={14} style={{ color:'var(--brand-primary)' }}/> {selected.email}
                </div>
              )}
              {selected.assunto && (
                <div className="flex items-start gap-2 text-sm" style={{ color:'#6B7280' }}>
                  <FileText size={14} className="mt-0.5 shrink-0" style={{ color:'var(--brand-primary)' }}/> {selected.assunto}
                </div>
              )}
            </div>

            {/* Meet link */}
            {selected.meet_link && (
              <a href={selected.meet_link} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold mb-4"
                style={{ background:'linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))', boxShadow:'var(--brand-shadow-md)' }}>
                <Video size={15}/> Entrar no Google Meet
              </a>
            )}

            {/* Ações */}
            <div className="flex gap-2">
              {selected.status==='confirmado' && (
                <button onClick={()=>alterarStatus(selected.id,'realizado')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-green-100"
                  style={{ backgroundColor:'#F0FDF4', color:'#16a34a', border:'1px solid #BBF7D0' }}>
                  <CheckCircle size={13}/> Realizado
                </button>
              )}
              {selected.status==='confirmado' && (
                <button onClick={()=>alterarStatus(selected.id,'cancelado')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-red-100"
                  style={{ backgroundColor:'#FEF2F2', color:'#dc2626', border:'1px solid #FECACA' }}>
                  <XCircle size={13}/> Cancelar
                </button>
              )}
              <button onClick={()=>excluir(selected.id)}
                className="py-2 px-3 rounded-xl text-xs font-semibold transition-all hover:bg-red-50 hover:text-red-500"
                style={{ color:'#9CA3AF', border:'1px solid #E9EEF2' }}>
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

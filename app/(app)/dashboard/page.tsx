'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, TrendingUp, AlertCircle, Loader2, Calendar, BarChart3 } from 'lucide-react'

interface DadosDia {
  data: string
  total: number
}

interface DadosAtendimento {
  data: string
  semResposta: number
  comResposta: number
}

function formatarData(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

function hoje() { return new Date().toISOString().slice(0, 10) }
function haNDias(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function addDias(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

function useMaxDias() {
  const [maxDias, setMaxDias] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 15 : 20
  )
  useEffect(() => {
    function atualizar() { setMaxDias(window.innerWidth < 768 ? 15 : 20) }
    window.addEventListener('resize', atualizar)
    return () => window.removeEventListener('resize', atualizar)
  }, [])
  return maxDias
}

// Brand chart colors
const BRAND_COLORS = ['#12C6D6', '#FF7A66', '#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6']

export default function DashboardPage() {
  const MAX_DIAS = useMaxDias()
  const [totalClientes, setTotalClientes] = useState<number | null>(null)
  const [clientesPorDia, setClientesPorDia] = useState<DadosDia[]>([])
  const [atendimento, setAtendimento] = useState<DadosAtendimento[]>([])
  const [kanban, setKanban] = useState<{ nome: string; total: number }[]>([])
  const [statusAtual, setStatusAtual] = useState<{ status: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(haNDias(typeof window !== 'undefined' && window.innerWidth < 768 ? 15 : 20))
  const [endDate, setEndDate] = useState(hoje())

  function handleStartChange(val: string) {
    setStartDate(val)
    const maxEnd = addDias(val, MAX_DIAS)
    if (endDate > maxEnd) setEndDate(maxEnd > hoje() ? hoje() : maxEnd)
  }

  function handleEndChange(val: string) {
    setEndDate(val)
    const minStart = addDias(val, -MAX_DIAS)
    if (startDate < minStart) setStartDate(minStart)
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate })
      const res = await fetch(`/api/dashboard/stats?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar')
      const data = await res.json()
      setClientesPorDia(data.clientesPorDia ?? [])
      setTotalClientes((data.clientesPorDia ?? []).reduce((s: number, d: { total: number }) => s + d.total, 0))
      setAtendimento(data.atendimento ?? [])
      setKanban(data.kanban ?? [])
      setStatusAtual(data.statusAtual ?? [])
    } catch {
      setErro('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { carregar() }, [carregar])

  const maxDia = Math.max(...clientesPorDia.map((d) => d.total), 1)
  const maxAtend = Math.max(...atendimento.map((d) => d.comResposta + d.semResposta), 1)
  const BAR_HEIGHT = 160

  function pizzaSlices(dados: { nome: string; total: number }[]) {
    const validos = dados.filter((d) => d.total > 0)
    const total = validos.reduce((s, d) => s + d.total, 0) || 1
    // Uma única fatia (100%) gera arco degenerado no SVG → renderiza como círculo cheio
    if (validos.length === 1) {
      return [{ path: '', full: true, cor: BRAND_COLORS[0], ...validos[0], pct: 100 }]
    }
    let angulo = -Math.PI / 2
    return validos.map((d, i) => {
      const fatia = (d.total / total) * 2 * Math.PI
      const x1 = 80 + 70 * Math.cos(angulo)
      const y1 = 80 + 70 * Math.sin(angulo)
      angulo += fatia
      const x2 = 80 + 70 * Math.cos(angulo)
      const y2 = 80 + 70 * Math.sin(angulo)
      const grande = fatia > Math.PI ? 1 : 0
      const path = `M80,80 L${x1},${y1} A70,70 0 ${grande},1 ${x2},${y2} Z`
      return { path, full: false, cor: BRAND_COLORS[i % BRAND_COLORS.length], ...d, pct: Math.round((d.total / total) * 100) }
    })
  }

  const cardStyle = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E9EEF2',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1F2937' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Visão geral do sistema</p>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 animate-fade-in-up"
          style={{ ...cardStyle, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <Calendar size={15} style={{ color: '#12C6D6' }} className="shrink-0" />
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => handleStartChange(e.target.value)}
            className="text-sm focus:outline-none bg-transparent"
            style={{ color: '#1F2937' }}
          />
          <span className="text-sm" style={{ color: '#D1D5DB' }}>→</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={hoje()}
            onChange={(e) => handleEndChange(e.target.value)}
            className="text-sm focus:outline-none bg-transparent"
            style={{ color: '#1F2937' }}
          />
          <span className="text-[10px] ml-1" style={{ color: '#D1D5DB' }}>máx. {MAX_DIAS} dias</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3" style={{ color: '#12C6D6' }}>
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm" style={{ color: '#6B7280' }}>Carregando dados...</span>
        </div>
      )}

      {erro && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl">
          <AlertCircle size={18} />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {!loading && !erro && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Total Clientes */}
            <div className="rounded-2xl p-6 animate-fade-in-up" style={cardStyle}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Total de Clientes</p>
                  <p className="text-4xl font-bold mt-2" style={{ color: '#1F2937' }}>
                    {totalClientes?.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(18,198,214,0.15) 0%, rgba(18,198,214,0.08) 100%)' }}
                >
                  <Users size={22} style={{ color: '#12C6D6' }} />
                </div>
              </div>
              <div className="mt-4 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #12C6D6, #A5F3FC)' }} />
            </div>

            {/* Dias com cadastros */}
            <div className="rounded-2xl p-6 animate-fade-in-up" style={{ ...cardStyle, animationDelay: '0.05s' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Dias com cadastros</p>
                  <p className="text-4xl font-bold mt-2" style={{ color: '#1F2937' }}>
                    {clientesPorDia.length}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(255,122,102,0.15) 0%, rgba(255,122,102,0.08) 100%)' }}
                >
                  <BarChart3 size={22} style={{ color: '#FF7A66' }} />
                </div>
              </div>
              <div className="mt-4 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #FF7A66, #FFD1C7)' }} />
            </div>

            {/* Média por dia */}
            <div className="rounded-2xl p-6 animate-fade-in-up" style={{ ...cardStyle, animationDelay: '0.1s' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Média por dia</p>
                  <p className="text-4xl font-bold mt-2" style={{ color: '#1F2937' }}>
                    {clientesPorDia.length > 0
                      ? (totalClientes! / clientesPorDia.length).toFixed(1)
                      : '—'}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.08) 100%)' }}
                >
                  <TrendingUp size={22} style={{ color: '#6366f1' }} />
                </div>
              </div>
              <div className="mt-4 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #6366f1, #C7D2FE)' }} />
            </div>
          </div>

          {/* Pizza charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {statusAtual.length > 0 && (
              <div className="rounded-2xl p-6 animate-fade-in-up" style={cardStyle}>
                <h2 className="font-semibold mb-4" style={{ color: '#1F2937' }}>Clientes por status atual</h2>
                <div className="flex items-center gap-6">
                  <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
                    {pizzaSlices(statusAtual.map(s => ({ nome: s.status, total: s.total }))).map((s, i) => (
                      s.full
                        ? <circle key={i} cx="80" cy="80" r="70" fill={s.cor} />
                        : <path key={i} d={s.path} fill={s.cor} stroke="white" strokeWidth="2" />
                    ))}
                    <circle cx="80" cy="80" r="50" fill="white" />
                    <text x="80" y="74" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1F2937">
                      {statusAtual.reduce((s, d) => s + d.total, 0)}
                    </text>
                    <text x="80" y="92" textAnchor="middle" fontSize="11" fill="#9CA3AF">total</text>
                  </svg>
                  <div className="flex flex-col gap-2 overflow-hidden">
                    {pizzaSlices(statusAtual.map(s => ({ nome: s.status, total: s.total }))).map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                        <span className="text-xs truncate flex-1" style={{ color: '#6B7280' }}>{s.nome.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-semibold shrink-0" style={{ color: '#1F2937' }}>{s.total}</span>
                        <span className="text-xs w-7 text-right shrink-0" style={{ color: '#9CA3AF' }}>{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {kanban.length > 0 && (
              <div className="rounded-2xl p-6 animate-fade-in-up" style={cardStyle}>
                <h2 className="font-semibold mb-4" style={{ color: '#1F2937' }}>Clientes por etapa do Kanban</h2>
                <div className="flex items-center gap-8">
                  <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
                    {pizzaSlices(kanban).map((s, i) => (
                      s.full
                        ? <circle key={i} cx="80" cy="80" r="70" fill={s.cor} />
                        : <path key={i} d={s.path} fill={s.cor} stroke="white" strokeWidth="2" />
                    ))}
                    <circle cx="80" cy="80" r="50" fill="white" />
                    <text x="80" y="74" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1F2937">
                      {kanban.reduce((s, d) => s + d.total, 0)}
                    </text>
                    <text x="80" y="92" textAnchor="middle" fontSize="11" fill="#9CA3AF">total</text>
                  </svg>
                  <div className="flex flex-col gap-2.5">
                    {pizzaSlices(kanban).map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                        <span className="text-sm" style={{ color: '#1F2937' }}>{s.nome}</span>
                        <span className="text-sm font-semibold ml-auto pl-4" style={{ color: '#1F2937' }}>{s.total}</span>
                        <span className="text-xs w-8 text-right" style={{ color: '#9CA3AF' }}>{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Taxa de resposta — card horizontal full width */}
          {(() => {
            const totalResp = atendimento.reduce((s, d) => s + d.comResposta, 0)
            const totalGeral = atendimento.reduce((s, d) => s + d.comResposta + d.semResposta, 0)
            const taxa = totalGeral > 0 ? Math.round((totalResp / totalGeral) * 100) : 0
            const r = 28
            const circ = 2 * Math.PI * r
            const dash = (taxa / 100) * circ
            return (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-6 w-fit max-w-full animate-fade-in-up" style={cardStyle}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#1F2937' }}>Taxa de resposta geral</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Período selecionado — ao menos 3 mensagens</p>
                </div>
                <div className="relative shrink-0">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r={r} fill="none" stroke="#E9EEF2" strokeWidth="8" />
                    <circle cx="36" cy="36" r={r} fill="none"
                      stroke={taxa >= 50 ? '#12C6D6' : '#FF7A66'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${dash} ${circ}`}
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-bold" style={{ color: '#1F2937' }}>{taxa}%</span>
                  </div>
                </div>
                <div className="flex gap-6 text-sm" style={{ color: '#6B7280' }}>
                  <span className="flex flex-col">
                    <span className="font-bold text-xl" style={{ color: '#12C6D6' }}>{totalResp}</span>
                    Responderam
                  </span>
                  <span className="flex flex-col">
                    <span className="font-bold text-xl" style={{ color: '#FF7A66' }}>{totalGeral - totalResp}</span>
                    Sem resposta
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Bar charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Clientes por dia */}
            <div className="rounded-2xl animate-fade-in-up" style={cardStyle}>
              <div className="px-6 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
                <h2 className="font-semibold" style={{ color: '#1F2937' }}>Clientes por dia</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Período selecionado</p>
              </div>
              {clientesPorDia.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm" style={{ color: '#9CA3AF' }}>Nenhum dado disponível.</div>
              ) : (
                <div className="p-6">
                  <div className="flex items-end gap-1.5 w-full" style={{ height: BAR_HEIGHT + 48 }}>
                    {clientesPorDia.map((item) => {
                      const h = Math.max((item.total / maxDia) * BAR_HEIGHT, 4)
                      return (
                        <div key={item.data} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <span className="text-xs font-semibold" style={{ color: '#1F2937' }}>{item.total}</span>
                          <div className="w-full flex items-end" style={{ height: BAR_HEIGHT }}>
                            <div
                              className="w-full rounded-t-lg transition-all duration-500"
                              style={{
                                height: h,
                                background: 'linear-gradient(180deg, #12C6D6 0%, #A5F3FC 100%)',
                                opacity: 0.85,
                              }}
                            />
                          </div>
                          <span className="text-[10px] leading-tight text-center truncate w-full" style={{ color: '#9CA3AF' }}>
                            {item.data.slice(8)}/{item.data.slice(5, 7)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Atendimento vs Resposta */}
            <div className="rounded-2xl animate-fade-in-up" style={cardStyle}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
                <div>
                  <h2 className="font-semibold" style={{ color: '#1F2937' }}>Atendimento vs Resposta</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Período selecionado — ao menos 3 mensagens</p>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: '#6B7280' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#12C6D6' }} /> Responderam
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#FF7A66' }} /> Sem resposta
                  </span>
                </div>
              </div>
              {atendimento.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm" style={{ color: '#9CA3AF' }}>Nenhum dado disponível.</div>
              ) : (
                <div className="p-6">
                  <div className="flex items-end gap-1.5 w-full" style={{ height: BAR_HEIGHT + 48 }}>
                    {atendimento.map((item) => {
                      const total = item.comResposta + item.semResposta
                      const hVerde = (item.comResposta / maxAtend) * BAR_HEIGHT
                      const hVermelho = (item.semResposta / maxAtend) * BAR_HEIGHT
                      return (
                        <div key={item.data} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <span className="text-[10px] font-medium" style={{ color: '#6B7280' }}>{total}</span>
                          <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: BAR_HEIGHT }}>
                            <div className="w-full transition-all duration-500 flex items-center justify-center" style={{ height: hVermelho, backgroundColor: '#FFB5A9' }}>
                              {hVermelho >= 16 && <span className="text-[10px] font-semibold text-white leading-none">{item.semResposta}</span>}
                            </div>
                            <div className="w-full transition-all duration-500 flex items-center justify-center" style={{ height: hVerde, backgroundColor: '#12C6D6' }}>
                              {hVerde >= 16 && <span className="text-[10px] font-semibold text-white leading-none">{item.comResposta}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-center leading-tight truncate w-full" style={{ color: '#9CA3AF' }}>
                            {item.data.slice(8)}/{item.data.slice(5, 7)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

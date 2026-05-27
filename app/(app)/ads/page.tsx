'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, DollarSign, Eye, MousePointer, MessageSquare, ChevronUp, ChevronDown, BarChart2, Percent, CreditCard } from 'lucide-react'

interface CampanhaMetrica {
  campanha: string
  gasto: number
  impressoes: number
  cliques: number
  cpm: number
  mensagensIniciadas: number
  custoPorMensagem: number
}

interface Totais {
  gasto: number
  impressoes: number
  cliques: number
  mensagensIniciadas: number
}

type SortField = keyof Omit<CampanhaMetrica, 'campanha'>
type SortDir = 'asc' | 'desc'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNum(value: number) {
  return value.toLocaleString('pt-BR')
}

function formatPct(value: number) {
  return value.toFixed(2).replace('.', ',') + '%'
}

const PERIODOS = [
  { label: 'Últimos 7 dias', value: 'last_7d' },
  { label: 'Últimos 30 dias', value: 'last_30d' },
  { label: 'Este mês', value: 'this_month' },
  { label: 'Mês passado', value: 'last_month' },
]

const COLUNAS: { field: SortField | null; label: string; align: 'left' | 'right' }[] = [
  { field: null, label: 'Campanha', align: 'left' },
  { field: 'gasto', label: 'Gasto', align: 'right' },
  { field: 'impressoes', label: 'Impressões', align: 'right' },
  { field: 'cliques', label: 'Cliques', align: 'right' },
  { field: 'cpm', label: 'CPM', align: 'right' },
  { field: 'mensagensIniciadas', label: 'Msgs iniciadas', align: 'right' },
  { field: 'custoPorMensagem', label: 'Custo/msg', align: 'right' },
]

interface MetricCardProps {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  bg: string
  border: string
}

function MetricCard({ label, value, icon, color, bg, border }: MetricCardProps) {
  return (
    <div className={`rounded-2xl p-5 border ${border} ${bg} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
    </div>
  )
}

export default function AdsPage() {
  const [campanhas, setCampanhas] = useState<CampanhaMetrica[]>([])
  const [totais, setTotais] = useState<Totais | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState('last_30d')
  const [sortField, setSortField] = useState<SortField>('gasto')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  async function carregar(p: string) {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch(`/api/facebook/ads?date_preset=${p}`)
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setCampanhas(data.campanhas)
      setTotais(data.totais)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar(periodo) }, [periodo])

  function handleSort(field: SortField | null) {
    if (!field) return
    if (sortField === field) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const campanhasOrdenadas = [...campanhas].sort((a, b) => {
    const mult = sortDir === 'desc' ? -1 : 1
    return (a[sortField] - b[sortField]) * mult
  })

  const custoPorConversa = totais && totais.mensagensIniciadas > 0
    ? totais.gasto / totais.mensagensIniciadas : 0
  const cpmMedio = totais && totais.impressoes > 0
    ? (totais.gasto / totais.impressoes) * 1000 : 0
  const ctrMedio = totais && totais.impressoes > 0
    ? (totais.cliques / totais.impressoes) * 100 : 0
  const cpcMedio = totais && totais.cliques > 0
    ? totais.gasto / totais.cliques : 0

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div className="shrink-0 px-8 py-5 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">Ads</h1>
            <p className="text-gray-400 text-xs mt-0.5">Performance das campanhas do Facebook</p>
          </div>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium shadow-sm"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="px-8 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <span className="text-sm text-gray-400">Carregando dados...</span>
            </div>
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            Erro ao carregar: {erro}
          </div>
        )}

        {!loading && !erro && totais && (
          <>
            {/* Linha 1 — Totais */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Resumo geral</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Gasto total"
                  value={formatBRL(totais.gasto)}
                  icon={<DollarSign size={16} className="text-white" />}
                  color="bg-blue-600"
                  bg="bg-white"
                  border="border-gray-100"
                />
                <MetricCard
                  label="Impressões"
                  value={formatNum(totais.impressoes)}
                  icon={<Eye size={16} className="text-white" />}
                  color="bg-violet-500"
                  bg="bg-white"
                  border="border-gray-100"
                />
                <MetricCard
                  label="Cliques"
                  value={formatNum(totais.cliques)}
                  icon={<MousePointer size={16} className="text-white" />}
                  color="bg-sky-500"
                  bg="bg-white"
                  border="border-gray-100"
                />
                <MetricCard
                  label="Msgs iniciadas"
                  value={formatNum(totais.mensagensIniciadas)}
                  icon={<MessageSquare size={16} className="text-white" />}
                  color="bg-emerald-500"
                  bg="bg-white"
                  border="border-gray-100"
                />
              </div>
            </div>

            {/* Linha 2 — Médias */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Médias e custos</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Custo / conversa"
                  value={custoPorConversa > 0 ? formatBRL(custoPorConversa) : '—'}
                  icon={<MessageSquare size={16} className="text-white" />}
                  color="bg-orange-500"
                  bg="bg-orange-50"
                  border="border-orange-100"
                />
                <MetricCard
                  label="CPM médio"
                  value={formatBRL(cpmMedio)}
                  icon={<BarChart2 size={16} className="text-white" />}
                  color="bg-pink-500"
                  bg="bg-pink-50"
                  border="border-pink-100"
                />
                <MetricCard
                  label="CTR médio"
                  value={formatPct(ctrMedio)}
                  icon={<Percent size={16} className="text-white" />}
                  color="bg-teal-500"
                  bg="bg-teal-50"
                  border="border-teal-100"
                />
                <MetricCard
                  label="CPC médio"
                  value={cpcMedio > 0 ? formatBRL(cpcMedio) : '—'}
                  icon={<CreditCard size={16} className="text-white" />}
                  color="bg-indigo-500"
                  bg="bg-indigo-50"
                  border="border-indigo-100"
                />
              </div>
            </div>

            {/* Tabela */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Campanhas</p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {campanhas.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                    Nenhuma campanha encontrada no período
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80">
                          {COLUNAS.map(({ field, label, align }) => (
                            <th
                              key={label}
                              onClick={() => handleSort(field)}
                              className={`py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide select-none transition-colors ${
                                align === 'left' ? 'text-left px-6' : 'text-right px-4'
                              } ${field ? 'cursor-pointer hover:text-blue-600' : ''} ${
                                field && sortField === field ? 'text-blue-600' : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {label}
                                {field && sortField === field && (
                                  sortDir === 'desc'
                                    ? <ChevronDown size={12} />
                                    : <ChevronUp size={12} />
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campanhasOrdenadas.map((c, i) => (
                          <tr
                            key={c.campanha}
                            className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${
                              i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                            }`}
                          >
                            <td className="px-6 py-4 font-medium text-gray-800 max-w-xs">
                              <span className="truncate block">{c.campanha}</span>
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatBRL(c.gasto)}</td>
                            <td className="px-4 py-4 text-right text-gray-500">{formatNum(c.impressoes)}</td>
                            <td className="px-4 py-4 text-right text-gray-500">{formatNum(c.cliques)}</td>
                            <td className="px-4 py-4 text-right text-gray-500">{formatBRL(c.cpm)}</td>
                            <td className="px-4 py-4 text-right">
                              <span className={`font-semibold ${c.mensagensIniciadas > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                                {formatNum(c.mensagensIniciadas)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {c.custoPorMensagem > 0
                                ? <span className="font-bold text-gray-900">{formatBRL(c.custoPorMensagem)}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

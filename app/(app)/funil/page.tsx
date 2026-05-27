'use client'

import { useEffect, useState, useCallback } from 'react'
import { EtapaFunil } from '@/services/funnelService'
import { Loader2, AlertCircle, Calendar, TrendingUp } from 'lucide-react'

function hoje() { return new Date().toISOString().slice(0, 10) }
function haNDias(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

export default function FunilPage() {
  const [dados, setDados] = useState<EtapaFunil[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(haNDias(30))
  const [endDate, setEndDate] = useState(hoje())

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch(`/api/funil?start=${startDate}&end=${endDate}`)
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.error ?? 'Erro desconhecido')
      setDados(Array.isArray(resultado) ? resultado : [])
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados do funil.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { carregar() }, [carregar])

  const maxTotal = Math.max(...dados.map(d => d.total), 1)
  const totalGeral = dados[0]?.total ?? 0
  const totalCompras = dados[dados.length - 1]?.total ?? 0
  const taxaGeral = totalGeral > 0 ? Math.round((totalCompras / totalGeral) * 100) : 0

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funil de Conversão</h1>
          <p className="text-gray-500 text-sm mt-1">Jornada dos clientes por etapa</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <Calendar size={15} className="text-gray-400 shrink-0" />
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none bg-transparent"
          />
          <span className="text-gray-300 text-sm">→</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={hoje()}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none bg-transparent"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          <span>Carregando funil...</span>
        </div>
      )}

      {erro && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle size={18} />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {!loading && !erro && (
        <div className="space-y-6">
          {/* Cards resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <p className="text-sm text-gray-500 font-medium">Entraram no funil</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">{totalGeral.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <p className="text-sm text-gray-500 font-medium">Compraram</p>
              <p className="text-4xl font-bold text-green-600 mt-2">{totalCompras.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Taxa geral Lead → Compra</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{taxaGeral}%</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp size={22} className="text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Funil visual */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-6">Etapas do funil</h2>

            {dados.every(d => d.total === 0) ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhum evento registrado no período.</p>
            ) : (
              <div className="flex flex-col items-center gap-0 w-full">
                {dados.map((etapa, i) => {
                  // Largura baseada no primeiro estágio (Lead) — funil real
                  const primeiro = dados[0]?.total || 1
                  const larguraPct = maxTotal > 0 ? Math.max((etapa.total / primeiro) * 100, 6) : 6
                  // Garante que afunila de cima pra baixo (máx 100% no topo)
                  const largura = Math.min(larguraPct, 100)

                  return (
                    <div key={etapa.event_name} className="w-full flex flex-col items-center">
                      {/* Indicador de conversão */}
                      {i > 0 && (
                        <div className="flex items-center gap-1.5 py-1.5">
                          <span className="text-gray-300 text-sm">↓</span>
                          <span className="text-xs text-gray-400">
                            {etapa.conversao !== null ? (
                              <><span className="font-semibold text-gray-600">{etapa.conversao}%</span> converteram</>
                            ) : '—'}
                          </span>
                        </div>
                      )}

                      {/* Barra do funil */}
                      <div
                        className="h-11 rounded-lg transition-all duration-700"
                        style={{ width: `${largura}%`, backgroundColor: etapa.cor }}
                      />

                      {/* Label abaixo da barra — sempre visível */}
                      <div className="flex items-center gap-2 mt-1.5 mb-0.5 flex-wrap justify-center">
                        <span className="text-sm font-semibold text-gray-700">{etapa.label}</span>
                        <span className="text-sm font-bold" style={{ color: etapa.cor }}>
                          {etapa.total.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({totalGeral > 0 ? Math.round((etapa.total / totalGeral) * 100) : 0}%)
                        </span>
                        {etapa.valor > 0 && ['InitiateCheckout', 'AddToCart', 'Purchase'].includes(etapa.event_name) && (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            R$ {etapa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

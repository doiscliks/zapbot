'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2, AlertCircle, Users, TrendingDown, Clock, CheckCircle2, Link2 } from 'lucide-react'

interface Atendente {
  id: string
  nome: string
  clientes_count: number
}

interface ClienteSemAtendente {
  id: number
  nome: string
  telefone: string
  dt_ultima_mensagem: string | null
}

interface FilaData {
  atendentes: Atendente[]
  proximoAtendente: Atendente | null
  ordemFila: string[]
  clientesSemAtendente: ClienteSemAtendente[]
  totalClientesDistribuidos: number
  totalClientesSemAtendente: number
}

export default function FilaPage() {
  const [filaData, setFilaData] = useState<FilaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [associandoClienteId, setAssociandoClienteId] = useState<number | null>(null)
  const [atendenteSelecionado, setAtendenteSelecionado] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const clienteEmAsociacaoRef = useRef<number | null>(null)

  // Polling a cada 3 segundos
  useEffect(() => {
    const carregarFila = async () => {
      try {
        setErro(null)
        const res = await fetch('/api/fila')
        if (!res.ok) throw new Error('Erro ao carregar fila')
        const data = await res.json()
        setFilaData(data)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar fila')
      } finally {
        setLoading(false)
      }
    }

    carregarFila()
    const intervalo = setInterval(carregarFila, 3000)
    return () => clearInterval(intervalo)
  }, [])

  async function handleAssociar(clienteId: number) {
    clienteEmAsociacaoRef.current = clienteId
    setAssociandoClienteId(clienteId)
    setModalAberto(true)
    setAtendenteSelecionado(null)
  }

  async function confirmarAssociacao() {
    if (!atendenteSelecionado || !clienteEmAsociacaoRef.current) return

    try {
      const res = await fetch('/api/fila/associar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteEmAsociacaoRef.current,
          atendente_id: atendenteSelecionado,
        }),
      })

      if (!res.ok) throw new Error('Erro ao associar cliente')

      setModalAberto(false)
      setAssociandoClienteId(null)
      setAtendenteSelecionado(null)

      // Recarrega a fila
      const reloadRes = await fetch('/api/fila')
      if (reloadRes.ok) setFilaData(await reloadRes.json())
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao associar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 m-4 text-red-700">
        <AlertCircle size={20} />
        <span>{erro}</span>
      </div>
    )
  }

  if (!filaData) return null

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Fila de Distribuição</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie a distribuição automática de clientes entre atendentes</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-6xl">
          {/* Seção 1: Status da Fila */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingDown size={20} className="text-blue-600" />
              Status da Fila
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Próximo Atendente</p>
                <p className="text-2xl font-bold text-blue-600">
                  {filaData.proximoAtendente?.nome || 'N/A'}
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Clientes Distribuídos</p>
                <p className="text-2xl font-bold text-green-600">{filaData.totalClientesDistribuidos}</p>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Sem Atendente</p>
                <p className="text-2xl font-bold text-orange-600">{filaData.totalClientesSemAtendente}</p>
              </div>
            </div>

            {/* Ordem da Fila */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Ordem Atual de Distribuição:</p>
              <div className="flex flex-wrap gap-2">
                {filaData.atendentes.map((a, idx) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-sm font-medium">
                      {a.nome}
                    </div>
                    {idx < filaData.atendentes.length - 1 && <span className="text-gray-400">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Seção 2: Resumo dos Atendentes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={20} className="text-purple-600" />
              Atendentes Ativos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filaData.atendentes.map(atendente => (
                <div key={atendente.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{atendente.nome}</p>
                    {filaData.proximoAtendente?.id === atendente.id && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                        Próximo
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{atendente.clientes_count}</p>
                  <p className="text-xs text-gray-500">clientes associados</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seção 3: Clientes Sem Atendente */}
          {filaData.totalClientesSemAtendente > 0 && (
            <div className="bg-white rounded-lg border border-orange-200 bg-orange-50 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-orange-600" />
                Clientes Aguardando Distribuição ({filaData.totalClientesSemAtendente})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-900">Nome</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-900">Telefone</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-900">Última Interação</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-900">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filaData.clientesSemAtendente.map(cliente => (
                      <tr key={cliente.id} className="border-b border-orange-100 hover:bg-orange-100">
                        <td className="py-3 px-3 text-gray-900">{cliente.nome}</td>
                        <td className="py-3 px-3 text-gray-600">{cliente.telefone}</td>
                        <td className="py-3 px-3 text-gray-600">
                          {cliente.dt_ultima_mensagem
                            ? new Date(cliente.dt_ultima_mensagem).toLocaleString('pt-BR')
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleAssociar(cliente.id)}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 mx-auto"
                          >
                            <Link2 size={14} />
                            Associar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filaData.totalClientesSemAtendente === 0 && (
            <div className="bg-white rounded-lg border border-green-200 bg-green-50 p-6 text-center">
              <CheckCircle2 size={40} className="text-green-600 mx-auto mb-3" />
              <p className="font-medium text-gray-900">Todos os clientes estão distribuídos!</p>
              <p className="text-sm text-gray-600 mt-1">Nenhum cliente aguardando atribuição</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Associação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Selecione um Atendente</h3>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
              {filaData.atendentes.map(atendente => (
                <button
                  key={atendente.id}
                  onClick={() => setAtendenteSelecionado(atendente.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    atendenteSelecionado === atendente.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{atendente.nome}</p>
                  <p className="text-xs text-gray-500">{atendente.clientes_count} clientes associados</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalAberto(false)
                  setAtendenteSelecionado(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAssociacao}
                disabled={!atendenteSelecionado}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Associar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

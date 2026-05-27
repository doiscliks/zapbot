'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, AlertCircle, Wifi, WifiOff, Loader2, RefreshCw, Settings, Activity, Key } from 'lucide-react'

interface InstanciaDiag {
  id: string
  nome: string
  status: string
  telefone: string | null
  ativo: boolean
  webhookAtivo: boolean
  ultimoWebhook: string | null
}

interface UserDiag {
  id: string
  email: string
  nome: string
  temOpenaiKey: boolean
  instancias: InstanciaDiag[]
  ultimaMensagemIA: string | null
  iaRespondendo: boolean
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  const h = Math.floor(min / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `há ${d}d`
  if (h > 0) return `há ${h}h`
  if (min > 0) return `há ${min}min`
  return 'agora'
}

function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span className="text-xs text-gray-400">—</span>
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <CheckCircle size={11} /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle size={11} /> {label}
    </span>
  )
}

export default function DiagnosticoPage() {
  const router = useRouter()
  const [dados, setDados] = useState<UserDiag[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/setup/diagnostico')
      if (res.status === 401) { router.push('/setup/login'); return }
      if (!res.ok) throw new Error('Erro ao carregar')
      setDados(await res.json())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Painel Master</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie o sistema e acompanhe os clientes</p>
        </div>

        {/* Navegação */}
        <div className="grid grid-cols-3 gap-3 mb-8 max-w-xl mx-auto">
          <a
            href="/setup"
            className="flex flex-col items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-4 py-4 text-gray-400 hover:text-white transition-colors"
          >
            <Settings size={20} />
            <span className="text-xs font-medium">Configurações</span>
          </a>
          <div className="flex flex-col items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white">
            <Activity size={20} />
            <span className="text-xs font-medium">Diagnóstico</span>
          </div>
          <a
            href="/setup/chaves"
            className="flex flex-col items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-4 py-4 text-gray-400 hover:text-white transition-colors"
          >
            <Key size={20} />
            <span className="text-xs font-medium">Chaves de Acesso</span>
          </a>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Status dos Clientes</h2>
          <button
            onClick={carregar}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-white/10 hover:border-white/20 transition-colors"
          >
            <RefreshCw size={13} />
            Atualizar
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
            <Loader2 size={18} className="animate-spin" /> Carregando...
          </div>
        )}

        {erro && (
          <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} /> {erro}
          </div>
        )}

        {!loading && !erro && (
          <div className="space-y-4">
            {dados.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12">Nenhum cliente encontrado.</p>
            )}
            {dados.map((u) => (
              <div key={u.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                {/* Cabeçalho do cliente */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
                  <div>
                    <span className="font-medium text-white text-sm">{u.email}</span>
                    {u.nome !== u.email && (
                      <span className="text-gray-400 text-xs ml-2">{u.nome}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge ok={u.temOpenaiKey} label="OpenAI Key" />
                    <span className="text-xs text-gray-400">
                      Última IA: {tempoRelativo(u.ultimaMensagemIA)}
                    </span>
                  </div>
                </div>

                {/* Instâncias */}
                {u.instancias.length === 0 ? (
                  <div className="px-5 py-3 text-sm text-gray-400 flex items-center gap-2">
                    <XCircle size={14} className="text-red-400" />
                    Nenhuma instância cadastrada
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {u.instancias.map((inst) => {
                      const conectado = inst.status === 'conectado'
                      const temWebhook = inst.webhookAtivo
                      const iaRespondendo = u.iaRespondendo

                      return (
                        <div key={inst.id} className="px-5 py-3 flex items-center gap-6">
                          {/* Status conexão */}
                          <div className="flex items-center gap-1.5 min-w-[130px]">
                            {conectado ? (
                              <Wifi size={14} className="text-green-500" />
                            ) : (
                              <WifiOff size={14} className="text-red-400" />
                            )}
                            <span className={`text-xs font-medium ${conectado ? 'text-green-400' : 'text-red-400'}`}>
                              {conectado ? 'Conectado' : 'Desconectado'}
                            </span>
                            {inst.telefone && (
                              <span className="text-xs text-gray-500 ml-1">{inst.telefone}</span>
                            )}
                          </div>

                          {/* Webhook recebendo */}
                          <div className="flex flex-col gap-0.5 min-w-[140px]">
                            <Badge ok={temWebhook} label="Webhook ativo" />
                            {inst.ultimoWebhook && (
                              <span className="text-xs text-gray-500 pl-1">{tempoRelativo(inst.ultimoWebhook)}</span>
                            )}
                          </div>

                          {/* IA respondendo */}
                          <div className="flex flex-col gap-0.5 min-w-[140px]">
                            <Badge ok={iaRespondendo} label="IA respondendo" />
                            {u.ultimaMensagemIA && (
                              <span className="text-xs text-gray-500 pl-1">{tempoRelativo(u.ultimaMensagemIA)}</span>
                            )}
                          </div>

                          {/* Nome da instância */}
                          <span className="text-xs text-gray-500 ml-auto">{inst.nome}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

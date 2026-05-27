'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Smartphone, Plus, Trash2, Loader2, RefreshCw, X, CheckCircle, AlertCircle, Wifi, WifiOff, ArrowRightLeft, DownloadCloud } from 'lucide-react'

interface Instancia {
  id: string
  nome: string
  token: string
  telefone: string | null
  status: string
  ativo: boolean
  created_at: string
}

export default function ConexaoPage() {
  const [instancias, setInstancias] = useState<Instancia[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackErro, setFeedbackErro] = useState<string | null>(null)
  const [excludeMessages, setExcludeMessages] = useState<string[]>(['wasSentByApi', 'isGroupYes'])

  const [qrData, setQrData] = useState<Record<string, string | null>>({})
  const [loadingQr, setLoadingQr] = useState<Record<string, boolean>>({})
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({})
  const [modoConexao, setModoConexao] = useState<Record<string, 'qr' | 'pairing'>>({})
  const [pairingPhone, setPairingPhone] = useState<Record<string, string>>({})
  const [pairingCode, setPairingCode] = useState<Record<string, string | null>>({})
  const [loadingPairing, setLoadingPairing] = useState<Record<string, boolean>>({})

  // popup de desconexão
  const [desconectadoAlerta, setDesconectadoAlerta] = useState<{ nome: string; telefone: string; id: string } | null>(null)

  // migração
  const [migrandoId, setMigrandoId] = useState<string | null>(null)
  const [migrarDeId, setMigrarDeId] = useState<string>('')
  const [migrando, setMigrando] = useState(false)

  // sincronização de histórico
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null)

  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const carregar = useCallback(async () => {
    const res = await fetch('/api/instancias')
    if (res.ok) setInstancias(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval)
    }
  }, [carregar])

  // Supabase Realtime — reage imediatamente quando UAZAPI envia evento de conexão
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channel = supabase
      .channel('instancias-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'instancias_whatsapp' },
        (payload) => {
          const updated = payload.new as Instancia
          setInstancias((prev) => {
            const anterior = prev.find((i) => i.id === updated.id)
            if (!anterior) return prev

            const recemConectou = updated.status === 'conectado' && anterior.status !== 'conectado'
            const recemDesconectou = updated.status !== 'conectado' && anterior.status === 'conectado'

            if (recemConectou) {
              pararPolling(updated.id)
              setQrData((p) => ({ ...p, [updated.id]: null }))
              setPairingCode((p) => ({ ...p, [updated.id]: null }))
              mostrarFeedback('Conectado! Sincronizando histórico de conversas...')
              sincronizarHistorico(updated.id)
            }

            if (recemDesconectou) {
              setDesconectadoAlerta({
                id: updated.id,
                nome: anterior.nome,
                telefone: anterior.telefone || updated.telefone || '',
              })
            }

            return prev.map((i) =>
              i.id === updated.id
                ? { ...i, status: updated.status, telefone: updated.telefone ?? i.telefone }
                : i,
            )
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function mostrarFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  function mostrarErro(msg: string) {
    setFeedbackErro(msg)
    setTimeout(() => setFeedbackErro(null), 6000)
  }

  function pararPolling(id: string) {
    if (pollingRef.current[id]) {
      clearInterval(pollingRef.current[id])
      delete pollingRef.current[id]
    }
  }

  async function buscarStatusEQr(id: string, silencioso = false) {
    if (!silencioso) setCheckingStatus((prev) => ({ ...prev, [id]: true }))

    const res = await fetch(`/api/instancias/${id}/status`)
    const data = await res.json()

    if (res.ok) {
      if (data.conectado) {
        // Detecta se acabou de conectar (não estava conectado antes)
        const eraDesconectado = instancias.find((i) => i.id === id)?.status !== 'conectado'

        pararPolling(id)
        setQrData((prev) => ({ ...prev, [id]: null }))
        setInstancias((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, status: 'conectado', telefone: data.telefone ?? i.telefone } : i
          )
        )

        if (eraDesconectado) {
          mostrarFeedback('Conectado! Sincronizando histórico de conversas...')
          sincronizarHistorico(id)
        } else {
          mostrarFeedback('Conectado com sucesso!')
        }
      } else {
        setInstancias((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: data.state ?? i.status } : i))
        )
        if (data.qr) {
          setQrData((prev) => ({ ...prev, [id]: data.qr }))
        }
      }
    }

    if (!silencioso) setCheckingStatus((prev) => ({ ...prev, [id]: false }))
    return data
  }

  function iniciarPolling(id: string) {
    pararPolling(id)
    pollingRef.current[id] = setInterval(() => {
      buscarStatusEQr(id, true)
    }, 4000)
  }

  async function criarInstancia() {
    if (!novoNome.trim()) return
    setSalvando(true)
    setErro(null)

    const res = await fetch('/api/instancias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoNome, excludeMessages }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErro(data.error ?? 'Erro ao criar instância')
      setSalvando(false)
      return
    }

    setInstancias((prev) => [...prev, data])
    setNovoNome('')
    setMostrarForm(false)
    setSalvando(false)

    // Se o QR já veio na resposta de criação, exibe direto
    if (data.qrcode) {
      setQrData((prev) => ({ ...prev, [data.id]: data.qrcode }))
    } else {
      await carregarQr(data.id)
    }
    iniciarPolling(data.id)
  }

  async function carregarQr(id: string) {
    setLoadingQr((prev) => ({ ...prev, [id]: true }))
    setQrData((prev) => ({ ...prev, [id]: null }))

    const res = await fetch(`/api/instancias/${id}/qr`)
    const data = await res.json()
    const qr = data?.qr || data?.qrcode || data?.base64 || null
    setQrData((prev) => ({ ...prev, [id]: qr }))
    setLoadingQr((prev) => ({ ...prev, [id]: false }))
    return qr
  }

  async function conectar(id: string) {
    await carregarQr(id)
    iniciarPolling(id)
  }

  async function gerarPairingCode(id: string) {
    const telefone = (pairingPhone[id] ?? '').replace(/\D/g, '')
    if (!telefone || telefone.length < 10) return

    setLoadingPairing(prev => ({ ...prev, [id]: true }))
    setPairingCode(prev => ({ ...prev, [id]: null }))

    const res = await fetch(`/api/instancias/${id}/pairing-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone }),
    })
    const data = await res.json()

    setLoadingPairing(prev => ({ ...prev, [id]: false }))

    if (res.ok && data.code) {
      setPairingCode(prev => ({ ...prev, [id]: data.code }))
      iniciarPolling(id)
    } else {
      mostrarErro(data.error ?? 'Não foi possível gerar o código de pareamento')
    }
  }

  async function deletarInstancia(id: string) {
    if (!confirm('Remover esta instância?')) return
    pararPolling(id)
    await fetch(`/api/instancias/${id}`, { method: 'DELETE' })
    setInstancias((prev) => prev.filter((i) => i.id !== id))
    mostrarFeedback('Instância removida.')
  }

  async function desconectar(id: string) {
    if (!confirm('Desconectar este número?')) return
    pararPolling(id)
    await fetch(`/api/instancias/${id}/desconectar`, { method: 'POST' })
    setInstancias((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'desconectado', telefone: null } : i))
    )
    setQrData((prev) => ({ ...prev, [id]: null }))
    mostrarFeedback('Número desconectado.')
  }

  async function sincronizarHistorico(id: string) {
    setSincronizandoId(id)
    const res = await fetch(`/api/instancias/${id}/sincronizar-historico`, { method: 'POST' })
    const data = await res.json()
    setSincronizandoId(null)
    if (res.ok) {
      const encontradas = data.encontradas ?? data.sincronizados
      mostrarFeedback(`Sincronizado: ${data.sincronizados} mensagens salvas (${encontradas} encontradas no UAZAPI) de ${data.clientes} conversas — ${data.clientesNovos} clientes novos.`)
    } else {
      mostrarFeedback(`Erro: ${data.error}`)
    }
  }

  async function migrarClientes() {
    if (!migrandoId || !migrarDeId) return
    setMigrando(true)

    const res = await fetch(`/api/instancias/${migrandoId}/migrar-clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ de_instancia_id: migrarDeId }),
    })
    const data = await res.json()

    setMigrando(false)
    setMigrandoId(null)
    setMigrarDeId('')

    if (res.ok) {
      mostrarFeedback(`${data.migrados} cliente${data.migrados !== 1 ? 's' : ''} migrado${data.migrados !== 1 ? 's' : ''} com sucesso.`)
    } else {
      mostrarFeedback(`Erro: ${data.error}`)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Popup de desconexão */}
      {desconectadoAlerta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <WifiOff size={22} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Número desconectado</p>
                <p className="text-sm text-gray-500">{desconectadoAlerta.nome}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              O número <span className="font-medium text-gray-800">{desconectadoAlerta.telefone || desconectadoAlerta.nome}</span> foi desconectado do WhatsApp. Reconecte para continuar recebendo mensagens.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const id = desconectadoAlerta.id
                  setDesconectadoAlerta(null)
                  setModoConexao(prev => ({ ...prev, [id]: 'qr' }))
                  conectar(id)
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Smartphone size={15} /> Reconectar agora
              </button>
              <button
                onClick={() => setDesconectadoAlerta(null)}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conexão WhatsApp</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os números conectados ao sistema.</p>
        </div>
        <button
          onClick={() => { setMostrarForm(true); setErro(null) }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nova conexão
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl mb-6">
          <CheckCircle size={15} /> {feedback}
        </div>
      )}

      {feedbackErro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{feedbackErro}</span>
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Nova conexão</h2>
            <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome da instância</label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarInstancia()}
                placeholder="Ex: Vendas Principal"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            {/* Filtros de mensagens */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Ignorar mensagens (evita loops e spam)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'wasSentByApi', label: 'Enviadas pela API', desc: 'Recomendado — evita loops' },
                  { value: 'isGroupYes', label: 'Mensagens de grupos', desc: 'Ignora grupos' },
                  { value: 'fromMeYes', label: 'Enviadas por mim', desc: 'Mensagens do próprio número' },
                  { value: 'fromMeNo', label: 'Recebidas de terceiros', desc: 'Só processa enviadas por mim' },
                  { value: 'isGroupNo', label: 'Conversas individuais', desc: 'Só processa grupos' },
                  { value: 'wasNotSentByApi', label: 'Não enviadas pela API', desc: '' },
                ].map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      checked={excludeMessages.includes(value)}
                      onChange={(e) => {
                        setExcludeMessages(prev =>
                          e.target.checked ? [...prev, value] : prev.filter(v => v !== value)
                        )
                      }}
                      className="mt-0.5 accent-green-600"
                    />
                    <span>
                      <span className="text-xs font-medium text-gray-700 block">{label}</span>
                      {desc && <span className="text-xs text-gray-400">{desc}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {erro && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle size={14} /> {erro}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={criarInstancia}
                disabled={salvando || !novoNome.trim()}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {salvando ? 'Criando...' : 'Criar e gerar QR Code'}
              </button>
              <button onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : instancias.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Smartphone size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhuma instância configurada.</p>
          <p className="text-gray-400 text-xs mt-1">Clique em &quot;Nova conexão&quot; para adicionar um número.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {instancias.map((inst) => {
            const conectado = inst.status === 'conectado'
            const conectando = inst.status === 'connecting'
            const qr = qrData[inst.id]
            const carregandoQr = loadingQr[inst.id]
            const verificando = checkingStatus[inst.id]
            const outrasInstancias = instancias.filter((i) => i.id !== inst.id)

            return (
              <div key={inst.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${conectado ? 'bg-green-100' : conectando ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                      <Smartphone size={20} className={conectado ? 'text-green-600' : conectando ? 'text-yellow-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{inst.nome}</p>
                      {conectado ? (
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-0.5">
                          <Wifi size={11} /> {inst.telefone || 'Conectado'}
                        </p>
                      ) : conectando ? (
                        <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
                          <Loader2 size={11} className="animate-spin" /> Aguardando QR Code...
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <WifiOff size={11} /> Desconectado
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => buscarStatusEQr(inst.id)}
                      disabled={verificando}
                      title="Verificar status"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      {verificando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    </button>

                    {conectado && (
                      <button
                        onClick={() => sincronizarHistorico(inst.id)}
                        disabled={sincronizandoId === inst.id}
                        title="Importar histórico completo de conversas desta instância"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 rounded-lg transition-colors"
                      >
                        {sincronizandoId === inst.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <DownloadCloud size={13} />}
                        {sincronizandoId === inst.id ? 'Sincronizando...' : 'Sincronizar histórico'}
                      </button>
                    )}

                    {conectado && outrasInstancias.length > 0 && (
                      <button
                        onClick={() => { setMigrandoId(inst.id); setMigrarDeId(outrasInstancias[0].id) }}
                        title="Migrar clientes de outra instância para esta"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <ArrowRightLeft size={13} /> Migrar clientes
                      </button>
                    )}

                    {conectado ? (
                      <button
                        onClick={() => desconectar(inst.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <WifiOff size={13} /> Desconectar
                      </button>
                    ) : modoConexao[inst.id] !== 'pairing' && (
                      <button
                        onClick={() => conectar(inst.id)}
                        disabled={carregandoQr}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors"
                      >
                        {carregandoQr ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
                        {carregandoQr ? 'Gerando...' : 'Gerar QR Code'}
                      </button>
                    )}
                    <button
                      onClick={() => deletarInstancia(inst.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Painel de migração */}
                {migrandoId === inst.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Atenção antes de migrar</p>
                      <p className="text-xs text-amber-700">
                        Migrar clientes faz com que o remarketing e futuros envios usem esta instância para contatar esses clientes.
                        Evite migrar um volume muito grande de clientes de uma vez em uma instância nova — isso pode aumentar o risco de banimento.
                      </p>
                    </div>
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="flex-1 min-w-48">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Migrar clientes de qual instância para <span className="text-green-700">{inst.nome}</span>?
                        </label>
                        <select
                          value={migrarDeId}
                          onChange={(e) => setMigrarDeId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {outrasInstancias.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nome} {o.telefone ? `(${o.telefone})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={migrarClientes}
                        disabled={migrando || !migrarDeId}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        {migrando ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                        {migrando ? 'Migrando...' : 'Confirmar migração'}
                      </button>
                      <button
                        onClick={() => { setMigrandoId(null); setMigrarDeId('') }}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {!conectado && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {/* Toggle de modo */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Método de conexão:</span>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                        <button
                          onClick={() => {
                            setModoConexao(prev => ({ ...prev, [inst.id]: 'qr' }))
                            setPairingCode(prev => ({ ...prev, [inst.id]: null }))
                          }}
                          className={`px-3 py-1.5 font-medium transition-colors ${(modoConexao[inst.id] ?? 'qr') === 'qr' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          QR Code
                        </button>
                        <button
                          onClick={() => {
                            setModoConexao(prev => ({ ...prev, [inst.id]: 'pairing' }))
                            setQrData(prev => ({ ...prev, [inst.id]: null }))
                          }}
                          className={`px-3 py-1.5 font-medium transition-colors ${modoConexao[inst.id] === 'pairing' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          Código
                        </button>
                      </div>
                    </div>

                    {/* Modo QR */}
                    {(modoConexao[inst.id] ?? 'qr') === 'qr' && (
                      <div className="flex flex-col items-center gap-3">
                        {carregandoQr ? (
                          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                            <Loader2 size={16} className="animate-spin" /> Gerando QR Code...
                          </div>
                        ) : qr ? (
                          <>
                            <p className="text-xs text-gray-500 text-center">
                              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo e escaneie o QR Code.
                            </p>
                            <img
                              src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                              alt="QR Code WhatsApp"
                              className="w-52 h-52 rounded-xl border border-gray-200"
                            />
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Loader2 size={11} className="animate-spin" />
                              Verificando conexão automaticamente...
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* Modo Código de Pareamento */}
                    {modoConexao[inst.id] === 'pairing' && (
                      <div className="space-y-3">
                        {!pairingCode[inst.id] ? (
                          <>
                            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                              <span className="text-blue-500 text-base leading-none mt-0.5">ℹ️</span>
                              <p className="text-xs text-blue-700 leading-relaxed">
                                Digite o número do WhatsApp que será conectado (com DDI e DDD). Clique em <strong>Solicitar código</strong> para gerar um código de 8 dígitos.
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="tel"
                                placeholder="5511999999999"
                                value={pairingPhone[inst.id] ?? ''}
                                onChange={e => setPairingPhone(prev => ({ ...prev, [inst.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && gerarPairingCode(inst.id)}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                autoFocus
                              />
                              <button
                                onClick={() => gerarPairingCode(inst.id)}
                                disabled={loadingPairing[inst.id] || !(pairingPhone[inst.id] ?? '').replace(/\D/g, '')}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                {loadingPairing[inst.id]
                                  ? <><Loader2 size={12} className="animate-spin" /> Aguardando...</>
                                  : <><Smartphone size={12} /> Solicitar código</>
                                }
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3 py-2">
                            <div className="flex items-center gap-2 text-xs text-gray-500 text-center">
                              <span>No WhatsApp:</span>
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">Dispositivos conectados</span>
                              <span>→</span>
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">Conectar com número</span>
                            </div>

                            <p className="text-xs text-gray-500">Digite este código no WhatsApp:</p>

                            <div className="font-mono text-4xl font-bold tracking-[0.25em] text-gray-800 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl px-8 py-4 select-all cursor-text">
                              {pairingCode[inst.id]}
                            </div>

                            <p className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin" />
                              Aguardando confirmação...
                            </p>

                            <button
                              onClick={() => {
                                setPairingCode(prev => ({ ...prev, [inst.id]: null }))
                                setPairingPhone(prev => ({ ...prev, [inst.id]: '' }))
                              }}
                              className="text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                              Tentar com outro número
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

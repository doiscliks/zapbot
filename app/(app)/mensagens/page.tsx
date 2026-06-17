'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ClienteComUltimaMensagem, MensagemWhatsapp, ClienteHistoricoItem } from '@/types'
import { supabase } from '@/lib/supabase'
import ListaClientes from '@/components/ListaClientes'
import ChatMensagens from '@/components/ChatMensagens'
import { Loader2, AlertCircle, Search, Plus } from 'lucide-react'

export default function MensagensPage() {
  const [clientes, setClientes] = useState<ClienteComUltimaMensagem[]>([])
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteComUltimaMensagem[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComUltimaMensagem | null>(null)
  const [mensagens, setMensagens] = useState<MensagemWhatsapp[]>([])
  const [busca, setBusca] = useState('')
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [loadingMensagens, setLoadingMensagens] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Ref para acessar o cliente selecionado dentro do callback do realtime
  const clienteSelecionadoRef = useRef<ClienteComUltimaMensagem | null>(null)
  clienteSelecionadoRef.current = clienteSelecionado

  // Ref para acessar a lista atual de clientes dentro do callback do realtime
  const clientesRef = useRef<ClienteComUltimaMensagem[]>([])
  clientesRef.current = clientes

  const carregarClientes = useCallback(async () => {
    try {
      const res = await fetch('/api/mensagens/clientes')
      const data = await res.json()
      if (Array.isArray(data)) setClientes(data)
    } catch {
      setErro('Erro ao carregar clientes.')
    } finally {
      setLoadingClientes(false)
    }
  }, [])

  // Carregar lista de clientes
  useEffect(() => {
    carregarClientes()
  }, [carregarClientes])

  // Sincroniza as fotos de perfil que faltam, em lotes, atualizando a lista a cada passo
  const sincronizarFotos = useCallback(async () => {
    for (let i = 0; i < 6; i++) {
      try {
        const res = await fetch('/api/mensagens/sincronizar-fotos', { method: 'POST' })
        const data = await res.json()
        if (data?.atualizadas > 0) await carregarClientes()
        if (!data?.restantes) break
      } catch {
        break
      }
    }
  }, [carregarClientes])

  useEffect(() => {
    sincronizarFotos()
  }, [sincronizarFotos])

  // Realtime — escuta novas mensagens na tabela
  useEffect(() => {
    const channel = supabase
      .channel('mensagens_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_whatsapp' },
        (payload) => {
          const nova = payload.new as MensagemWhatsapp
          const atual = clienteSelecionadoRef.current

          // Adiciona no chat se for do cliente aberto
          const telAtual = atual?.telefone ?? ''
          const matchCliente =
            nova.numero_cliente === telAtual ||
            nova.numero_cliente === `${telAtual}@s.whatsapp.net` ||
            nova.numero_cliente.replace('@s.whatsapp.net', '') === telAtual
          if (atual && matchCliente) {
            setMensagens((prev) => {
              // Evita duplicar mensagens otimistas já inseridas
              const jaExiste = prev.some(
                (m) =>
                  m.mensagem === nova.mensagem &&
                  m.quem_mandou === nova.quem_mandou &&
                  Math.abs(new Date(m.data_criacao).getTime() - new Date(nova.data_criacao).getTime()) < 5000
              )
              if (jaExiste) return prev
              return [...prev, nova]
            })
          }

          // Atualiza a lista lateral. Se for uma conversa que ainda não está na
          // lista (cliente novo), recarrega para incluí-la.
          const telNova = nova.numero_cliente.replace('@s.whatsapp.net', '')
          const existe = clientesRef.current.some((c) => {
            const t = c.telefone ?? ''
            return nova.numero_cliente === t || nova.numero_cliente === `${t}@s.whatsapp.net` || telNova === t
          })
          if (existe) {
            setClientes((prev) =>
              prev.map((c) => {
                const tel = c.telefone ?? ''
                const match =
                  nova.numero_cliente === tel ||
                  nova.numero_cliente === `${tel}@s.whatsapp.net` ||
                  nova.numero_cliente.replace('@s.whatsapp.net', '') === tel
                return match ? { ...c, ultima_mensagem: nova } : c
              })
            )
          } else {
            carregarClientes()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [carregarClientes])

  // Filtro de busca
  useEffect(() => {
    const ordenados = [...clientes].sort((a, b) => {
      const dataA = a.ultima_mensagem?.data_criacao ?? a.dt_ultima_mensagem ?? a.created_at ?? ''
      const dataB = b.ultima_mensagem?.data_criacao ?? b.dt_ultima_mensagem ?? b.created_at ?? ''
      return new Date(dataB).getTime() - new Date(dataA).getTime()
    })

    if (!busca.trim()) {
      setClientesFiltrados(ordenados)
      return
    }
    const termo = busca.toLowerCase()
    setClientesFiltrados(
      ordenados.filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          c.telefone?.toLowerCase().includes(termo) ||
          c.cidade?.toLowerCase().includes(termo)
      )
    )
  }, [busca, clientes])

  const [erroMensagens, setErroMensagens] = useState<string | null>(null)
  const [historico, setHistorico] = useState<ClienteHistoricoItem[]>([])
  const [novaNotaTexto, setNovaNotaTexto] = useState('')

  async function carregarMensagens(telefone: string) {
    setLoadingMensagens(true)
    setErroMensagens(null)
    try {
      const res = await fetch(`/api/mensagens/chat?telefone=${encodeURIComponent(telefone)}`)
      const data = await res.json()
      if (!res.ok) {
        setErroMensagens(data.error ?? `Erro ${res.status}`)
        setMensagens([])
        return
      }
      setMensagens(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
      setErroMensagens(msg)
      setMensagens([])
    } finally {
      setLoadingMensagens(false)
    }
  }

  async function handleSelecionarCliente(cliente: ClienteComUltimaMensagem) {
    setClienteSelecionado(cliente)
    setMensagens([])
    setHistorico(cliente.historico || [])
    setNovaNotaTexto('')
    await carregarMensagens(cliente.telefone)
  }

  async function adicionarNota() {
    if (!novaNotaTexto.trim() || !clienteSelecionado) return
    const novaNota: ClienteHistoricoItem = {
      data: new Date().toISOString(),
      texto: novaNotaTexto,
    }
    const novoHistorico = [novaNota, ...historico]
    setHistorico(novoHistorico)
    setNovaNotaTexto('')

    // Salva no backend
    try {
      await fetch(`/api/clientes/${clienteSelecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historico: novoHistorico }),
      })
    } catch {
      // Erro ao salvar, mas a anotação já foi adicionada localmente
    }
  }

  function handleMensagemEnviada(msg: MensagemWhatsapp) {
    setMensagens((prev) => [...prev, msg])
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Coluna esquerda */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-white shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base mb-3">Conversas</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 rounded-lg border-0 outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingClientes && (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          )}
          {erro && !loadingClientes && (
            <div className="flex items-center gap-2 text-red-600 px-4 py-4 text-sm">
              <AlertCircle size={16} />
              {erro}
            </div>
          )}
          {!loadingClientes && !erro && (
            <ListaClientes
              clientes={clientesFiltrados}
              clienteSelecionadoId={clienteSelecionado?.id ?? null}
              onSelecionar={handleSelecionarCliente}
            />
          )}
        </div>
      </div>

      {/* Coluna central — chat */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {erroMensagens && (
          <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs">
            <AlertCircle size={14} />
            Erro ao carregar mensagens: {erroMensagens}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <ChatMensagens
            cliente={clienteSelecionado}
            mensagens={mensagens}
            loading={loadingMensagens}
            onMensagemEnviada={handleMensagemEnviada}
          />
        </div>
      </div>

      {/* Coluna direita — dados do cliente */}
      {clienteSelecionado && (
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto shrink-0">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Informações do Cliente</h3>

            {/* Avatar e Nome */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700">
                {clienteSelecionado.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{clienteSelecionado.nome}</p>
                <p className="text-xs text-gray-500">{clienteSelecionado.telefone}</p>
              </div>
            </div>

            {/* Telefone */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Telefone</p>
              <p className="text-sm text-gray-900 font-medium">{clienteSelecionado.telefone}</p>
            </div>

            {/* Endereço */}
            {clienteSelecionado.endereco && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Endereço</p>
                <p className="text-sm text-gray-900">{clienteSelecionado.endereco}</p>
              </div>
            )}

            {/* Cidade */}
            {clienteSelecionado.cidade && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Cidade</p>
                <p className="text-sm text-gray-900">{clienteSelecionado.cidade}</p>
              </div>
            )}

            {/* Associado a */}
            {clienteSelecionado.assigned_user_id && (
              <div className="mb-3 pb-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Associado a</p>
                <p className="text-sm text-gray-900 font-medium">👤 Atendente atribuído</p>
              </div>
            )}

            {/* Histórico */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-3 font-semibold">HISTÓRICO DE ANOTAÇÕES</p>

              {/* Nova Anotação */}
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar anotação..."
                  value={novaNotaTexto}
                  onChange={(e) => setNovaNotaTexto(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && adicionarNota()}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={adicionarNota}
                  className="p-2 rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ background: '#12C6D6' }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Anotações */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historico.length === 0 ? (
                  <p className="text-xs text-center py-4 text-gray-400">Nenhuma anotação ainda</p>
                ) : (
                  historico.map((nota, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-gray-50 text-xs">
                      <p className="text-gray-900">{nota.texto}</p>
                      <p className="text-gray-500 mt-1">{new Date(nota.data).toLocaleString('pt-BR')}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

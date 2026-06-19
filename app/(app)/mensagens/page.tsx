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
  const [historico, setHistorico] = useState<ClienteHistoricoItem[]>([])
  const [novaNotaTexto, setNovaNotaTexto] = useState('')
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [etiquetasCliente, setEtiquetasCliente] = useState<any[]>([])
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState('')
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState('#3B82F6')
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [nomeAtendente, setNomeAtendente] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Ref para acessar o cliente selecionado dentro do callback do realtime
  const clienteSelecionadoRef = useRef<ClienteComUltimaMensagem | null>(null)
  clienteSelecionadoRef.current = clienteSelecionado

  // Ref para acessar a lista atual de clientes dentro do callback do realtime
  const clientesRef = useRef<ClienteComUltimaMensagem[]>([])
  clientesRef.current = clientes

  const carregarAtendentes = useCallback(async () => {
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      setAtendentes(Array.isArray(data) ? data : [])
    } catch {
      // Erro ao carregar atendentes
    }
  }, [])

  const carregarEtiquetas = useCallback(async () => {
    try {
      const res = await fetch('/api/etiquetas')
      const data = await res.json()
      setEtiquetas(Array.isArray(data) ? data : [])
    } catch {
      // Erro ao carregar etiquetas
    }
  }, [])

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

  // Verificar se é admin
  useEffect(() => {
    const verificarAdmin = async () => {
      try {
        const res = await fetch('/api/tenant/me')
        if (res.ok) {
          const data = await res.json()
          setIsAdmin(!data.parent_id)
        }
      } catch {
        // Erro ao verificar
      }
    }
    verificarAdmin()
  }, [])

  // Carregar lista de clientes, etiquetas e atendentes
  useEffect(() => {
    carregarClientes()
    carregarEtiquetas()
    if (isAdmin) carregarAtendentes()
  }, [carregarClientes, carregarEtiquetas, carregarAtendentes, isAdmin])

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
                if (match) {
                  return {
                    ...c,
                    ultima_mensagem: nova,
                    nao_lido: atual ? false : true, // marca como não lido se não é o cliente aberto
                  }
                }
                return c
              })
            )
          } else {
            carregarClientes()
          }
        }
      )
      .subscribe()

    // Polling de fallback apenas para o chat aberto a cada 5s
    const pollInterval = setInterval(() => {
      if (clienteSelecionadoRef.current) {
        carregarMensagens(clienteSelecionadoRef.current.telefone)
      }
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
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
    setClienteSelecionado({ ...cliente, nao_lido: false })
    setMensagens([])
    setHistorico(cliente.historico || [])
    setNovaNotaTexto('')
    // Busca nome do atendente
    if (cliente.assigned_user_id && atendentes.length > 0) {
      const atendente = atendentes.find((a: any) => a.id === cliente.assigned_user_id)
      setNomeAtendente(atendente?.nome || null)
    } else {
      setNomeAtendente(null)
    }
    // Marca mensagens como lidas na lista
    setClientes((prev) =>
      prev.map((c) => (c.id === cliente.id ? { ...c, nao_lido: false } : c))
    )
    await carregarMensagens(cliente.telefone)
  }

  async function trocarAtendente(novoAtendentId: string) {
    if (!clienteSelecionado) return
    try {
      const res = await fetch(`/api/clientes/${clienteSelecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_user_id: novoAtendentId || null }),
      })
      if (res.ok) {
        const dados = await res.json()
        setClienteSelecionado(dados)
      }
    } catch (e) {
      console.error('Erro ao trocar atendente:', e)
    }
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

  async function criarNovaEtiqueta() {
    if (!novaEtiquetaNome.trim()) return
    try {
      const res = await fetch('/api/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaEtiquetaNome, cor: novaEtiquetaCor }),
      })
      const novaEtiqueta = await res.json()
      if (res.ok) {
        setEtiquetas([...etiquetas, novaEtiqueta])
        setNovaEtiquetaNome('')
        // Adiciona ao cliente
        if (clienteSelecionado) {
          await adicionarEtiquetaAoCliente(novaEtiqueta.id)
        }
      }
    } catch {
      // Erro ao criar etiqueta
    }
  }

  async function adicionarEtiquetaAoCliente(etiquetaId: string) {
    if (!clienteSelecionado) return
    try {
      const res = await fetch('/api/clientes/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: clienteSelecionado.id, etiquetaId }),
      })
      if (res.ok) {
        await carregarEtiquetasCliente()
      }
    } catch {
      // Erro ao adicionar etiqueta
    }
  }

  async function removerEtiquetaDoCliente(etiquetaId: string) {
    if (!clienteSelecionado) return
    try {
      await fetch('/api/clientes/etiquetas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: clienteSelecionado.id, etiquetaId }),
      })
      await carregarEtiquetasCliente()
    } catch {
      // Erro ao remover etiqueta
    }
  }

  async function carregarEtiquetasCliente() {
    if (!clienteSelecionado) return
    // Carrega etiquetas do cliente a partir do histórico ou estado
    // Por enquanto, vamos simular com estado local
    setEtiquetasCliente([])
  }

  async function deletarEtiqueta(etiquetaId: string) {
    try {
      const res = await fetch(`/api/etiquetas/${etiquetaId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setEtiquetas(etiquetas.filter((e) => e.id !== etiquetaId))
      }
    } catch {
      // Erro ao deletar
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

            {/* Nome e Telefone */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <p className="font-medium text-gray-900 text-sm">{clienteSelecionado.nome}</p>
              <p className="text-xs text-gray-500">{clienteSelecionado.telefone}</p>
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

            {/* Associado a - apenas admin pode ver/editar */}
            {isAdmin && (
              <div className="mb-3 pb-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Associado a</p>
                <select
                  value={clienteSelecionado.assigned_user_id || ''}
                  onChange={(e) => trocarAtendente(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Nenhum atendente</option>
                  {atendentes.map((atendente: any) => (
                    <option key={atendente.id} value={atendente.id}>
                      👤 {atendente.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isAdmin && clienteSelecionado.assigned_user_id && (
              <div className="mb-3 pb-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Associado a</p>
                <p className="text-sm text-gray-900 font-medium">👤 Você</p>
              </div>
            )}

            {/* Etiquetas */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-3 font-semibold">ETIQUETAS</p>

              {/* Nova Etiqueta */}
              <div className="mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Nome da etiqueta..."
                  value={novaEtiquetaNome}
                  onChange={(e) => setNovaEtiquetaNome(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={novaEtiquetaCor}
                    onChange={(e) => setNovaEtiquetaCor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <button
                    onClick={criarNovaEtiqueta}
                    className="flex-1 px-3 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90"
                    style={{ background: '#12C6D6' }}
                  >
                    Criar
                  </button>
                </div>
              </div>

              {/* Etiquetas Disponíveis */}
              {etiquetas.length > 0 && (
                <div className="mb-3 pb-3 border-b border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Adicionar:</p>
                  <div className="flex flex-wrap gap-2">
                    {etiquetas.map((etiq) => (
                      <div key={etiq.id} className="group relative">
                        <button
                          onClick={() => adicionarEtiquetaAoCliente(etiq.id)}
                          className="px-3 py-1 rounded-full text-xs text-white hover:opacity-90 transition-opacity"
                          style={{ background: etiq.cor }}
                        >
                          + {etiq.nome}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir etiqueta "${etiq.nome}"?`)) {
                              deletarEtiqueta(etiq.id)
                            }
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Excluir etiqueta"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Etiquetas do Cliente */}
              {etiquetasCliente.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Associadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {etiquetasCliente.map((etiq) => (
                      <button
                        key={etiq.id}
                        onClick={() => removerEtiquetaDoCliente(etiq.id)}
                        className="px-3 py-1 rounded-full text-xs text-white hover:opacity-90 transition-opacity flex items-center gap-1"
                        style={{ background: etiq.cor }}
                      >
                        {etiq.nome} ✕
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

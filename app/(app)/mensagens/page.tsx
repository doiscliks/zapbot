'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ClienteComUltimaMensagem, MensagemWhatsapp } from '@/types'
import { supabase } from '@/lib/supabase'
import ListaClientes from '@/components/ListaClientes'
import ChatMensagens from '@/components/ChatMensagens'
import { Loader2, AlertCircle, Search } from 'lucide-react'

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
    await carregarMensagens(cliente.telefone)
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

      {/* Coluna direita — chat */}
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
    </div>
  )
}

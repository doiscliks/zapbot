'use client'

import { useEffect, useState } from 'react'
import { Copy, Plus, Trash2, Link2, ChevronDown, ChevronUp, Check, ToggleLeft, ToggleRight, Pencil, X, RefreshCw, Users as UsersIcon, ShieldCheck, Loader2 } from 'lucide-react'
import { GruposRotatorComLinks, GruposLink, GrupoDisponivel } from '@/types'

export default function GruposPage() {
  const [rotators, setRotators] = useState<GruposRotatorComLinks[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Novo rotator
  const [nomeNovoRotator, setNomeNovoRotator] = useState('')
  const [criandoRotator, setCriandoRotator] = useState(false)

  // Expansão de cards
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // Formulário de novo link por rotator
  const [novoLink, setNovoLink] = useState<Record<string, { url: string; nome: string; groupId: string }>>({})
  const [adicionandoLink, setAdicionandoLink] = useState<string | null>(null)
  const [resolvendoLink, setResolvendoLink] = useState<string | null>(null)
  const [erroLink, setErroLink] = useState<Record<string, string>>({})
  const [membroStatus, setMembroStatus] = useState<Record<string, 'membro' | 'nao-membro' | null>>({})

  // Edição de Group ID por link
  const [editandoGroupId, setEditandoGroupId] = useState<string | null>(null)
  const [groupIdEditando, setGroupIdEditando] = useState('')

  // Edição de nome
  const [editando, setEditando] = useState<string | null>(null)
  const [nomeEditando, setNomeEditando] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)

  // Sincronização
  const [sincronizando, setSincronizando] = useState<string | null>(null)

  // Feedback de cópia
  const [copiado, setCopiado] = useState<string | null>(null)

  // Seletor automático de grupos do telefone
  const [pickerRotator, setPickerRotator] = useState<string | null>(null)
  const [gruposDisp, setGruposDisp] = useState<GrupoDisponivel[]>([])
  const [carregandoDisp, setCarregandoDisp] = useState(false)
  const [erroDisp, setErroDisp] = useState<string | null>(null)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [adicionandoGrupo, setAdicionandoGrupo] = useState<string | null>(null)

  async function abrirPicker(rotatorId: string) {
    if (pickerRotator === rotatorId) { setPickerRotator(null); return }
    setPickerRotator(rotatorId)
    setGruposDisp([])
    setErroDisp(null)
    setMostrarTodos(false)
    setCarregandoDisp(true)
    try {
      const res = await fetch(`/api/grupos/disponiveis?rotator_id=${rotatorId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar grupos')
      setGruposDisp(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setErroDisp(e instanceof Error ? e.message : 'Erro ao buscar grupos')
    } finally {
      setCarregandoDisp(false)
    }
  }

  async function adicionarDoGrupo(rotatorId: string, g: GrupoDisponivel) {
    try {
      setAdicionandoGrupo(g.jid)
      setErroDisp(null)
      const res = await fetch(`/api/grupos/${rotatorId}/adicionar-grupo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupJid: g.jid, nome: g.nome }),
      })
      const link = await res.json()
      if (!res.ok) throw new Error(link.error || 'Erro ao adicionar grupo')
      setRotators((prev) => prev.map((r) => r.id === rotatorId ? { ...r, links: [...r.links, link] } : r))
      setGruposDisp((prev) => prev.map((x) => x.jid === g.jid ? { ...x, jaAdicionado: true } : x))
    } catch (e: unknown) {
      setErroDisp(e instanceof Error ? e.message : 'Erro ao adicionar grupo')
    } finally {
      setAdicionandoGrupo(null)
    }
  }

  const origem =
    typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    carregar()
  }, [])

  // Auto-sincronização a cada 2 minutos para todos os rotators com links ativos
  useEffect(() => {
    const intervalo = setInterval(async () => {
      const ids = rotators
        .filter((r) => (r.links ?? []).some((l) => l.ativo && l.whatsapp_group_id))
        .map((r) => r.id)

      for (const id of ids) {
        try {
          const resp = await fetch('/api/grupos/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rotator_id: id }),
          })
          const data = await resp.json()
          if (!resp.ok) continue

          setRotators((prev) =>
            prev.map((r) => {
              if (r.id !== id) return r
              return {
                ...r,
                links: r.links.map((l) => {
                  const resultado = data.resultados?.find((res: { id: string; participantes: number | null }) => res.id === l.id)
                  return resultado?.participantes != null ? { ...l, participantes: resultado.participantes } : l
                }),
              }
            })
          )
        } catch { /* silencioso */ }
      }
    }, 2 * 60 * 1000)

    return () => clearInterval(intervalo)
  }, [rotators])

  async function carregar() {
    try {
      setCarregando(true)
      setErro(null)
      const res = await fetch('/api/grupos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar grupos')
      const lista = Array.isArray(data) ? data : []
      setRotators(lista)
      if (lista.length > 0) setExpandidos(new Set([lista[0].id]))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar grupos')
    } finally {
      setCarregando(false)
    }
  }

  async function handleCriarRotator() {
    if (!nomeNovoRotator.trim()) return
    try {
      setCriandoRotator(true)
      const res = await fetch('/api/grupos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nomeNovoRotator.trim() }) })
      const novo = await res.json()
      if (!res.ok) throw new Error(novo.error || 'Erro ao criar grupo')
      setRotators((prev) => [novo, ...prev])
      setExpandidos((prev) => new Set([...prev, novo.id]))
      setNomeNovoRotator('')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar grupo')
    } finally {
      setCriandoRotator(false)
    }
  }

  async function handleDeletarRotator(id: string) {
    if (!confirm('Deletar este grupo e todos os links?')) return
    try {
      await fetch(`/api/grupos/${id}`, { method: 'DELETE' })
      setRotators((prev) => prev.filter((r) => r.id !== id))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao deletar grupo')
    }
  }

  async function handleResolverLink(rotatorId: string, url: string) {
    if (!url.includes('chat.whatsapp.com/')) return
    setResolvendoLink(rotatorId)
    setErroLink((prev) => ({ ...prev, [rotatorId]: '' }))
    setMembroStatus((prev) => ({ ...prev, [rotatorId]: null }))
    try {
      const res = await fetch('/api/grupos/validar-grupo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroLink((prev) => ({ ...prev, [rotatorId]: data.error }))
        return
      }
      setNovoLink((prev) => ({
        ...prev,
        [rotatorId]: { ...prev[rotatorId], groupId: data.groupJid, nome: prev[rotatorId]?.nome || data.groupNome },
      }))
      setMembroStatus((prev) => ({ ...prev, [rotatorId]: data.membro ? 'membro' : 'nao-membro' }))
    } finally {
      setResolvendoLink(null)
    }
  }

  async function handleAdicionarLink(rotatorId: string) {
    const form = novoLink[rotatorId]
    if (!form?.url?.trim()) return
    try {
      setAdicionandoLink(rotatorId)

      if (!form.groupId?.trim()) {
        setErro('Cole o link do grupo e aguarde a validação automática.')
        setAdicionandoLink(null)
        return
      }

      const res = await fetch(`/api/grupos/${rotatorId}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.url.trim(), nome: form.nome, whatsapp_group_id: form.groupId }) })
      const link = await res.json()
      setRotators((prev) => prev.map((r) => r.id === rotatorId ? { ...r, links: [...r.links, link] } : r))
      setNovoLink((prev) => ({ ...prev, [rotatorId]: { url: '', nome: '', groupId: '' } }))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao adicionar link')
    } finally {
      setAdicionandoLink(null)
    }
  }

  async function handleDeletarLink(rotatorId: string, linkId: string) {
    try {
      await fetch(`/api/grupos/links/${linkId}`, { method: 'DELETE' })
      setRotators((prev) => prev.map((r) => r.id === rotatorId ? { ...r, links: r.links.filter((l) => l.id !== linkId) } : r))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao deletar link')
    }
  }

  async function handleToggleLink(rotatorId: string, link: GruposLink) {
    try {
      await fetch(`/api/grupos/links/${link.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !link.ativo }) })
      setRotators((prev) => prev.map((r) => r.id === rotatorId ? { ...r, links: r.links.map((l) => l.id === link.id ? { ...l, ativo: !l.ativo } : l) } : r))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar link')
    }
  }

  async function handleSalvarGroupId(linkId: string, rotatorId: string) {
    if (!groupIdEditando.trim()) return
    try {
      await fetch(`/api/grupos/links/${linkId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp_group_id: groupIdEditando.trim() }) })
      setRotators((prev) => prev.map((r) => r.id !== rotatorId ? r : { ...r, links: r.links.map((l) => l.id === linkId ? { ...l, whatsapp_group_id: groupIdEditando.trim() } : l) }))
      setEditandoGroupId(null)
      setGroupIdEditando('')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar Group ID')
    }
  }

  async function handleSincronizar(rotatorId: string) {
    try {
      setSincronizando(rotatorId)
      setErro(null)
      const resp = await fetch('/api/grupos/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotator_id: rotatorId }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Erro ao sincronizar')

      // Verifica se houve erros individuais
      const erros = data.resultados?.filter((r: { erro?: string }) => r.erro)
      if (erros?.length) {
        const primeiro = erros[0]
        setErro(`Falha em ${erros.length} link(s): ${primeiro.erro}${primeiro.detalhe ? ` — ${primeiro.detalhe}` : ''}`)
      }

      // Atualiza participantes localmente para os que funcionaram
      setRotators((prev) =>
        prev.map((r) => {
          if (r.id !== rotatorId) return r
          return {
            ...r,
            links: r.links.map((l) => {
              const resultado = data.resultados?.find((res: { id: string; participantes: number | null }) => res.id === l.id)
              return resultado?.participantes != null
                ? { ...l, participantes: resultado.participantes }
                : l
            }),
          }
        })
      )
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao sincronizar')
    } finally {
      setSincronizando(null)
    }
  }

  function iniciarEdicao(rotator: GruposRotatorComLinks) {
    setEditando(rotator.id)
    setNomeEditando(rotator.nome)
  }

  function cancelarEdicao() {
    setEditando(null)
    setNomeEditando('')
  }

  async function handleRenomear(id: string) {
    if (!nomeEditando.trim()) return
    try {
      setSalvandoNome(true)
      await fetch(`/api/grupos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nomeEditando.trim() }) })
      setRotators((prev) =>
        prev.map((r) => (r.id === id ? { ...r, nome: nomeEditando.trim() } : r))
      )
      cancelarEdicao()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao renomear grupo')
    } finally {
      setSalvandoNome(false)
    }
  }

  function copiarLink(slug: string) {
    navigator.clipboard.writeText(`${origem}/g/${slug}`)
    setCopiado(slug)
    setTimeout(() => setCopiado(null), 2000)
  }

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Grupos</h1>
        <p className="text-gray-400 text-sm mt-1">
          Adicione grupos de WhatsApp e compartilhe um único link. O sistema distribui automaticamente quem entra em qual grupo.
        </p>
      </div>

      {/* Criar novo rotator */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          placeholder="Nome do grupo (ex: Grupo VIP)"
          value={nomeNovoRotator}
          onChange={(e) => setNomeNovoRotator(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCriarRotator()}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
        />
        <button
          onClick={handleCriarRotator}
          disabled={criandoRotator || !nomeNovoRotator.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          {criandoRotator ? 'Criando...' : 'Novo grupo'}
        </button>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="text-gray-400 text-sm">Carregando...</div>
      ) : rotators.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nenhum grupo criado ainda.</p>
          <p className="text-xs mt-1">Crie um grupo acima e adicione os links dos grupos do WhatsApp.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rotators.map((rotator) => {
            const expandido = expandidos.has(rotator.id)
            const form = novoLink[rotator.id] ?? { url: '', nome: '' }
            const linkPublico = `${origem}/g/${rotator.slug}`
            const ativos = (rotator.links ?? []).filter((l) => l.ativo).length

            return (
              <div key={rotator.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                {/* Header do card */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {editando === rotator.id ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={nomeEditando}
                          onChange={(e) => setNomeEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenomear(rotator.id)
                            if (e.key === 'Escape') cancelarEdicao()
                          }}
                          className="flex-1 bg-gray-900 border border-green-500 rounded-lg px-3 py-1 text-sm text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleRenomear(rotator.id)}
                          disabled={salvandoNome || !nomeEditando.trim()}
                          className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-colors shrink-0"
                          title="Salvar"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={cancelarEdicao}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shrink-0"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleExpandido(rotator.id)}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          {expandido ? (
                            <ChevronUp size={16} className="text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown size={16} className="text-gray-400 shrink-0" />
                          )}
                          <span className="font-semibold text-white truncate">{rotator.nome}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {ativos}/{rotator.links.length} ativo{ativos !== 1 ? 's' : ''}
                          </span>
                        </button>

                        <button
                          onClick={() => iniciarEdicao(rotator)}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shrink-0"
                          title="Renomear grupo"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          onClick={() => handleSincronizar(rotator.id)}
                          disabled={sincronizando === rotator.id}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors shrink-0 disabled:opacity-50"
                          title="Sincronizar participantes via UAZAPI"
                        >
                          <RefreshCw size={14} className={sincronizando === rotator.id ? 'animate-spin' : ''} />
                        </button>

                        <button
                          onClick={() => copiarLink(rotator.slug)}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shrink-0"
                          title="Copiar link público"
                        >
                          {copiado === rotator.slug ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>

                        <button
                          onClick={() => handleDeletarRotator(rotator.id)}
                          className="p-1.5 rounded-lg hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                          title="Deletar grupo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Link público — linha separada, sempre visível */}
                  <div className="flex items-center gap-1.5 mt-1.5 ml-6">
                    <Link2 size={11} className="text-green-400 shrink-0" />
                    <span className="text-xs text-gray-400 truncate">/g/{rotator.slug}</span>
                  </div>
                </div>

                {/* Links e formulário */}
                {expandido && (
                  <div className="border-t border-gray-700 px-4 py-3 space-y-2">
                    {(rotator.links ?? []).length === 0 && (
                      <p className="text-gray-500 text-xs py-1">Nenhum link adicionado ainda.</p>
                    )}

                    {(rotator.links ?? []).map((link) => (
                      <div
                        key={link.id}
                        className={`flex flex-col gap-1.5 p-2.5 rounded-lg border ${
                          link.ativo
                            ? 'bg-gray-700/50 border-gray-600'
                            : 'bg-gray-900/50 border-gray-700 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            {link.nome && (
                              <p className="text-xs font-medium text-white truncate">{link.nome}</p>
                            )}
                            <p className="text-xs text-gray-400 truncate">{link.url}</p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-0.5">
                            <span className="text-xs text-blue-400">{link.participantes} part.</span>
                            <span className="text-xs text-gray-500">{link.contador_acessos} acesso{link.contador_acessos !== 1 ? 's' : ''}</span>
                          </div>
                          <button
                            onClick={() => handleToggleLink(rotator.id, link)}
                            className="text-gray-400 hover:text-white transition-colors shrink-0"
                            title={link.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {link.ativo ? (
                              <ToggleRight size={20} className="text-green-400" />
                            ) : (
                              <ToggleLeft size={20} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletarLink(rotator.id, link.id)}
                            className="p-1 rounded hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Group ID */}
                        {editandoGroupId === link.id ? (
                          <div className="flex gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={groupIdEditando}
                              onChange={(e) => setGroupIdEditando(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSalvarGroupId(link.id, rotator.id)
                                if (e.key === 'Escape') { setEditandoGroupId(null); setGroupIdEditando('') }
                              }}
                              placeholder="120363...@g.us"
                              className="flex-1 bg-gray-900 border border-green-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleSalvarGroupId(link.id, rotator.id)}
                              className="p-1 rounded bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => { setEditandoGroupId(null); setGroupIdEditando('') }}
                              className="p-1 rounded hover:bg-gray-700 text-gray-400"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditandoGroupId(link.id); setGroupIdEditando(link.whatsapp_group_id ?? '') }}
                            className="flex items-center gap-1.5 text-left w-fit"
                          >
                            {link.whatsapp_group_id ? (
                              <span className="text-[10px] text-gray-500 font-mono">{link.whatsapp_group_id}</span>
                            ) : (
                              <span className="text-[10px] text-yellow-500">+ informar Group ID para sincronizar</span>
                            )}
                            <Pencil size={10} className="text-gray-600" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Seletor automático dos meus grupos */}
                    <div className="pt-1">
                      <button
                        onClick={() => abrirPicker(rotator.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-300 text-xs font-medium rounded-lg transition-colors w-full justify-center"
                      >
                        <UsersIcon size={13} />
                        {pickerRotator === rotator.id ? 'Ocultar meus grupos' : 'Escolher dos meus grupos'}
                        {pickerRotator === rotator.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {pickerRotator === rotator.id && (
                        <div className="mt-2 rounded-lg border border-gray-700 bg-gray-900/60 p-2">
                          {carregandoDisp ? (
                            <div className="flex items-center gap-2 text-gray-400 text-xs py-3 justify-center">
                              <Loader2 size={14} className="animate-spin" /> Buscando seus grupos...
                            </div>
                          ) : erroDisp ? (
                            <p className="text-xs text-red-400 py-2 px-1">{erroDisp}</p>
                          ) : (
                            (() => {
                              const admins = gruposDisp.filter((g) => g.isAdmin)
                              const visiveis = mostrarTodos ? gruposDisp : admins
                              return (
                                <>
                                  <div className="flex items-center justify-between mb-1.5 px-1">
                                    <span className="text-[11px] text-gray-400">
                                      {admins.length} grupo{admins.length !== 1 ? 's' : ''} que você administra
                                    </span>
                                    <button
                                      onClick={() => setMostrarTodos((v) => !v)}
                                      className="text-[11px] text-blue-400 hover:text-blue-300"
                                    >
                                      {mostrarTodos ? 'Só administrados' : `Mostrar todos (${gruposDisp.length})`}
                                    </button>
                                  </div>
                                  {visiveis.length === 0 ? (
                                    <p className="text-xs text-gray-500 py-2 px-1">
                                      {gruposDisp.length === 0 ? 'Nenhum grupo encontrado na instância conectada.' : 'Você não é administrador de nenhum grupo. Use "Mostrar todos" para ver os demais.'}
                                    </p>
                                  ) : (
                                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                                      {visiveis.map((g) => (
                                        <div key={g.jid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800/60">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs text-white truncate">{g.nome}</span>
                                              {g.isAdmin && <ShieldCheck size={11} className="text-green-400 shrink-0" />}
                                            </div>
                                            {g.participantes != null && (
                                              <span className="text-[10px] text-gray-500">{g.participantes} participantes</span>
                                            )}
                                          </div>
                                          {g.jaAdicionado ? (
                                            <span className="text-[10px] text-gray-500 shrink-0 px-2">Adicionado</span>
                                          ) : (
                                            <button
                                              onClick={() => adicionarDoGrupo(rotator.id, g)}
                                              disabled={adicionandoGrupo === g.jid}
                                              className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[11px] font-medium rounded-lg transition-colors shrink-0"
                                            >
                                              {adicionandoGrupo === g.jid ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                                              Adicionar
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )
                            })()
                          )}
                        </div>
                      )}
                    </div>

                    {/* Formulário adicionar link (manual / fallback) */}
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Link do grupo (https://chat.whatsapp.com/...)"
                          value={form.url}
                          onChange={(e) => {
                            const url = e.target.value
                            setNovoLink((prev) => ({ ...prev, [rotator.id]: { ...form, url, groupId: '', nome: '' } }))
                            setErroLink((prev) => ({ ...prev, [rotator.id]: '' }))
                          }}
                          onBlur={(e) => handleResolverLink(rotator.id, e.target.value)}
                          onPaste={(e) => {
                            const url = e.clipboardData.getData('text')
                            setNovoLink((prev) => ({ ...prev, [rotator.id]: { ...form, url, groupId: '', nome: '' } }))
                            setTimeout(() => handleResolverLink(rotator.id, url), 50)
                          }}
                          className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                        />
                        <button
                          onClick={() => handleAdicionarLink(rotator.id)}
                          disabled={adicionandoLink === rotator.id || resolvendoLink === rotator.id || !form.groupId?.trim() || membroStatus[rotator.id] !== 'membro'}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                        >
                          <Plus size={13} />
                          {adicionandoLink === rotator.id ? 'Salvando...' : resolvendoLink === rotator.id ? 'Verificando...' : 'Adicionar'}
                        </button>
                      </div>

                      {/* Feedback da resolução */}
                      {erroLink[rotator.id] && (
                        <p className="text-xs text-red-400">{erroLink[rotator.id]}</p>
                      )}
                      {form.groupId && !erroLink[rotator.id] && membroStatus[rotator.id] === 'membro' && (
                        <p className="text-xs text-green-400">✓ {form.nome || form.groupId} — instância confirmada no grupo</p>
                      )}
                      {form.groupId && !erroLink[rotator.id] && membroStatus[rotator.id] === 'nao-membro' && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-yellow-400">
                            Grupo encontrado: <strong>{form.nome || form.groupId}</strong>. Entre neste grupo pelo WhatsApp e clique no botão ao lado.
                          </p>
                          <button
                            onClick={() => handleResolverLink(rotator.id, form.url)}
                            disabled={resolvendoLink === rotator.id}
                            className="shrink-0 px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-medium rounded-lg transition-colors"
                          >
                            {resolvendoLink === rotator.id ? 'Verificando...' : 'Estou no grupo'}
                          </button>
                        </div>
                      )}
                    </div>
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

function Users({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { UserCog, Plus, Trash2, Loader2, Check, X, KeyRound, ShieldCheck, Mail, Phone, AlertCircle } from 'lucide-react'
import { SCREENS } from '@/lib/screens'
import { Usuario } from '@/types'

const ACCENT = '#12C6D6'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [formAberto, setFormAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState<{ nome: string; email: string; senha: string; telefone: string; permissoes: string[]; is_attendant: boolean }>({
    nome: '', email: '', senha: '', telefone: '', permissoes: ['mensagens'], is_attendant: false,
  })

  const [editando, setEditando] = useState<string | null>(null)
  const [editPermissoes, setEditPermissoes] = useState<string[]>([])
  const [editAtendente, setEditAtendente] = useState(false)
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar usuários')
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  function togglePermForm(key: string) {
    setForm((f) => ({
      ...f,
      permissoes: f.permissoes.includes(key) ? f.permissoes.filter((k) => k !== key) : [...f.permissoes, key],
    }))
  }

  async function criar() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha) {
      setErro('Preencha nome, email e senha.')
      return
    }
    setCriando(true)
    setErro(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário')
      setUsuarios((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setForm({ nome: '', email: '', senha: '', telefone: '', permissoes: ['mensagens'], is_attendant: false })
      setFormAberto(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar usuário')
    } finally {
      setCriando(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar')
    return data as Usuario
  }

  async function toggleAtivo(u: Usuario) {
    try {
      const atualizado = await patch(u.id, { ativo: !u.ativo })
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? atualizado : x)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar')
    }
  }

  async function deletar(u: Usuario) {
    if (!confirm(`Excluir o usuário ${u.nome}?`)) return
    try {
      await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  async function resetarSenha(u: Usuario) {
    const nova = prompt(`Nova senha para ${u.nome} (mín. 6 caracteres):`)
    if (!nova) return
    try {
      await patch(u.id, { senha: nova })
      alert('Senha atualizada.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao redefinir senha')
    }
  }

  function abrirEdicao(u: Usuario) {
    setEditando(u.id)
    setEditPermissoes(u.permissoes ?? [])
    setEditAtendente(u.is_attendant ?? false)
  }

  function toggleEditPerm(key: string) {
    setEditPermissoes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  async function salvarEdicao(id: string) {
    setSalvandoEdit(true)
    try {
      const atualizado = await patch(id, { permissoes: editPermissoes, is_attendant: editAtendente })
      setUsuarios((prev) => prev.map((x) => (x.id === id ? atualizado : x)))
      setEditando(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar configurações')
    } finally {
      setSalvandoEdit(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2'
  const inputStyle = { borderColor: '#E9EEF2', '--tw-ring-color': ACCENT } as React.CSSProperties

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(18,198,214,0.12)' }}>
            <UserCog size={20} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Usuários</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>Crie e gerencie os acessos da sua equipe.</p>
          </div>
        </div>
        <button
          onClick={() => setFormAberto((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #12C6D6, #0FBDCC)', boxShadow: '0 3px 10px rgba(18,198,214,0.3)' }}
        >
          <Plus size={16} /> Novo usuário
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={15} /> {erro}
        </div>
      )}

      {/* Form de criação */}
      {formAberto && (
        <div className="bg-white rounded-2xl border p-5 mb-6" style={{ borderColor: '#E9EEF2' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input className={inputCls} style={inputStyle} placeholder="Nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <input className={inputCls} style={inputStyle} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className={inputCls} style={inputStyle} type="password" placeholder="Senha (mín. 6)" value={form.senha} onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} />
            <input className={inputCls} style={inputStyle} placeholder="Telefone (opcional)" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
          </div>

          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: 'rgba(18,198,214,0.05)' }}>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_attendant: !f.is_attendant }))}
              className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
              style={form.is_attendant
                ? { borderColor: ACCENT, background: ACCENT }
                : { borderColor: '#E9EEF2' }}
            >
              {form.is_attendant && <Check size={14} className="text-white" />}
            </button>
            <span className="text-sm font-medium" style={{ color: '#1F2937' }}>É atendente (receberá conversas automaticamente)</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Telas que este usuário pode acessar</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {SCREENS.map((s) => {
              const ativo = form.permissoes.includes(s.key)
              return (
                <button
                  key={s.key}
                  onClick={() => togglePermForm(s.key)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors"
                  style={ativo
                    ? { borderColor: ACCENT, background: 'rgba(18,198,214,0.08)', color: '#1F2937' }
                    : { borderColor: '#E9EEF2', color: '#6B7280' }}
                >
                  <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: ativo ? ACCENT : '#E9EEF2' }}>
                    {ativo && <Check size={12} className="text-white" />}
                  </span>
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            <button onClick={criar} disabled={criando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {criando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Criar usuário
            </button>
            <button onClick={() => setFormAberto(false)} className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: '#9CA3AF' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
          <UserCog size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum usuário criado ainda.</p>
          <p className="text-xs mt-1">Clique em &quot;Novo usuário&quot; para adicionar alguém da sua equipe.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl border p-4" style={{ borderColor: '#E9EEF2' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1F2937' }}>{u.nome}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={u.ativo ? { background: '#F0FDF4', color: '#16a34a' } : { background: '#F3F4F6', color: '#9CA3AF' }}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    {u.is_attendant && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(18,198,214,0.12)', color: ACCENT }}>
                        Atendente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: '#6B7280' }}>
                    <span className="flex items-center gap-1"><Mail size={11} /> {u.email}</span>
                    {u.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {u.telefone}</span>}
                    <span className="flex items-center gap-1"><ShieldCheck size={11} style={{ color: ACCENT }} /> {(u.permissoes?.length ?? 0)} tela(s)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrirEdicao(u)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E9EEF2', color: '#1F2937' }}>Permissões</button>
                  <button onClick={() => resetarSenha(u)} title="Redefinir senha" className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color: '#6B7280' }}><KeyRound size={15} /></button>
                  <button onClick={() => toggleAtivo(u)} title={u.ativo ? 'Desativar' : 'Ativar'} className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color: u.ativo ? '#16a34a' : '#9CA3AF' }}>
                    {u.ativo ? <Check size={15} /> : <X size={15} />}
                  </button>
                  <button onClick={() => deletar(u)} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500" style={{ color: '#9CA3AF' }}><Trash2 size={15} /></button>
                </div>
              </div>

              {/* Edição de permissões */}
              {editando === u.id && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: 'rgba(18,198,214,0.05)' }}>
                    <button
                      type="button"
                      onClick={() => setEditAtendente((prev) => !prev)}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                      style={editAtendente
                        ? { borderColor: ACCENT, background: ACCENT }
                        : { borderColor: '#E9EEF2' }}
                    >
                      {editAtendente && <Check size={14} className="text-white" />}
                    </button>
                    <span className="text-sm font-medium" style={{ color: '#1F2937' }}>É atendente (receberá conversas automaticamente)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {SCREENS.map((s) => {
                      const ativo = editPermissoes.includes(s.key)
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleEditPerm(s.key)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors"
                          style={ativo ? { borderColor: ACCENT, background: 'rgba(18,198,214,0.08)', color: '#1F2937' } : { borderColor: '#E9EEF2', color: '#6B7280' }}
                        >
                          <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: ativo ? ACCENT : '#E9EEF2' }}>
                            {ativo && <Check size={12} className="text-white" />}
                          </span>
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => salvarEdicao(u.id)} disabled={salvandoEdit} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
                      {salvandoEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
                    </button>
                    <button onClick={() => setEditando(null)} className="px-3 py-1.5 text-xs" style={{ color: '#6B7280' }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

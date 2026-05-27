'use client'

import { Settings } from 'lucide-react'

interface Instancia {
  id: string
  nome: string
  telefone: string | null
}

interface FlowMeta {
  name: string
  description: string
  status: string
  flow_type: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  whatsapp_instance_id: string
  schedule_config: Record<string, unknown>
  contact_filters: Record<string, unknown>
}

interface Props {
  flowMeta: FlowMeta
  onChange: (key: string, value: unknown) => void
  instancias: Instancia[]
}

const FLOW_TYPES: { value: string; label: string; desc: string }[] = [
  { value: 'chatbot', label: 'Chatbot', desc: 'Responde automaticamente com perguntas e condições' },
  { value: 'primeiro_atendimento', label: 'Primeiro Atendimento', desc: 'Ativado quando um novo contato entra' },
  { value: 'remarketing', label: 'Remarketing', desc: 'Disparos agendados ou baseados em condição' },
  { value: 'manual', label: 'Disparo Manual', desc: 'Ativado manualmente para contatos específicos' },
]

const TRIGGERS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  chatbot: [
    { value: 'nova_mensagem', label: 'Nova mensagem recebida' },
    { value: 'primeiro_contato', label: 'Primeiro contato' },
    { value: 'palavra_chave', label: 'Palavra-chave recebida' },
  ],
  primeiro_atendimento: [
    { value: 'primeiro_contato', label: 'Primeiro contato' },
    { value: 'nova_mensagem', label: 'Nova mensagem recebida' },
  ],
  remarketing: [
    { value: 'agendamento', label: 'Agendamento recorrente' },
    { value: 'status_alterado', label: 'Status alterado no CRM' },
    { value: 'tag_adicionada', label: 'Tag adicionada ao contato' },
    { value: 'sem_resposta', label: 'Tempo sem resposta' },
  ],
  manual: [
    { value: 'disparo_manual', label: 'Disparo manual' },
  ],
}

const SCHEDULE_FREQS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
]

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 leading-tight">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400'
const selectCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white'
const textareaCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none'

export default function FlowSettingsPanel({ flowMeta, onChange, instancias }: Props) {
  const triggers = TRIGGERS_BY_TYPE[flowMeta.flow_type] ?? TRIGGERS_BY_TYPE.chatbot
  const sched = flowMeta.schedule_config ?? {}
  const filters = flowMeta.contact_filters ?? {}

  function updateSched(key: string, value: unknown) {
    onChange('schedule_config', { ...sched, [key]: value })
  }

  function updateFilters(key: string, value: unknown) {
    onChange('contact_filters', { ...filters, [key]: value })
  }

  function toggleDay(day: number) {
    const days: number[] = (sched.days as number[]) ?? []
    const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day]
    updateSched('days', next.sort())
  }

  return (
    <div className="w-72 bg-white border-l border-gray-100 flex flex-col shrink-0 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <Settings size={14} className="text-purple-500" />
        <p className="text-sm font-semibold text-gray-800">Configurações do Fluxo</p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Descrição */}
        <Field label="Descrição">
          <textarea className={textareaCls} rows={2} value={flowMeta.description} onChange={e => onChange('description', e.target.value)} placeholder="Descreva o objetivo deste fluxo..." />
        </Field>

        {/* Tipo */}
        <Field label="Tipo do fluxo">
          <div className="space-y-1.5">
            {FLOW_TYPES.map(ft => (
              <label key={ft.value} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${flowMeta.flow_type === ft.value ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="flow_type"
                  value={ft.value}
                  checked={flowMeta.flow_type === ft.value}
                  onChange={() => onChange('flow_type', ft.value)}
                  className="mt-0.5 accent-purple-600"
                />
                <span>
                  <span className="text-xs font-semibold text-gray-800 block">{ft.label}</span>
                  <span className="text-[11px] text-gray-400">{ft.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>

        {/* Gatilho */}
        <Field label="Gatilho de entrada">
          <select className={selectCls} value={flowMeta.trigger_type} onChange={e => onChange('trigger_type', e.target.value)}>
            {triggers.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        {flowMeta.trigger_type === 'palavra_chave' && (
          <Field label="Palavra-chave" hint="Separadas por vírgula para múltiplas">
            <input className={inputCls} value={(flowMeta.trigger_config.keyword as string) ?? ''} onChange={e => onChange('trigger_config', { ...flowMeta.trigger_config, keyword: e.target.value })} placeholder="Ex: oi, olá, quero" />
          </Field>
        )}

        {/* Instância WhatsApp */}
        <Field label="Instância WhatsApp" hint="Deixe em branco para usar qualquer instância">
          <select className={selectCls} value={flowMeta.whatsapp_instance_id} onChange={e => onChange('whatsapp_instance_id', e.target.value)}>
            <option value="">Qualquer instância</option>
            {instancias.map(i => (
              <option key={i.id} value={i.id}>{i.nome}{i.telefone ? ` (${i.telefone})` : ''}</option>
            ))}
          </select>
        </Field>

        {/* Reentrada */}
        <Field label="Reentrada no fluxo">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!(flowMeta.contact_filters as Record<string, unknown>)?.allow_reentry}
              onChange={e => updateFilters('allow_reentry', e.target.checked)}
              className="accent-purple-600"
            />
            <span className="text-sm text-gray-600">Permitir que o mesmo contato entre novamente</span>
          </label>
        </Field>

        {/* Filtros de contato */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtros de Contato</p>

          <Field label="Tags incluídas" hint="Só entra no fluxo quem tiver essas tags (separadas por vírgula)">
            <input className={inputCls} value={(filters.tags_include as string) ?? ''} onChange={e => updateFilters('tags_include', e.target.value)} placeholder="Ex: vip, hot-lead" />
          </Field>

          <Field label="Tags excluídas" hint="Quem tiver essas tags não entra">
            <input className={inputCls} value={(filters.tags_exclude as string) ?? ''} onChange={e => updateFilters('tags_exclude', e.target.value)} placeholder="Ex: cliente, cancelado" />
          </Field>

          <Field label="Status do lead incluídos" hint="Deixe em branco para qualquer status">
            <input className={inputCls} value={(filters.status_include as string) ?? ''} onChange={e => updateFilters('status_include', e.target.value)} placeholder="Ex: novo, qualificado" />
          </Field>
        </div>

        {/* Agendamento (apenas remarketing) */}
        {flowMeta.flow_type === 'remarketing' && flowMeta.trigger_type === 'agendamento' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agendamento</p>

            <Field label="Frequência">
              <select className={selectCls} value={(sched.freq as string) ?? 'diario'} onChange={e => updateSched('freq', e.target.value)}>
                {SCHEDULE_FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>

            <Field label="Horário">
              <input className={inputCls} type="time" value={(sched.time as string) ?? '09:00'} onChange={e => updateSched('time', e.target.value)} />
            </Field>

            {(sched.freq === 'semanal' || !sched.freq) && (
              <Field label="Dias da semana">
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map((day, i) => {
                    const selected = ((sched.days as number[]) ?? []).includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

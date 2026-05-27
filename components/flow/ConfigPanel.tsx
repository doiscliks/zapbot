'use client'

import { Node } from '@xyflow/react'
import { X } from 'lucide-react'

interface Props {
  node: Node | null
  onChange: (key: string, value: unknown) => void
  onClose: () => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400'
const selectCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white'
const textareaCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none'

export default function ConfigPanel({ node, onChange, onClose }: Props) {
  if (!node) {
    return (
      <div className="w-72 bg-white border-l border-gray-100 flex items-center justify-center shrink-0">
        <p className="text-xs text-gray-400 text-center px-6">Selecione um bloco para configurar</p>
      </div>
    )
  }

  const d = node.data as Record<string, unknown>
  const type = d.nodeType as string

  return (
    <div className="w-72 bg-white border-l border-gray-100 flex flex-col shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div>
          <p className="text-sm font-semibold text-gray-800">{d.label as string}</p>
          <p className="text-xs text-gray-400">{node.id.slice(0, 8)}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <Field label="Nome do bloco">
          <input className={inputCls} value={d.label as string} onChange={e => onChange('label', e.target.value)} />
        </Field>

        {/* ── INÍCIO ── */}
        {type === 'start' && (
          <>
            <Field label="Tipo de gatilho">
              <select className={selectCls} value={d.trigger_type as string} onChange={e => onChange('trigger_type', e.target.value)}>
                <option value="nova_mensagem">Nova mensagem</option>
                <option value="primeiro_contato">Primeiro contato</option>
                <option value="palavra_chave">Palavra-chave</option>
                <option value="status_alterado">Status alterado no CRM</option>
                <option value="tag_adicionada">Tag adicionada</option>
                <option value="sem_resposta">Tempo sem resposta</option>
                <option value="disparo_manual">Disparo manual</option>
                <option value="agendamento">Agendamento recorrente</option>
                <option value="webhook_recebido">Webhook recebido</option>
              </select>
            </Field>
            {d.trigger_type === 'palavra_chave' && (
              <Field label="Palavra-chave" hint="Separadas por vírgula para múltiplas">
                <input className={inputCls} value={d.keyword as string} onChange={e => onChange('keyword', e.target.value)} placeholder="Ex: oi, olá, quero" />
              </Field>
            )}
            {d.trigger_type === 'status_alterado' && (
              <Field label="Status que dispara">
                <input className={inputCls} value={d.status_trigger as string ?? ''} onChange={e => onChange('status_trigger', e.target.value)} placeholder="Ex: qualificado" />
              </Field>
            )}
            {d.trigger_type === 'tag_adicionada' && (
              <Field label="Tag que dispara">
                <input className={inputCls} value={d.tag_trigger as string ?? ''} onChange={e => onChange('tag_trigger', e.target.value)} placeholder="Ex: vip" />
              </Field>
            )}
            {d.trigger_type === 'sem_resposta' && (
              <Field label="Horas sem resposta">
                <input className={inputCls} type="number" min={1} value={d.no_response_hours as number ?? 24} onChange={e => onChange('no_response_hours', Number(e.target.value))} />
              </Field>
            )}
          </>
        )}

        {/* ── MENSAGEM DE TEXTO ── */}
        {type === 'message' && (
          <>
            <Field label="Mensagem" hint="Use {{variavel}} para dados do lead">
              <textarea className={textareaCls} rows={5} value={d.text as string} onChange={e => onChange('text', e.target.value)} placeholder="Olá, {{nome}}! Como posso ajudar?" />
            </Field>
            <Field label="Delay antes de enviar (ms)" hint="0 = sem delay">
              <input className={inputCls} type="number" min={0} step={500} value={d.delay_seconds as number} onChange={e => onChange('delay_seconds', Number(e.target.value))} />
            </Field>
          </>
        )}

        {/* ── ENVIAR IMAGEM ── */}
        {type === 'send_image' && (
          <>
            <Field label="URL da imagem">
              <input className={inputCls} value={d.media_url as string} onChange={e => onChange('media_url', e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Legenda (opcional)">
              <textarea className={textareaCls} rows={3} value={d.caption as string} onChange={e => onChange('caption', e.target.value)} placeholder="Legenda da imagem..." />
            </Field>
          </>
        )}

        {/* ── ENVIAR ÁUDIO ── */}
        {type === 'send_audio' && (
          <Field label="URL do áudio (MP3 ou OGG)">
            <input className={inputCls} value={d.media_url as string} onChange={e => onChange('media_url', e.target.value)} placeholder="https://..." />
          </Field>
        )}

        {/* ── ENVIAR VÍDEO ── */}
        {type === 'send_video' && (
          <>
            <Field label="URL do vídeo">
              <input className={inputCls} value={d.media_url as string} onChange={e => onChange('media_url', e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Legenda (opcional)">
              <textarea className={textareaCls} rows={3} value={d.caption as string} onChange={e => onChange('caption', e.target.value)} placeholder="Legenda do vídeo..." />
            </Field>
          </>
        )}

        {/* ── ENVIAR DOCUMENTO ── */}
        {type === 'send_document' && (
          <>
            <Field label="URL do documento">
              <input className={inputCls} value={d.media_url as string} onChange={e => onChange('media_url', e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Nome do arquivo">
              <input className={inputCls} value={d.filename as string} onChange={e => onChange('filename', e.target.value)} placeholder="Ex: proposta.pdf" />
            </Field>
          </>
        )}

        {/* ── PERGUNTA ── */}
        {type === 'question' && (
          <>
            <Field label="Pergunta">
              <textarea className={textareaCls} rows={4} value={d.text as string} onChange={e => onChange('text', e.target.value)} placeholder="Ex: Qual é o seu nome?" />
            </Field>
            <Field label="Salvar resposta em" hint="Nome da variável (sem espaços)">
              <input className={inputCls} value={d.variable as string} onChange={e => onChange('variable', e.target.value)} placeholder="Ex: nome, cidade, orcamento" />
            </Field>
            <Field label="Tipo de dado">
              <select className={selectCls} value={d.data_type as string} onChange={e => onChange('data_type', e.target.value)}>
                <option value="texto">Texto livre</option>
                <option value="numero">Número</option>
                <option value="telefone">Telefone</option>
                <option value="email">E-mail</option>
                <option value="opcao">Opção (lista)</option>
              </select>
            </Field>
            {d.data_type === 'opcao' && (
              <Field label="Opções válidas" hint="Separadas por vírgula">
                <input className={inputCls} value={d.options as string ?? ''} onChange={e => onChange('options', e.target.value)} placeholder="Ex: Sim,Não,Talvez" />
              </Field>
            )}
            <Field label="Timeout sem resposta (horas)" hint="0 = sem timeout">
              <input className={inputCls} type="number" min={0} value={d.timeout_hours as number ?? 0} onChange={e => onChange('timeout_hours', Number(e.target.value))} />
            </Field>
          </>
        )}

        {/* ── VERIFICAR PALAVRA-CHAVE ── */}
        {type === 'check_keyword' && (
          <>
            <Field label="Palavras-chave" hint="Separadas por vírgula">
              <input className={inputCls} value={d.keywords as string} onChange={e => onChange('keywords', e.target.value)} placeholder="Ex: sim, quero, confirmar" />
            </Field>
            <Field label="Tipo de correspondência">
              <select className={selectCls} value={d.match_type as string} onChange={e => onChange('match_type', e.target.value)}>
                <option value="contém">Contém a palavra</option>
                <option value="igual">Igual exato</option>
                <option value="começa_com">Começa com</option>
              </select>
            </Field>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <strong>Sim</strong> → contém a palavra · <strong>Não</strong> → não contém
            </p>
          </>
        )}

        {/* ── VERIFICAR RESPOSTA ── */}
        {type === 'check_response' && (
          <>
            <Field label="Timeout (horas)" hint="Tempo máximo aguardando resposta">
              <input className={inputCls} type="number" min={1} value={d.timeout_hours as number} onChange={e => onChange('timeout_hours', Number(e.target.value))} />
            </Field>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <strong>Sim</strong> → respondeu dentro do prazo · <strong>Não</strong> → não respondeu
            </p>
          </>
        )}

        {/* ── CONDIÇÃO ── */}
        {type === 'condition' && (
          <>
            <Field label="Campo a validar" hint="Nome de variável do fluxo ou campo do CRM">
              <input className={inputCls} value={d.field as string} onChange={e => onChange('field', e.target.value)} placeholder="Ex: cidade, orcamento, status" />
            </Field>
            <Field label="Operador">
              <select className={selectCls} value={d.operator as string} onChange={e => onChange('operator', e.target.value)}>
                <option value="igual">Igual a</option>
                <option value="diferente">Diferente de</option>
                <option value="contém">Contém</option>
                <option value="não_contém">Não contém</option>
                <option value="maior_que">Maior que</option>
                <option value="menor_que">Menor que</option>
                <option value="existe">Existe (não vazio)</option>
                <option value="nao_existe">Não existe (vazio)</option>
              </select>
            </Field>
            {!['existe', 'nao_existe'].includes(d.operator as string) && (
              <Field label="Valor esperado">
                <input className={inputCls} value={d.value as string} onChange={e => onChange('value', e.target.value)} placeholder="Ex: São Paulo" />
              </Field>
            )}
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <strong>Sim</strong> → condição verdadeira · <strong>Não</strong> → condição falsa
            </p>
          </>
        )}

        {/* ── VERIFICAR STATUS ── */}
        {type === 'check_status' && (
          <>
            <Field label="Status a verificar">
              <input className={inputCls} value={d.status as string} onChange={e => onChange('status', e.target.value)} placeholder="Ex: qualificado, perdido" />
            </Field>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <strong>Sim</strong> → lead tem esse status · <strong>Não</strong> → status diferente
            </p>
          </>
        )}

        {/* ── ATUALIZAR CRM ── */}
        {type === 'update_crm' && (
          <>
            <Field label="Novo status do lead">
              <input className={inputCls} value={d.status as string} onChange={e => onChange('status', e.target.value)} placeholder="Ex: qualificado, perdido" />
            </Field>
            <Field label="Responsável">
              <input className={inputCls} value={d.responsible as string} onChange={e => onChange('responsible', e.target.value)} placeholder="Nome do responsável" />
            </Field>
            <Field label="Anotação interna (opcional)">
              <textarea className={textareaCls} rows={3} value={d.note as string ?? ''} onChange={e => onChange('note', e.target.value)} placeholder="Anotação no histórico do lead..." />
            </Field>
          </>
        )}

        {/* ── ADICIONAR TAG ── */}
        {type === 'add_tag' && (
          <Field label="Tag a adicionar">
            <input className={inputCls} value={d.tag as string} onChange={e => onChange('tag', e.target.value)} placeholder="Ex: vip, interessado, hot-lead" />
          </Field>
        )}

        {/* ── REMOVER TAG ── */}
        {type === 'remove_tag' && (
          <Field label="Tag a remover">
            <input className={inputCls} value={d.tag as string} onChange={e => onChange('tag', e.target.value)} placeholder="Ex: cold-lead, inativo" />
          </Field>
        )}

        {/* ── AGENTE IA ── */}
        {type === 'ai_agent' && (
          <>
            <Field label="Prompt do agente" hint="Instruções de personalidade e comportamento">
              <textarea className={textareaCls} rows={6} value={d.prompt as string} onChange={e => onChange('prompt', e.target.value)} placeholder="Você é um assistente de vendas da empresa X. Responda de forma simpática e objetiva..." />
            </Field>
            <Field label="Limite de mensagens" hint="Máx. de trocas antes de encerrar ou transferir">
              <input className={inputCls} type="number" min={1} max={50} value={d.message_limit as number} onChange={e => onChange('message_limit', Number(e.target.value))} />
            </Field>
            <Field label="Ao atingir limite">
              <select className={selectCls} value={String(d.transfer_to_human)} onChange={e => onChange('transfer_to_human', e.target.value === 'true')}>
                <option value="false">Encerrar fluxo</option>
                <option value="true">Transferir para humano</option>
              </select>
            </Field>
          </>
        )}

        {/* ── DELAY ── */}
        {type === 'delay' && (
          <>
            <Field label="Tempo de espera">
              <input className={inputCls} type="number" min={1} value={d.time as number} onChange={e => onChange('time', Number(e.target.value))} />
            </Field>
            <Field label="Unidade">
              <select className={selectCls} value={d.unit as string} onChange={e => onChange('unit', e.target.value)}>
                <option value="segundos">Segundos</option>
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
                <option value="dias">Dias</option>
              </select>
            </Field>
          </>
        )}

        {/* ── ATENDENTE HUMANO ── */}
        {type === 'human_transfer' && (
          <>
            <Field label="Departamento">
              <input className={inputCls} value={d.department as string} onChange={e => onChange('department', e.target.value)} placeholder="Ex: Vendas, Suporte" />
            </Field>
            <Field label="Responsável">
              <input className={inputCls} value={d.responsible as string} onChange={e => onChange('responsible', e.target.value)} placeholder="Nome do responsável" />
            </Field>
            <Field label="Mensagem interna" hint="Contexto para o atendente (não enviado ao cliente)">
              <textarea className={textareaCls} rows={3} value={d.internal_message as string} onChange={e => onChange('internal_message', e.target.value)} placeholder="Lead veio do fluxo X..." />
            </Field>
          </>
        )}

        {/* ── WEBHOOK ── */}
        {type === 'webhook' && (
          <>
            <Field label="URL do webhook">
              <input className={inputCls} value={d.url as string} onChange={e => onChange('url', e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Método">
              <select className={selectCls} value={d.method as string} onChange={e => onChange('method', e.target.value)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </Field>
            <Field label="Headers (JSON)">
              <textarea className={textareaCls} rows={3} value={d.headers as string} onChange={e => onChange('headers', e.target.value)} placeholder={'{"Authorization": "Bearer token"}'} />
            </Field>
            <Field label="Body (JSON · use {{variavel}})">
              <textarea className={textareaCls} rows={4} value={d.body as string} onChange={e => onChange('body', e.target.value)} placeholder={'{"nome": "{{nome}}", "telefone": "{{telefone}}"}'} />
            </Field>
          </>
        )}

        {/* ── FINALIZAR ── */}
        {type === 'end' && (
          <>
            <Field label="Mensagem final" hint="Opcional — enviada ao encerrar o fluxo">
              <textarea className={textareaCls} rows={4} value={d.final_message as string} onChange={e => onChange('final_message', e.target.value)} placeholder="Ex: Obrigado pelo contato!" />
            </Field>
            <Field label="Status final do lead">
              <input className={inputCls} value={d.final_status as string} onChange={e => onChange('final_status', e.target.value)} placeholder="Ex: finalizado, convertido" />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}

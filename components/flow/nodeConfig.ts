import {
  Play, MessageSquare, HelpCircle, GitBranch, Cpu, Clock,
  Database, UserCheck, Globe, StopCircle,
  Image, Mic, Video, FileText, Tag, Search, CheckCircle, AlarmClock, Minus, Filter,
} from 'lucide-react'

export const NODE_CONFIG = {
  start: {
    label: 'Início',
    color: '#10b981',
    headerClass: 'bg-emerald-500',
    icon: Play,
    defaultData: { nodeType: 'start', label: 'Início', trigger_type: 'nova_mensagem', keyword: '' },
  },
  message: {
    label: 'Mensagem de Texto',
    color: '#3b82f6',
    headerClass: 'bg-blue-500',
    icon: MessageSquare,
    defaultData: { nodeType: 'message', label: 'Mensagem de Texto', text: '', delay_seconds: 0 },
  },
  send_image: {
    label: 'Enviar Imagem',
    color: '#ec4899',
    headerClass: 'bg-pink-500',
    icon: Image,
    defaultData: { nodeType: 'send_image', label: 'Enviar Imagem', media_url: '', caption: '' },
  },
  send_audio: {
    label: 'Enviar Áudio',
    color: '#f97316',
    headerClass: 'bg-orange-500',
    icon: Mic,
    defaultData: { nodeType: 'send_audio', label: 'Enviar Áudio', media_url: '' },
  },
  send_video: {
    label: 'Enviar Vídeo',
    color: '#a855f7',
    headerClass: 'bg-purple-500',
    icon: Video,
    defaultData: { nodeType: 'send_video', label: 'Enviar Vídeo', media_url: '', caption: '' },
  },
  send_document: {
    label: 'Enviar Documento',
    color: '#0ea5e9',
    headerClass: 'bg-sky-500',
    icon: FileText,
    defaultData: { nodeType: 'send_document', label: 'Enviar Documento', media_url: '', filename: '' },
  },
  question: {
    label: 'Fazer Pergunta',
    color: '#8b5cf6',
    headerClass: 'bg-violet-500',
    icon: HelpCircle,
    defaultData: { nodeType: 'question', label: 'Fazer Pergunta', text: '', variable: 'resposta', data_type: 'texto' },
  },
  check_keyword: {
    label: 'Verificar Palavra-chave',
    color: '#f59e0b',
    headerClass: 'bg-amber-500',
    icon: Search,
    defaultData: { nodeType: 'check_keyword', label: 'Verificar Palavra-chave', keywords: '', match_type: 'contém' },
  },
  check_response: {
    label: 'Verificar Resposta',
    color: '#84cc16',
    headerClass: 'bg-lime-500',
    icon: AlarmClock,
    defaultData: { nodeType: 'check_response', label: 'Verificar Resposta', timeout_hours: 24 },
  },
  condition: {
    label: 'Condição (Se/Senão)',
    color: '#d97706',
    headerClass: 'bg-amber-600',
    icon: GitBranch,
    defaultData: { nodeType: 'condition', label: 'Condição', field: '', operator: 'igual', value: '' },
  },
  check_status: {
    label: 'Verificar Status',
    color: '#06b6d4',
    headerClass: 'bg-cyan-500',
    icon: Filter,
    defaultData: { nodeType: 'check_status', label: 'Verificar Status', status: '' },
  },
  update_crm: {
    label: 'Atualizar CRM',
    color: '#14b8a6',
    headerClass: 'bg-teal-500',
    icon: Database,
    defaultData: { nodeType: 'update_crm', label: 'Atualizar CRM', status: '', responsible: '' },
  },
  add_tag: {
    label: 'Adicionar Tag',
    color: '#059669',
    headerClass: 'bg-emerald-600',
    icon: Tag,
    defaultData: { nodeType: 'add_tag', label: 'Adicionar Tag', tag: '' },
  },
  remove_tag: {
    label: 'Remover Tag',
    color: '#f43f5e',
    headerClass: 'bg-rose-500',
    icon: Minus,
    defaultData: { nodeType: 'remove_tag', label: 'Remover Tag', tag: '' },
  },
  ai_agent: {
    label: 'Agente de IA',
    color: '#6366f1',
    headerClass: 'bg-indigo-500',
    icon: Cpu,
    defaultData: { nodeType: 'ai_agent', label: 'Agente de IA', prompt: '', message_limit: 5, transfer_to_human: false },
  },
  delay: {
    label: 'Aguardar (Delay)',
    color: '#eab308',
    headerClass: 'bg-yellow-500',
    icon: Clock,
    defaultData: { nodeType: 'delay', label: 'Aguardar', time: 1, unit: 'minutos' },
  },
  human_transfer: {
    label: 'Atendente Humano',
    color: '#ef4444',
    headerClass: 'bg-red-500',
    icon: UserCheck,
    defaultData: { nodeType: 'human_transfer', label: 'Atendente Humano', department: '', responsible: '', internal_message: '' },
  },
  webhook: {
    label: 'Webhook Externo',
    color: '#64748b',
    headerClass: 'bg-slate-500',
    icon: Globe,
    defaultData: { nodeType: 'webhook', label: 'Webhook Externo', url: '', method: 'POST', headers: '{}', body: '{}' },
  },
  end: {
    label: 'Finalizar Fluxo',
    color: '#374151',
    headerClass: 'bg-gray-700',
    icon: StopCircle,
    defaultData: { nodeType: 'end', label: 'Finalizar Fluxo', final_message: '', final_status: '' },
  },
} as const

export type NodeType = keyof typeof NODE_CONFIG

// Tipos que usam handles duplos (Sim/Não)
export const CONDITION_TYPES = new Set<string>(['condition', 'check_keyword', 'check_status', 'check_response'])

export const BLOCK_SECTIONS: { label: string; types: NodeType[] }[] = [
  { label: 'Início', types: ['start'] },
  { label: 'Mensagens', types: ['message', 'send_image', 'send_audio', 'send_video', 'send_document'] },
  { label: 'Interação', types: ['question', 'check_keyword', 'check_response'] },
  { label: 'Condições', types: ['condition', 'check_status'] },
  { label: 'CRM', types: ['update_crm', 'add_tag', 'remove_tag'] },
  { label: 'Automação', types: ['ai_agent', 'delay', 'human_transfer', 'webhook'] },
  { label: 'Fim', types: ['end'] },
]

export function getNodePreview(data: Record<string, unknown>): string {
  const t = data.nodeType as NodeType
  switch (t) {
    case 'start': return `Gatilho: ${data.trigger_type === 'palavra_chave' ? `"${data.keyword}"` : data.trigger_type}`
    case 'message': return (data.text as string) || 'Clique para editar a mensagem'
    case 'send_image': return (data.caption as string) || (data.media_url as string) || 'URL da imagem'
    case 'send_audio': return (data.media_url as string) || 'URL do áudio'
    case 'send_video': return (data.caption as string) || (data.media_url as string) || 'URL do vídeo'
    case 'send_document': return (data.filename as string) || (data.media_url as string) || 'URL do documento'
    case 'question': return (data.text as string) || 'Clique para editar a pergunta'
    case 'check_keyword': return `Palavras: ${(data.keywords as string) || '...'}`
    case 'check_response': return `Timeout: ${data.timeout_hours}h`
    case 'condition': return `${data.field || '?'} ${data.operator} "${data.value || '?'}"`
    case 'check_status': return `Status: ${(data.status as string) || '...'}`
    case 'add_tag': return `Tag: ${(data.tag as string) || '...'}`
    case 'remove_tag': return `Remover: ${(data.tag as string) || '...'}`
    case 'ai_agent': return `Limite: ${data.message_limit} msgs`
    case 'delay': return `Aguardar ${data.time} ${data.unit}`
    case 'update_crm': return data.status ? `Status → ${data.status}` : 'Atualizar dados do lead'
    case 'human_transfer': return data.department ? `Dept: ${data.department}` : 'Transferir para humano'
    case 'webhook': return (data.url as string) || 'Configurar URL'
    case 'end': return (data.final_message as string) || 'Fim do fluxo'
    default: return ''
  }
}

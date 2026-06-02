export interface Cliente {
  id: number
  created_at: string
  nome: string
  telefone: string
  cidade: string
  foto?: string | null
  kanban_secao_id?: number | null
  origem_app?: string | null
  origem_url?: string | null
  status_atual?: string | null
  dt_ultima_mensagem?: string | null
  ia_desabilitada?: boolean | null
  dados_coletados?: Record<string, string> | null
}

export interface MensagemWhatsapp {
  id: number
  cliente_id?: number
  mensagem: string
  quem_mandou: string
  status: string
  lote_id: string | number | null
  numero_cliente: string
  data_criacao: string
  media_url?: string | null
  media_type?: string | null
}

export interface ClienteComUltimaMensagem extends Cliente {
  ultima_mensagem?: MensagemWhatsapp | null
}

export interface KanbanSecao {
  id: number
  nome: string
  ordem: number
  created_at: string
  facebook_evento?: string | null
  cor?: string | null
}

export interface TreinamentoPrompt {
  id: number
  conteudo: string
  updated_at: string
}

export interface TreinamentoQA {
  id: number
  pergunta: string
  resposta: string
  created_at: string
}

export interface TreinamentoTexto {
  id: number
  titulo: string
  conteudo: string
  created_at: string
}

export interface BaseConhecimento {
  id: number
  conteudo: string
  gerado_em: string
  tokens_prompt: number | null
  tokens_resposta: number | null
  tokens_total: number | null
}

export interface GruposRotator {
  id: string
  nome: string
  slug: string
  criado_em: string
}

export interface GruposLink {
  id: string
  rotator_id: string
  nome: string | null
  url: string
  whatsapp_group_id: string | null
  contador_acessos: number
  participantes: number
  ativo: boolean
  criado_em: string
}

export interface GruposRotatorComLinks extends GruposRotator {
  links: GruposLink[]
}

export interface GrupoDisponivel {
  jid: string
  nome: string
  participantes: number | null
  isAdmin: boolean
  jaAdicionado: boolean
}

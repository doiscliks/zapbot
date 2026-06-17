export interface ClienteHistoricoItem {
  data: string
  texto: string
}

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
  user_id?: string | null
  assigned_user_id?: string | null
  email?: string | null
  endereco?: string | null
  numero_endereco?: string | null
  complemento?: string | null
  bairro?: string | null
  cep?: string | null
  cpf_cnpj?: string | null
  empresa?: string | null
  cargo?: string | null
  notas?: string | null
  data_nascimento?: string | null
  updated_at?: string | null
  historico?: ClienteHistoricoItem[] | null
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
  assigned_user?: { id: string; nome: string } | null
  nao_lido?: boolean
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

export interface Usuario {
  id: string
  nome: string
  email: string
  telefone: string | null
  permissoes: string[] | null
  ativo: boolean
  usado_em: string | null
  is_attendant?: boolean
}

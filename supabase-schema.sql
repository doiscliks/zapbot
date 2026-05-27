-- ============================================================
-- Zap.Ai — Schema completo do banco Supabase
-- Execute no SQL Editor do novo projeto Supabase
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- configuracoes
-- ------------------------------------------------------------
create table configuracoes (
  chave  text primary key,
  valor  text not null default ''
);

insert into configuracoes (chave, valor) values
  ('uazapi_url',          ''),
  ('uazapi_token',        ''),
  ('openai_key',          ''),
  ('fb_pixel_id',         ''),
  ('fb_access_token',     ''),
  ('fb_test_event_code',  ''),
  ('fb_ads_token',        ''),
  ('fb_ad_account_id',    ''),
  ('instancias_permitidas', '1');

-- ------------------------------------------------------------
-- instancias_whatsapp
-- ------------------------------------------------------------
create table instancias_whatsapp (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  token      text not null,
  status     text not null default 'desconectado',
  telefone   text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- clientes
-- ------------------------------------------------------------
create table clientes (
  id                  bigserial primary key,
  nome                text,
  telefone            text,
  status_atual        text,
  instancia_id        text,
  dt_ultima_mensagem  timestamptz,
  cidade              text,
  ia_desabilitada         boolean not null default false,
  historico_sincronizado  boolean not null default false,
  created_at              timestamptz not null default now()
);

create index clientes_telefone_idx       on clientes (telefone);
create index clientes_status_atual_idx   on clientes (status_atual);
create index clientes_dt_ultima_msg_idx  on clientes (dt_ultima_mensagem);

-- ------------------------------------------------------------
-- mensagens_whatsapp
-- ------------------------------------------------------------
create table mensagens_whatsapp (
  id              uuid primary key default gen_random_uuid(),
  numero_cliente  text not null,
  mensagem        text not null,
  quem_mandou     text not null,   -- 'cliente' | 'agente' | 'manual'
  status          text,
  message_id      text,
  data_criacao    timestamptz,
  created_at      timestamptz not null default now()
);

create unique index mensagens_message_id_idx on mensagens_whatsapp (message_id) where message_id is not null;

create index mensagens_numero_cliente_idx on mensagens_whatsapp (numero_cliente);
create index mensagens_created_at_idx     on mensagens_whatsapp (created_at desc);

-- ------------------------------------------------------------
-- treinamento_prompt
-- ------------------------------------------------------------
create table treinamento_prompt (
  id         uuid primary key default gen_random_uuid(),
  conteudo   text not null default '',
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- treinamento_qa
-- ------------------------------------------------------------
create table treinamento_qa (
  id         uuid primary key default gen_random_uuid(),
  pergunta   text not null,
  resposta   text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- treinamento_textos
-- ------------------------------------------------------------
create table treinamento_textos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  conteudo   text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- base_conhecimento
-- ------------------------------------------------------------
create table base_conhecimento (
  id               uuid primary key default gen_random_uuid(),
  conteudo         text not null,
  tokens_prompt    integer,
  tokens_resposta  integer,
  tokens_total     integer,
  gerado_em        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- campanhas_disparo
-- ------------------------------------------------------------
create table campanhas_disparo (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  mensagem   text not null,
  total      integer not null default 0,
  status     text not null default 'a_enviar',  -- 'a_enviar' | 'enviado' | 'erro'
  enviados   integer,
  erros      integer,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- disparo_contatos
-- ------------------------------------------------------------
create table disparo_contatos (
  id           uuid primary key default gen_random_uuid(),
  campanha_id  uuid not null references campanhas_disparo (id) on delete cascade,
  nome         text,
  telefone     text not null,
  status       text not null default 'a_enviar',  -- 'a_enviar' | 'enviado' | 'erro'
  erro         text,
  created_at   timestamptz not null default now()
);

create index disparo_contatos_campanha_idx on disparo_contatos (campanha_id);
create index disparo_contatos_status_idx   on disparo_contatos (status);

-- ------------------------------------------------------------
-- remarketing_regras
-- ------------------------------------------------------------
create table remarketing_regras (
  id                  uuid primary key default gen_random_uuid(),
  status_alvo         text not null,
  tempo_horas         integer not null default 24,
  mensagem            text not null,
  ativo               boolean not null default true,
  limite              integer,
  intervalo_segundos  integer not null default 3,
  hora_inicio         text,   -- formato HH:mm
  hora_fim            text,   -- formato HH:mm
  max_repeticoes      integer not null default 1,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- remarketing_logs
-- ------------------------------------------------------------
create table remarketing_logs (
  id          uuid primary key default gen_random_uuid(),
  regra_id    uuid not null references remarketing_regras (id) on delete cascade,
  telefone    text not null,
  variacao    integer,
  http_status integer,
  erro        text,
  enviado_em  timestamptz not null default now()
);

create index remarketing_logs_regra_idx    on remarketing_logs (regra_id);
create index remarketing_logs_telefone_idx on remarketing_logs (telefone);

-- ------------------------------------------------------------
-- grupos_links
-- ------------------------------------------------------------
create table grupos_links (
  id                 uuid primary key default gen_random_uuid(),
  rotator_id         uuid not null,
  url                text not null,
  whatsapp_group_id  text,
  ativo              boolean not null default true,
  participantes      integer,
  created_at         timestamptz not null default now()
);

create index grupos_links_rotator_idx on grupos_links (rotator_id);

-- ------------------------------------------------------------
-- eventos_funil
-- ------------------------------------------------------------
create table eventos_funil (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  event_name  text not null,   -- Lead | Contact | ViewContent | InitiateCheckout | AddToCart | Purchase
  telefone    text not null,
  valor       numeric not null default 0,
  created_at  timestamptz not null default now()
);

create index eventos_funil_user_idx       on eventos_funil (user_id);
create index eventos_funil_event_idx      on eventos_funil (event_name);
create index eventos_funil_created_at_idx on eventos_funil (created_at desc);

-- ------------------------------------------------------------
-- facebook_eventos_enviados
-- ------------------------------------------------------------
create table facebook_eventos_enviados (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      bigint,
  telefone        text,
  evento          text,
  secao           text,
  events_received integer,
  fbtrace_id      text,
  erro            text,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- kanban_secoes
-- ------------------------------------------------------------
create table if not exists kanban_secoes (
  id              bigserial primary key,
  nome            text not null,
  ordem           integer not null default 0,
  facebook_evento text,
  cor             text,
  user_id         text,
  created_at      timestamptz not null default now()
);

create index if not exists kanban_secoes_user_idx on kanban_secoes (user_id);

-- Migração (se a tabela já existe sem a coluna cor):
-- alter table kanban_secoes add column if not exists cor text;

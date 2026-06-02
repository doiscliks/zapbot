-- ============================================================
-- Migração: Coleta de dados do cliente via IA
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- ============================================================

-- 1. Tabela de configuração dos campos a coletar (por usuário/tenant)
create table if not exists coleta_dados_config (
  user_id    uuid primary key,
  ativo      boolean not null default false,
  -- campos: [{ "chave": "email", "label": "E-mail", "descricao": "e-mail do cliente" }]
  campos     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Coluna flexível para guardar os valores coletados de cada cliente
--    Ex.: { "nome": "João", "email": "joao@x.com", "empresa": "ACME" }
alter table clientes
  add column if not exists dados_coletados jsonb not null default '{}'::jsonb;

-- 3. Controle de acesso é feito na aplicação (filtro por user_id via chave anônima),
--    igual às demais tabelas do sistema. Desativa o RLS para permitir as gravações.
alter table coleta_dados_config disable row level security;

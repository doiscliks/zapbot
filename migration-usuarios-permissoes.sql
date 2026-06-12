-- ============================================================
-- Migração: sub-usuários com permissões por tela
-- Rode UMA VEZ no SQL Editor do Supabase ANTES do deploy.
-- Idempotente (if not exists).
--
-- parent_id  nulo  = conta de topo (admin, acesso total)
-- parent_id  setado = sub-usuário vinculado àquela conta (workspace)
-- permissoes nulo  = acesso total; array de keys = telas permitidas
-- ============================================================

alter table usuarios
  add column if not exists parent_id  uuid,
  add column if not exists telefone   text,
  add column if not exists permissoes jsonb;

create index if not exists usuarios_parent_idx on usuarios (parent_id);

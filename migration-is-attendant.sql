-- ============================================================
-- Migração: is_attendant para usuários e assigned_user_id para clientes
-- Rode UMA VEZ no SQL Editor do Supabase ANTES do deploy.
-- Idempotente (if not exists).
--
-- is_attendant: marca um sub-usuário como atendente para distribuição automática de conversas
-- assigned_user_id: referência ao atendente responsável por cada conversa
-- ============================================================

-- 1. Adiciona campo is_attendant em usuarios (apenas sub-usuários podem ser atendentes)
alter table usuarios
  add column if not exists is_attendant boolean not null default false;

create index if not exists usuarios_is_attendant_idx on usuarios (is_attendant) where is_attendant = true;

-- 2. Adiciona assigned_user_id em clientes (null = sem atendente ainda)
--    Referencia para o usuário responsável pela conversa
alter table clientes
  add column if not exists assigned_user_id uuid;

create index if not exists clientes_assigned_user_id_idx on clientes (assigned_user_id);
create index if not exists clientes_user_id_assigned_idx on clientes (user_id, assigned_user_id);

-- 3. Garante que user_id existe em clientes (se não existir, adiciona)
alter table clientes
  add column if not exists user_id uuid;

create index if not exists clientes_user_id_idx on clientes (user_id);

-- 4. Garante que user_id existe em mensagens_whatsapp (se não existir, adiciona)
alter table mensagens_whatsapp
  add column if not exists user_id uuid;

create index if not exists mensagens_whatsapp_user_id_idx on mensagens_whatsapp (user_id);
create index if not exists mensagens_whatsapp_user_cliente_idx on mensagens_whatsapp (user_id, numero_cliente);

-- Recarrega o cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';

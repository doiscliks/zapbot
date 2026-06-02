-- ============================================================
-- Migração: garantir colunas da tabela configuracoes_usuario
-- A tabela existia incompleta (faltavam colunas fb_*), causando o erro
-- "Could not find the 'fb_access_token' column ... in the schema cache".
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- ============================================================

-- 1. Garante todas as colunas usadas pelo app (idempotente)
alter table configuracoes_usuario
  add column if not exists openai_key         text,
  add column if not exists fb_pixel_id        text,
  add column if not exists fb_access_token    text,
  add column if not exists fb_test_event_code text,
  add column if not exists fb_ads_token       text,
  add column if not exists fb_ad_account_id   text,
  add column if not exists ia_ativa           boolean not null default true,
  add column if not exists updated_at         timestamptz not null default now();

-- 2. Garante a unicidade de user_id (necessária para o upsert onConflict)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'configuracoes_usuario_user_id_key'
  ) then
    alter table configuracoes_usuario
      add constraint configuracoes_usuario_user_id_key unique (user_id);
  end if;
end $$;

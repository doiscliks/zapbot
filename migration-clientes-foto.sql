-- ============================================================
-- Migração: coluna foto na tabela clientes (foto de perfil do WhatsApp)
-- Rode UMA VEZ no SQL Editor do Supabase ANTES de fazer o deploy.
-- Idempotente (if not exists).
-- ============================================================

alter table clientes
  add column if not exists foto text;

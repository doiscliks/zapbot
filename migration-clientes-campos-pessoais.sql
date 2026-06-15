-- ============================================================
-- Migração: campos pessoais para clientes
-- Rode UMA VEZ no SQL Editor do Supabase ANTES do deploy.
-- Idempotente (if not exists).
--
-- Adiciona campos para editar dados pessoais dos clientes:
-- email, endereço, CPF/CNPJ, empresa, etc.
-- ============================================================

alter table clientes
  add column if not exists email text,
  add column if not exists endereco text,
  add column if not exists numero_endereco text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cep text,
  add column if not exists cpf_cnpj text,
  add column if not exists empresa text,
  add column if not exists cargo text,
  add column if not exists notas text,
  add column if not exists data_nascimento date,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clientes_email_idx on clientes (email);
create index if not exists clientes_cpf_cnpj_idx on clientes (cpf_cnpj);

-- Recarrega o cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';

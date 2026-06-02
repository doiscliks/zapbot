-- ============================================================
-- Migração: constraint UNIQUE em mensagens_whatsapp.message_id
--
-- O webhook salva as mensagens RECEBIDAS do cliente com
--   .upsert({...}, { onConflict: 'message_id', ignoreDuplicates: true })
-- que exige uma constraint UNIQUE em message_id. Sem ela, o upsert
-- falhava silenciosamente e as mensagens do cliente NUNCA eram salvas —
-- a IA via só as próprias falas e respondia "você não respondeu".
--
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- ============================================================

-- 1. Remove eventuais duplicatas de message_id (mantém a linha mais antiga)
delete from mensagens_whatsapp a
using mensagens_whatsapp b
where a.message_id is not null
  and a.message_id = b.message_id
  and a.id > b.id;

-- 2. Cria a constraint UNIQUE que o upsert do webhook espera
--    (nulos são permitidos e tratados como distintos no Postgres)
alter table mensagens_whatsapp
  add constraint mensagens_whatsapp_message_id_key unique (message_id);

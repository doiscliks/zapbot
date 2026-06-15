-- Adiciona campo de histórico (JSON array) à tabela clientes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'::jsonb;

-- Cria índice para melhor performance em queries
CREATE INDEX IF NOT EXISTS idx_clientes_historico ON clientes USING GIN (historico);

-- QUERY 1: Todos os usuários com parent_id (atendentes)
SELECT id, nome, email, parent_id, is_attendant FROM usuarios WHERE parent_id IS NOT NULL ORDER BY nome;

-- QUERY 2: Agenda config da Priscila
SELECT slug, user_id, titulo FROM agenda_config WHERE slug = 'priscila.2cliks';

-- QUERY 3: Todos os slugs e seus user_ids
SELECT slug, user_id FROM agenda_config ORDER BY slug;

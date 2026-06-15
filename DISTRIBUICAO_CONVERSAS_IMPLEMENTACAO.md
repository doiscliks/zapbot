# 📋 Implementação: Distribuição Automática de Conversas

## 🎯 Objetivo
Implementar distribuição automática de conversas de WhatsApp para atendentes, com permissões de acesso e proteção no backend.

---

## 📁 Arquivos Alterados

### **1. Database & Migrations**
- **`migration-is-attendant.sql`** (NOVO)
  - Adiciona campo `is_attendant` em `usuarios` (boolean, default false)
  - Adiciona campo `assigned_user_id` em `clientes` (uuid, nullable)
  - Adiciona campo `user_id` em `clientes` e `mensagens_whatsapp` (se não existir)
  - Cria índices para otimizar queries

### **2. Tipos TypeScript**
- **`types/index.ts`** (MODIFICADO)
  - `Usuario`: Adiciona campo `is_attendant?: boolean`
  - `Cliente`: Adiciona campos `user_id?: string | null` e `assigned_user_id?: string | null`
  - `ClienteComUltimaMensagem`: Adiciona campo `assigned_user?: { id: string; nome: string } | null`

### **3. Lógica de Distribuição**
- **`lib/attendant-distribution.ts`** (NOVO)
  - `buscarAtendentesAtivos()`: Busca atendentes ativos de um workspace
  - `distribuirAtendente()`: Implementa round-robin para seleção de atendente
  - `atribuirClienteAAtendente()`: Atribui uma conversa a um atendente

### **4. Webhook**
- **`app/api/webhook/whatsapp/route.ts`** (MODIFICADO)
  - Importa `atribuirClienteAAtendente`
  - Adiciona lógica de distribuição após criar novo cliente (seção 1a)
  - Seleciona o campo `assigned_user_id` nas queries
  - Loga quando conversa é atribuída

### **5. Backend - Segurança & Filtros**
- **`app/api/mensagens/clientes/route.ts`** (MODIFICADO)
  - Verifica se usuário é admin (parent_id nulo) ou atendente
  - Se atendente: retorna apenas conversas onde `assigned_user_id = user_id`
  - Se admin: retorna todas as conversas
  - Faz JOIN com tabela `usuarios` para trazer nome do atendente

- **`app/api/mensagens/chat/route.ts`** (MODIFICADO)
  - Verifica permissão antes de retornar mensagens
  - Se atendente: valida se conversa foi atribuída a ele
  - Retorna 403 se sem permissão

- **`app/api/send-message/route.ts`** (MODIFICADO)
  - Verifica permissão antes de enviar mensagem
  - Se atendente: valida se conversa foi atribuída a ele
  - Retorna 403 se sem permissão

- **`app/api/usuarios/route.ts`** (MODIFICADO)
  - GET: Retorna campo `is_attendant` na listagem
  - POST: Suporta campo `is_attendant` na criação

- **`app/api/usuarios/[id]/route.ts`** (MODIFICADO)
  - PATCH: Suporta atualização de `is_attendant`
  - Retorna campo `is_attendant` na resposta

### **6. Frontend - Usuários**
- **`app/(app)/usuarios/page.tsx`** (MODIFICADO)
  - Estado do formulário inclui `is_attendant: boolean`
  - Adiciona toggle "É atendente?" no formulário de criação
  - Exibe badge "Atendente" ao lado do nome do usuário
  - Permite editar `is_attendant` ao clicar em "Permissões"
  - Salva campo ao atualizar usuário

### **7. Frontend - Mensagens**
- **`components/ListaClientes.tsx`** (MODIFICADO)
  - Exibe nome do atendente responsável abaixo do telefone
  - Filtragem de conversas já acontece no backend (transparente)

---

## 🚀 Como Testar

### **Pré-requisitos**
1. Execute a migration no Supabase:
   ```sql
   -- Copie o conteúdo de migration-is-attendant.sql
   -- Vá em SQL Editor do Supabase
   -- Cole o código e execute
   ```

2. Faça deploy das alterações no código

### **Teste 1: Criar Atendentes**
1. Acesse **Configurações > Usuários**
2. Clique em **"Novo usuário"**
3. Preencha:
   - Nome: "João Atendente"
   - Email: "joao@example.com"
   - Senha: alguma senha
   - Telefone: (opcional)
   - ✅ Marque **"É atendente?"**
4. Clique em **"Criar usuário"**
5. Verifique que aparece o badge **"Atendente"** ao lado do nome

### **Teste 2: Distribuição Automática**
1. Crie 2-3 atendentes (repetir Teste 1)
2. Acesse **Mensagens**
3. Espere por uma nova mensagem de WhatsApp (ou envie uma manualmente para o número)
4. Observe que:
   - A conversa aparece na lista
   - O nome do atendente aparece abaixo do telefone (ex: "👤 João Atendente")
   - Verifique os logs no console do servidor: `[Distribuição] Conversa atribuída automaticamente...`

### **Teste 3: Filtragem por Atendente**
1. Faça login com conta de atendente (uma que você marcou "É atendente?")
2. Acesse **Mensagens**
3. Verifique que:
   - Aparecem apenas conversas atribuídas a esse atendente
   - Não aparecem conversas de outros atendentes
4. Tente acessar via URL uma conversa que não é sua:
   - URL: `...?telefone=5511987654321`
   - Deve retornar erro 403 ou conversa vazia

### **Teste 4: Admin Vê Tudo**
1. Faça login com conta admin (a que criou os atendentes)
2. Acesse **Mensagens**
3. Verifique que aparece todas as conversas (de qualquer atendente)
4. Todos os nomes dos atendentes aparecem nas conversas

### **Teste 5: Round-Robin**
1. Crie 2 atendentes: "João" e "Maria"
2. Receba 3 mensagens de clientes diferentes:
   - 1ª mensagem → Atribuída a "João"
   - 2ª mensagem → Atribuída a "Maria"
   - 3ª mensagem → Atribuída a "João" (volta ao primeiro)
3. Verifique a distribuição via logs ou consultando o banco

### **Teste 6: Conversas Antigas (Sem Atendente)**
1. Mensagens/conversas criadas ANTES da implementação não têm `assigned_user_id`
2. Quando um cliente antigo enviar mensagem:
   - Se não tem `assigned_user_id` ainda → será atribuído automaticamente a um atendente
   - Se já tem → mantém o mesmo atendente
3. Verifique no banco: `select id, telefone, assigned_user_id from clientes;`

---

## 🔐 Segurança Implementada

✅ **Backend:**
- Atendentes só veem conversas atribuídas a eles
- Proteção em `/api/mensagens/clientes` (GET)
- Proteção em `/api/mensagens/chat` (GET)
- Proteção em `/api/send-message` (POST)

✅ **Permissões:**
- `parent_id` nulo = Admin (vê tudo)
- `parent_id` setado + `is_attendant` = Atendente (vê só suas conversas)
- `parent_id` setado + `is_attendant = false` = Operacional (vê o que admin permite via permissões)

✅ **Distribuição:**
- Round-robin baseado no último `assigned_user_id` usado
- Apenas atendentes ativos (`ativo = true` e `is_attendant = true`)
- Log de cada atribuição

---

## 📝 Log de Distribuição

Quando uma conversa é atribuída, o console do servidor mostra:

```
[Distribuição] Conversa atribuída automaticamente ao atendente: João Atendente (uuid-do-joao) | Cliente: Cliente XYZ (5511987654321)
```

---

## 🐛 Troubleshooting

### **Problema: Atendente não recebe conversas**
- Verifique se `is_attendant = true` no banco
- Verifique se `ativo = true` no banco
- Veja os logs do webhook

### **Problema: Conversa não aparece para ninguém**
- Verifique o campo `assigned_user_id` no banco
- Se NULL: a distribuição automática pode ter falhado (veja logs)
- Se setado: verifique se `user_id` da conversa está correto

### **Problema: Admin não vê conversas**
- Verifique que `parent_id` do usuário é NULL
- Se não for, não é admin

### **Problema: Mensagens antigas não são distribuídas**
- Conversas antigas (sem `assigned_user_id`) só recebem atendente quando nova mensagem chega
- Isso acontece automaticamente no webhook

---

## 📊 Queries Úteis

### Ver all conversas e seus atendentes:
```sql
select c.id, c.nome, c.telefone, c.assigned_user_id, u.nome as atendente_nome
from clientes c
left join usuarios u on c.assigned_user_id = u.id
order by c.dt_ultima_mensagem desc;
```

### Ver atendentes de um workspace:
```sql
select id, nome, is_attendant, ativo
from usuarios
where parent_id = 'workspace-admin-uuid'
  and is_attendant = true
  and ativo = true;
```

### Ver conversas sem atendente:
```sql
select id, telefone, dt_ultima_mensagem
from clientes
where assigned_user_id is null
  and dt_ultima_mensagem is not null;
```

---

## ✅ Checklist Pré-Produção

- [ ] Migration foi executada no Supabase
- [ ] Deploy do código foi feito
- [ ] Teste 1: Criar atendente + badge "Atendente" aparece
- [ ] Teste 2: Nova conversa recebe atendente automaticamente
- [ ] Teste 3: Atendente vê apenas suas conversas
- [ ] Teste 4: Admin vê todas as conversas
- [ ] Teste 5: Round-robin distribui corretamente
- [ ] Teste 6: Conversas antigas recebem atendente quando nova msg chega
- [ ] Logs aparecem no console do servidor

---

## 🎁 Próximas Melhorias (Futuros)

- [ ] Transferência manual de conversa entre atendentes
- [ ] Dashboard com estatísticas de distribuição
- [ ] Balanceamento baseado em carga (conversas por atendente)
- [ ] Grupos de atendentes (filas)
- [ ] Permissão granular: "ver conversas de grupo X"


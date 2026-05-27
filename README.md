# SaaSWPP

Sistema SaaS com mensagens estilo WhatsApp Business.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Supabase

## Como rodar

### 1. Configurar variáveis de ambiente

Abra `.env.local` e preencha com suas credenciais do Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

> Encontre essas chaves em: Supabase Dashboard → Project Settings → API

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Estrutura de pastas

```
app/
  (app)/
    dashboard/      → Tela de métricas
    mensagens/      → Chat estilo WhatsApp
  login/            → Tela de login
components/
  Sidebar.tsx       → Menu lateral
  AuthGuard.tsx     → Proteção de rotas (client-side)
  ListaClientes.tsx → Lista de conversas
  ChatMensagens.tsx → Área do chat
lib/
  supabase.ts       → Cliente Supabase
services/
  clientesService.ts    → Queries de clientes
  mensagensService.ts   → Queries de mensagens
types/
  index.ts          → Interfaces TypeScript
proxy.ts            → Proteção de rotas (server-side)
```

## Banco de dados (Supabase)

### clientes
| Coluna | Tipo |
|--------|------|
| id | bigint (PK) |
| created_at | timestamp |
| nome | text |
| telefone | text |
| cidade | text |

### mensagens_whatsapp
| Coluna | Tipo |
|--------|------|
| id | bigint (PK) |
| cliente_id | bigint (FK → clientes.id) |
| mensagem | text |
| quem_mandou | text |
| status | text |
| lote_id | text |
| numero_cliente | text |
| created_at | timestamp |
| data_criacao | timestamp |

## Rotas

| Rota | Descrição |
|------|-----------|
| `/login` | Tela de login |
| `/dashboard` | Métricas e total de clientes |
| `/mensagens` | Chat estilo WhatsApp |

// Constantes e helpers PUROS das telas do app (sem dependências pesadas).
// Seguro para importar no middleware (edge), Sidebar, tela de Usuários, etc.

export const SCREENS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'remarketing', label: 'Remarketing' },
  { key: 'fluxos', label: 'Fluxos' },
  { key: 'disparos', label: 'Disparos' },
  { key: 'funil', label: 'Funil' },
  { key: 'ads', label: 'Ads' },
  { key: 'treinamento', label: 'Treinamento' },
  { key: 'conexao', label: 'Conexão' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'configuracoes', label: 'Configurações' },
] as const

export type ScreenKey = (typeof SCREENS)[number]['key']

export const SCREEN_KEYS: string[] = SCREENS.map((s) => s.key)

// Deriva a key da tela a partir do pathname (ex.: /kanban/123 -> kanban).
export function screenKeyFromPath(pathname: string): string {
  return pathname.replace(/^\/+/, '').split('/')[0] || ''
}

// `"*"` (ou permissoes nulo) = acesso total.
export function permissoesPermiteAcessoTotal(permissoes: unknown): boolean {
  if (!permissoes) return true
  if (Array.isArray(permissoes)) return permissoes.includes('*')
  return permissoes === '*'
}

export function podeAcessar(permissoes: unknown, key: string): boolean {
  if (permissoesPermiteAcessoTotal(permissoes)) return true
  return Array.isArray(permissoes) && permissoes.includes(key)
}

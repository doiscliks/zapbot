import { NextRequest, NextResponse } from 'next/server'
import { SCREEN_KEYS, screenKeyFromPath, podeAcessar } from '@/lib/screens'

const PUBLIC_PATHS = ['/login', '/setup/login', '/g/', '/agendar', '/booking']
const MASTER_PATHS = ['/setup']
const API_PUBLIC_PREFIXES = ['/api/tenant/', '/api/master-login', '/api/webhook/']
const ADMIN_ONLY_SCREENS = ['configuracoes']
// /api/tenant/ já cobre sincronizar, ativar-chave, me, login, logout, entrar

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Public API endpoints
  if (API_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // All other API routes pass through (they handle auth themselves)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Public pages
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // /setup/* — requires master session
  if (MASTER_PATHS.some((p) => pathname.startsWith(p))) {
    if (!request.cookies.get('master_session')?.value) {
      return NextResponse.redirect(new URL('/setup/login', request.url))
    }
    return NextResponse.next()
  }

  // App routes — require tenant session
  if (!request.cookies.get('tenant_session')?.value) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const permCookie = request.cookies.get('permissoes')?.value
  let permissoes: unknown = '*'
  try { permissoes = permCookie ? JSON.parse(permCookie) : '*' } catch { permissoes = '*' }

  // 'configuracoes' é exclusiva do admin, mesmo que a tela esteja marcada nas permissões do sub-usuário.
  const key = screenKeyFromPath(pathname)
  if (ADMIN_ONLY_SCREENS.includes(key) && permissoes !== '*') {
    return NextResponse.redirect(new URL('/mensagens', request.url))
  }

  // Permissões por tela: bloqueia acesso direto por URL a telas não permitidas.
  // Só aplica a telas conhecidas; sessões antigas (sem cookie permissoes) = libera tudo.
  if (permCookie && SCREEN_KEYS.includes(key) && !podeAcessar(permissoes, key)) {
    const primeira = Array.isArray(permissoes) && permissoes.length > 0 ? permissoes[0] : 'mensagens'
    return NextResponse.redirect(new URL(`/${primeira}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

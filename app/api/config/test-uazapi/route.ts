import { NextRequest, NextResponse } from 'next/server'
import { readConfig } from '@/lib/config-server'
import { isMasterAuth } from '@/lib/master-auth'

function getBase(uazapiUrl: string) {
  return uazapiUrl?.replace(/\/+$/, '').replace(/\/send\/.*$/, '') || ''
}

export async function GET(request: NextRequest) {
  if (!isMasterAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readConfig()
  const base = getBase(config.uazapiUrl)
  const token = config.uazapiToken

  if (!base) return NextResponse.json({ ok: false, error: 'URL não configurada' })
  if (!token) return NextResponse.json({ ok: false, error: 'Token não configurado' })

  const endpoints = ['/instance/list', '/instance/fetchInstances', '/instances']

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${base}${endpoint}`, { headers: { token } })
      if (res.status === 401) {
        return NextResponse.json({ ok: false, status: 401, error: 'Token inválido (401 Unauthorized)', base })
      }
      // Qualquer resposta que não seja 401 = servidor acessível e token aceito
      return NextResponse.json({ ok: true, base })
    } catch {
      // endpoint não existe, tenta o próximo
    }
  }

  // Nenhum endpoint respondeu — tenta só o base URL
  try {
    const res = await fetch(base, { headers: { token } })
    if (res.status === 401) {
      return NextResponse.json({ ok: false, status: 401, error: 'Token inválido (401 Unauthorized)', base })
    }
    return NextResponse.json({ ok: true, base })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), base })
  }
}

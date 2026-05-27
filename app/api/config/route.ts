import { NextRequest, NextResponse } from 'next/server'
import { readConfig, writeConfig } from '@/lib/config-server'
import { isMasterAuth } from '@/lib/master-auth'

export const MASKED = '••••••••••••••••••••••'

export async function GET() {
  const config = await readConfig()
  return NextResponse.json({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    uazapiUrl: config.uazapiUrl,
    hasUazapiToken: !!config.uazapiToken,
    hasOpenaiKey: !!config.openaiKey,
    fbPixelId: config.fbPixelId,
    hasFbAccessToken: !!config.fbAccessToken,
    fbTestEventCode: config.fbTestEventCode,
    hasFbAdsToken: !!config.fbAdsToken,
    fbAdAccountId: config.fbAdAccountId,
    instanciasPermitidas: config.instanciasPermitidas,
    configured: !!(config.supabaseUrl && config.supabaseAnonKey),
  })
}

function resolveSecret(incoming: string | undefined, current: string): string {
  const val = incoming?.trim() ?? ''
  if (!val || val === MASKED) return current
  return val
}

export async function POST(request: NextRequest) {
  if (!isMasterAuth(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const current = await readConfig()

  try {
    await writeConfig({
      supabaseUrl: body.supabaseUrl?.trim() || '',
      supabaseAnonKey: body.supabaseAnonKey?.trim() || '',
      uazapiUrl: body.uazapiUrl?.trim() || '',
      uazapiToken: resolveSecret(body.uazapiToken, current.uazapiToken),
      openaiKey: resolveSecret(body.openaiKey, current.openaiKey),
      fbPixelId: body.fbPixelId?.trim() || '',
      fbAccessToken: resolveSecret(body.fbAccessToken, current.fbAccessToken),
      fbTestEventCode: body.fbTestEventCode?.trim() || '',
      fbAdsToken: resolveSecret(body.fbAdsToken, current.fbAdsToken),
      fbAdAccountId: body.fbAdAccountId?.trim() || '',
      instanciasPermitidas: body.instanciasPermitidas?.toString()?.trim() || '1',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

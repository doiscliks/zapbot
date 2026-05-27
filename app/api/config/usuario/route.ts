import { NextRequest, NextResponse } from 'next/server'
import { getTenantId } from '@/lib/tenant-auth'
import { readTenantConfig, writeTenantConfig } from '@/lib/tenant-config'

const MASKED = '••••••••••••••••••••••'

function mask(val: string): string {
  return val ? MASKED : ''
}

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await readTenantConfig(userId)

  return NextResponse.json({
    hasOpenaiKey: !!config.openaiKey,
    fbPixelId: config.fbPixelId,
    hasFbAccessToken: !!config.fbAccessToken,
    fbTestEventCode: config.fbTestEventCode,
    hasFbAdsToken: !!config.fbAdsToken,
    fbAdAccountId: config.fbAdAccountId,
    iaAtiva: config.iaAtiva,
    // masked versions for display
    openaiKey: mask(config.openaiKey),
    fbAccessToken: mask(config.fbAccessToken),
    fbAdsToken: mask(config.fbAdsToken),
  })
}

export async function POST(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const current = await readTenantConfig(userId)

  function resolve(incoming: string | undefined, current: string): string {
    const val = incoming?.trim() ?? ''
    if (!val || val === MASKED) return current
    return val
  }

  await writeTenantConfig(userId, {
    openaiKey: resolve(body.openaiKey, current.openaiKey),
    fbPixelId: body.fbPixelId?.trim() ?? current.fbPixelId,
    fbAccessToken: resolve(body.fbAccessToken, current.fbAccessToken),
    fbTestEventCode: body.fbTestEventCode?.trim() ?? current.fbTestEventCode,
    fbAdsToken: resolve(body.fbAdsToken, current.fbAdsToken),
    fbAdAccountId: body.fbAdAccountId?.trim() ?? current.fbAdAccountId,
    ...(typeof body.iaAtiva === 'boolean' ? { iaAtiva: body.iaAtiva } : {}),
  })

  return NextResponse.json({ ok: true })
}

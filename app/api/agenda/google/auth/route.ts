import { NextRequest, NextResponse } from 'next/server'
import { getTenantId } from '@/lib/tenant-auth'

export async function GET(request: NextRequest) {
  const userId = getTenantId(request)
  if (!userId) return NextResponse.redirect(new URL('/login', request.url))

  const clientId = process.env.GOOGLE_CLIENT_ID
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host') || 'zapbot-orcin.vercel.app'
  const appUrl = `${protocol}://${host}`
  const redirectUri = `${appUrl}/api/agenda/google/callback`

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}

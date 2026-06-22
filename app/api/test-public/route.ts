import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Esta é uma rota pública - sem login necessário!' })
}

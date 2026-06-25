import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import RegisterSW from '@/components/RegisterSW'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: '2Cliks Contabilidade',
  description: 'Plataforma de atendimento inteligente — 2Cliks Contabilidade Digital',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '2Cliks',
  },
  icons: {
    icon: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12C6D6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${poppins.className} h-full antialiased`} style={{ backgroundColor: '#F8FAFC' }}>
        <RegisterSW />
        {children}
      </body>
    </html>
  )
}

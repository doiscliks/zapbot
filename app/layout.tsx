import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: '2Cliks Contabilidade',
  description: 'Plataforma de atendimento inteligente — 2Cliks Contabilidade Digital',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${poppins.className} h-full antialiased`} style={{ backgroundColor: '#F8FAFC' }}>
        {children}
      </body>
    </html>
  )
}

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '2Cliks Contabilidade',
    short_name: '2Cliks',
    description: 'Plataforma de atendimento inteligente — 2Cliks Contabilidade Digital',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#12C6D6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

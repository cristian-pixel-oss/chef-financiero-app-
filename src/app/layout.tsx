import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaInit from '@/components/PwaInit'

export const metadata: Metadata = {
  title: 'Chef Financiero',
  description: 'Sistema de control de costos profesional para cocinas de hotel',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chef Financiero',
  },
  icons: {
    icon:    [{ url: '/icons/icon-192.svg', type: 'image/svg+xml' }],
    apple:   [{ url: '/icons/icon-192.svg', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  themeColor:          '#f59e0b',
  width:               'device-width',
  initialScale:        1,
  maximumScale:        1,
  userScalable:        false,
  viewportFit:         'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body>
        {children}
        <PwaInit />
      </body>
    </html>
  )
}

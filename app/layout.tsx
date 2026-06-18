import type { Metadata } from 'next'
import './globals.css'
import { DBProvider } from './providers'

export const metadata: Metadata = {
  title: 'EditorSQL - Práctica PostgreSQL',
  description: 'Práctica de SQL con PostgreSQL en el navegador',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <DBProvider>{children}</DBProvider>
      </body>
    </html>
  )
}

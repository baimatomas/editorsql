import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}

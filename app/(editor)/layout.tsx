import { DBProvider } from '../providers'

// El provider con PGlite (WASM, pesado) solo vive en el editor.
// Las demás secciones (ej. /quiz) tienen sus propios layouts.
export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DBProvider>{children}</DBProvider>
}

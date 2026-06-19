'use client'

import { FilePlus, Save, SaveAll, FolderOpen } from 'lucide-react'
import Button from '@/app/components/ui/Button'

export type PanelKey = 'sidebar' | 'schema' | 'query' | 'results'

const TABS: { key: PanelKey; label: string }[] = [
  { key: 'sidebar', label: 'Tablas' },
  { key: 'schema', label: 'DER' },
  { key: 'query', label: 'Query' },
  { key: 'results', label: 'Resultados' },
]

export default function Header({
  visible,
  onToggle,
  onNewProject,
  onSaveProject,
  onSaveAsProject,
  onOpenProject,
}: {
  visible: Record<PanelKey, boolean>
  onToggle: (key: PanelKey) => void
  onNewProject: () => void
  onSaveProject: () => void
  onSaveAsProject: () => void
  onOpenProject: () => void
}) {
  return (
    <header className="bg-institutional-800 text-white flex-shrink-0 shadow-md z-10">
      <div className="flex items-center px-3 py-1 gap-2">
        {/* Branding */}
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/logo-unr-blanco.png"
            alt="UNR"
            className="w-[90px] h-6 object-contain flex-shrink-0"
          />
          <div className="flex flex-col leading-tight border-l border-white/20 pl-2">
            <span className="text-[10px] font-semibold tracking-wide whitespace-nowrap leading-tight">
              FACULTAD DE CIENCIAS
            </span>
            <span className="text-[10px] font-semibold tracking-wide whitespace-nowrap leading-tight">
              ECONÓMICAS Y ESTADÍSTICA
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col leading-tight border-l border-white/20 pl-2 mr-1">
          <span className="text-sm font-bold whitespace-nowrap leading-tight">
            Entorno de Práctica SQL
          </span>
          <span className="text-[9px] text-white/60 whitespace-nowrap leading-tight">
            Desarrollado por la asignatura Base de Datos
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 ml-auto h-7">
          {TABS.map(({ key, label }) => (
            <Button
              key={key}
              variant={visible[key] ? 'tab-active' : 'tab'}
              onClick={() => onToggle(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-2">
          <Button variant="toolbar" onClick={onNewProject}>
            <FilePlus size={13} />
            Nuevo
          </Button>
          <Button variant="toolbar" onClick={onSaveProject}>
            <Save size={13} />
            Guardar
          </Button>
          <Button variant="toolbar" onClick={onSaveAsProject}>
            <SaveAll size={13} />
            G. Como
          </Button>
          <Button variant="toolbar" onClick={onOpenProject}>
            <FolderOpen size={13} />
            Abrir
          </Button>
        </div>
      </div>
    </header>
  )
}

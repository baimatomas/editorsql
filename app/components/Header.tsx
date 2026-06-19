'use client'

import { FilePlus, Save, SaveAll, FolderOpen, Upload } from 'lucide-react'
import Button from '@/app/components/ui/Button'

type PanelKey = 'sidebar' | 'schema' | 'query' | 'results'

const LABELS: Record<PanelKey, string> = {
  sidebar: 'Tablas',
  schema: 'DER',
  query: 'Query',
  results: 'Resultados',
}

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
      <div className="flex items-center px-4 py-2 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo-unr-blanco.png"
            alt="UNR"
            className="w-[110px] h-7 object-contain flex-shrink-0"
          />
          <div className="flex flex-col leading-tight border-l border-white/20 pl-3">
            <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap">
              FACULTAD DE CIENCIAS
            </span>
            <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap">
              ECONÓMICAS Y ESTADÍSTICA
            </span>
          </div>
        </div>

        <div className="flex flex-col leading-tight border-l border-white/20 pl-3 min-w-0">
          <span className="text-sm font-bold whitespace-nowrap">
            Entorno de Práctica SQL
          </span>
          <span className="text-[10px] text-white/70 whitespace-nowrap">
            Desarrollado por la asignatura Base de Datos
          </span>
        </div>

        <div className="flex items-center gap-1 ml-auto min-w-0">
          <Button variant="ghost" onClick={onNewProject}>
            <FilePlus size={14} />
            Nuevo
          </Button>
          <Button variant="ghost" onClick={onSaveProject}>
            <Save size={14} />
            Guardar
          </Button>
          <Button variant="ghost" onClick={onSaveAsProject}>
            <SaveAll size={14} />
            Guardar Como
          </Button>
          <Button variant="ghost" onClick={onOpenProject}>
            <FolderOpen size={14} />
            Abrir
          </Button>
          <div className="w-px h-4 bg-white/20 mx-1" />
          {(Object.keys(LABELS) as PanelKey[]).map((key) => (
            <Button
              key={key}
              variant={visible[key] ? 'secondary' : 'ghost'}
              onClick={() => onToggle(key)}
            >
              {LABELS[key]}
            </Button>
          ))}
        </div>
      </div>
    </header>
  )
}

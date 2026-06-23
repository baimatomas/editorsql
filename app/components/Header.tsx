'use client'

import { useState, useEffect } from 'react'
import { FilePlus, Save, SaveAll, FolderOpen, Sun, Moon } from 'lucide-react'
import Button from '@/app/components/ui/Button'

export type PanelKey = 'sidebar' | 'schema' | 'query' | 'results' | 'exercises'

const TABS: { key: PanelKey; label: string }[] = [
  { key: 'sidebar', label: 'Tablas' },
  { key: 'schema', label: 'DER' },
  { key: 'query', label: 'Query' },
  { key: 'results', label: 'Resultados' },
  { key: 'exercises', label: 'Ejercicios' },
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('editorsql_theme') as 'dark' | 'light' | null
    const t = stored === 'light' ? 'light' : 'dark'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('editorsql_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

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

        {/* Theme toggle */}
        <div className="flex items-center ml-auto">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all duration-150"
            title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 ml-1 h-7">
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

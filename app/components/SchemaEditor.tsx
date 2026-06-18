'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useDB } from '@/app/providers'

const DEFAULT_SCHEMA = `-- Tabla de estudiantes
CREATE TABLE estudiantes (
    id_estudiante   SERIAL PRIMARY KEY,
    nombre          VARCHAR(50)  NOT NULL,
    apellido        VARCHAR(50)  NOT NULL,
    email           VARCHAR(100),
    cuil            VARCHAR(20),
    ciudad          VARCHAR(50),
    fecha_registro  DATE         NOT NULL
);

INSERT INTO estudiantes (nombre, apellido, email, cuil, ciudad, fecha_registro) VALUES
('Mateo',     'González',  'mateo.gonzalez@email.com',     '20-35421876-4', 'Buenos Aires', '2023-03-15'),
('Valentina', 'Rodríguez', NULL,                           '27-28934521-7', 'Córdoba',      '2023-07-22'),
('Santiago',  'Fernández', 'santiago.fernandez@email.com', '20-41256734-2', 'Rosario',      '2024-01-08'),
('Lucía',     'López',     'lucia.lopez@email.com',        '27-39812345-1', NULL,           '2024-02-14'),
('Rodrigo',   'Torres',    'rodrigo.torres@email.com',     '20-44123678-5', 'Buenos Aires', '2024-10-03'),
('Agustina',  'Herrera',   'agustina.herrera@email.com',   '27-36754321-8', 'Rosario',      '2024-08-17'),
('Facundo',   'Castro',    NULL,                           '20-42987654-3', 'Mendoza',      '2024-07-29'),
('Daniela',   'Medina',    'daniela.medina@email.com',     '27-40123456-6', 'Córdoba',      '2024-06-11'),
('Carla',     'Suárez',    'carla.suarez@email.com',       '27-45678901-2', 'Buenos Aires', '2024-11-20'),
('Ignacio',   'García',    'ignacio.garcia@email.com',     '20-38765432-9', 'Mendoza',      '2023-11-05'),
('Florencia', 'García',    NULL,                           '27-37654321-0', 'Rosario',      '2023-09-18'),
('Tomás',     'Garcé',     'tomas.garce@email.com',        '20-43219876-7', 'Buenos Aires', '2024-05-30'),
('Nicolás',   'Vargas',    'nicolas.vargas@email.com',     '20-41876543-4', 'Córdoba',      '2024-04-18'),
('Camila',    'Ríos',      'camila.rios@email.com',        '27-44321098-1', NULL,           '2024-03-07'),
('Leandro',   'Álvarez',   NULL,                           '20-33167842-9', 'Buenos Aires', '2023-05-30');

-- Tabla de cursos
CREATE TABLE cursos (
    id_curso        SERIAL PRIMARY KEY,
    titulo          VARCHAR(100) NOT NULL,
    categoria       VARCHAR(50)  NOT NULL,
    precio          NUMERIC(10,2),
    duracion_horas  INTEGER
);

INSERT INTO cursos (titulo, categoria, precio, duracion_horas) VALUES
('Introducci\u00f3n a la Estad\u00edstica', 'Estad\u00edstica',      4200.00, 30),
('Estad\u00edstica Inferencial',       'Estad\u00edstica',      6200.00, 60),
('Python para Datos',             'Programaci\u00f3n',     5800.00, 50),
('R para An\u00e1lisis de Datos',      'Programaci\u00f3n',     5200.00, 45),
('SQL desde Cero',                'Bases de Datos',   4800.00, 35),
('Dise\u00f1o de Bases de Datos',      'Bases de Datos',   6500.00, 55),
('Machine Learning Aplicado',     'Machine Learning', 8900.00, 80),
('Redes Neuronales',              'Machine Learning', 9500.00, 90),
('Visualizaci\u00f3n con Tableau',     'Visualizaci\u00f3n',    5000.00, 40),
('SQL desde cero para datos',     'Bases de Datos',   4500.00, 35);`

const LS_SCHEMA = 'editorsql_schema'

export default function SchemaEditor() {
  const [sql, setSql] = useState(DEFAULT_SCHEMA)
  const sqlRef = useRef(sql)
  const { runSchema, schemaError, ready } = useDB()
  const runRef = useRef(runSchema)

  useEffect(() => {
    const stored = localStorage.getItem(LS_SCHEMA)
    if (stored !== null) setSql(stored)
  }, [])

  useEffect(() => { sqlRef.current = sql }, [sql])
  useEffect(() => { runRef.current = runSchema }, [runSchema])
  useEffect(() => { localStorage.setItem(LS_SCHEMA, sql) }, [sql])

  const handleEditorMount: OnMount = useCallback((_editor, monaco) => {
    _editor.addAction({
      id: 'run-schema',
      label: 'Run Schema',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { runRef.current(sqlRef.current) },
    })
  }, [])

  const handleRun = () => { runRef.current(sqlRef.current) }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Schema SQL
        </span>
        <button
          onClick={handleRun}
          disabled={!ready || !sql.trim()}
          className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium"
        >
          Run Schema
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={(val) => setSql(val ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            padding: { top: 6 },
          }}
        />
      </div>
      {schemaError && (
        <div className="px-3 py-1.5 bg-red-900/40 border-t border-red-800 text-red-300 text-xs font-mono flex-shrink-0">
          {schemaError}
        </div>
      )}
    </div>
  )
}

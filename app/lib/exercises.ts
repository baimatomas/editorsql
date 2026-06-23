export interface Exercise {
  id: string
  title: string
  description: string
  hint?: string
  solution: string
}

export interface ExerciseGroup {
  database: string
  label: string
  exercises: Exercise[]
}

export const EXERCISE_GROUPS: ExerciseGroup[] = [
  {
    database: 'northwind',
    label: 'Northwind',
    exercises: [
      {
        id: 'nw-1',
        title: 'Listado completo de categorías',
        description: 'Seleccioná todas las columnas y todas las filas de la tabla "categories".',
        hint: 'Usá SELECT * FROM ...',
        solution: 'SELECT * FROM categories',
      },
      {
        id: 'nw-2',
        title: 'Categorías sin el ID',
        description: 'Seleccioná todas las columnas de la tabla "categories" EXCEPTO "category_id".',
        hint: 'Escribí los nombres de las columnas separados por coma después de SELECT.',
        solution: 'SELECT category_name, description, picture FROM categories',
      },
    ],
  },
  {
    database: 'dvdrental',
    label: 'DVD Rental',
    exercises: [],
  },
]

export function getExercisesForDatabase(db: string): Exercise[] {
  const group = EXERCISE_GROUPS.find(g => g.database === db)
  return group?.exercises ?? []
}

export function hasExercisesForDatabase(db: string): boolean {
  return getExercisesForDatabase(db).length > 0
}

export interface ExerciseFeedback {
  correct: boolean
  studentColumns: string[]
  expectedColumns: string[]
  studentRows: number
  expectedRows: number
  details: string
}

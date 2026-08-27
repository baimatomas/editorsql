export interface ProjectMeta {
  label: string
}

export interface ProjectEntry {
  name: string
  label: string
}

export const DEFAULT_PROJECTS = ['northwind', 'dvdrental']

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

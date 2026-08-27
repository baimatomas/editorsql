export function blobUrl(pathname: string): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? ''
  const match = token.match(/^vercel_blob_rw_([a-z0-9]+)_/i)
  if (!match) return null
  return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com/${pathname}`
}

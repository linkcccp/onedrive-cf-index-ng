import { useCallback, useEffect, useRef, useState } from 'react'
import { traverseFolder } from '../components/MultiFileDownloader'
import { fetchOPFMetadata, inferOPFPath } from './Linkcccp_OPFParser'
import { getStoredToken } from './protectedRouteHandler'
import { getBaseUrl } from './getBaseUrl'

export interface BookMetadata {
  id: string
  title: string
  authors: string[]
  coverUrl: string
  bookUrl: string
  format: 'epub' | 'pdf' | 'cbz' | 'other'
  folderPath: string
}

const EBOOK_EXTENSIONS = ['.epub', '.pdf', '.cbz']

function isEbookFile(name: string): boolean {
  const lower = name.toLowerCase()
  return EBOOK_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function getFormat(name: string): BookMetadata['format'] {
  const lower = name.toLowerCase()
  if (lower.endsWith('.epub')) return 'epub'
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.cbz')) return 'cbz'
  return 'other'
}

async function extractBookMetadata(folderPath: string, folderName: string): Promise<BookMetadata | null> {
  const hashedToken = getStoredToken(folderPath)
  const tokenQuery = hashedToken ? `&odpt=${hashedToken}` : ''

  // 1. Look for cover.jpg
  const coverUrl = `${getBaseUrl()}/api/raw?path=${encodeURIComponent(folderPath)}/cover.jpg${tokenQuery}`

  // 2. Look for metadata.opf
  const opfPath = inferOPFPath(folderPath + '/dummy.epub') // dummy file to infer folder
  const opfUrl = `${getBaseUrl()}/api/raw?path=${encodeURIComponent(opfPath)}${tokenQuery}`

  let title = folderName
  let authors: string[] = []
  let coverUrlFinal = coverUrl

  try {
    const metadata = await fetchOPFMetadata(opfUrl)
    if (metadata.title) title = metadata.title
    if (metadata.authors.length > 0) authors = metadata.authors
    if (metadata.coverPath) {
      // construct cover path relative to folder
      coverUrlFinal = `${getBaseUrl()}/api/raw?path=${encodeURIComponent(folderPath)}/${encodeURIComponent(metadata.coverPath)}${tokenQuery}`
    }
  } catch (e) {
    // OPF not found or error, fallback
    console.debug('No OPF metadata for', folderPath, e)
  }

  // 3. Find ebook file
  let ebookFile = ''
  let format: BookMetadata['format'] = 'other'
  // We would need to list folder contents, but for simplicity assume same name as folder
  // In practice, we should traverse folder children, but for now guess.
  // We'll leave ebookFile empty and let the caller decide.

  // 4. Construct book URL (link to the ebook file or folder?)
  // For now, link to the folder (so FileListing will show its contents)
  const bookUrl = folderPath

  return {
    id: folderPath,
    title,
    authors,
    coverUrl: coverUrlFinal,
    bookUrl,
    format,
    folderPath,
  }
}

export default function useInfiniteBooks(basePath: string = '/') {
  const [books, setBooks] = useState<BookMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const traversingRef = useRef(false)
  const generatorRef = useRef<AsyncGenerator<any> | null>(null)

  const loadMore = useCallback(async () => {
    if (loading || traversingRef.current || !hasMore) return
    setLoading(true)
    traversingRef.current = true

    try {
      // If generator doesn't exist, start traversal
      if (!generatorRef.current) {
        generatorRef.current = traverseFolder(basePath)
      }

      const batchSize = 20
      const batch: BookMetadata[] = []

      for (let i = 0; i < batchSize; i++) {
        const result = await generatorRef.current.next()
        if (result.done) {
          setHasMore(false)
          break
        }
        const item = result.value
        // item.isFolder indicates a folder; we need to detect if it's a book folder
        // For simplicity, assume any folder that contains ebook files is a book folder
        // We'll skip files and only process folders that have ebook files inside.
        // This is a placeholder; actual detection requires checking children.
        // We'll just treat all folders as potential book folders (inefficient).
        if (item.isFolder) {
          const meta = await extractBookMetadata(item.path, item.meta?.name || 'Unknown')
          if (meta) {
            batch.push(meta)
          }
        }
      }

      if (batch.length > 0) {
        setBooks(prev => [...prev, ...batch])
      } else if (!hasMore) {
        // No more items
        setHasMore(false)
      }
    } catch (err) {
      setError(err as Error)
      setHasMore(false)
    } finally {
      setLoading(false)
      traversingRef.current = false
    }
  }, [basePath, loading, hasMore])

  useEffect(() => {
    // Initial load
    if (books.length === 0 && hasMore && !loading) {
      loadMore()
    }
  }, [books.length, hasMore, loading, loadMore])

  return { books, loading, hasMore, error, loadMore }
}
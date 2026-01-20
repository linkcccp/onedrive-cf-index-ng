import type { OdFolderChildren } from '../types'
import Link from 'next/link'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen } from '@fortawesome/free-solid-svg-icons'

export interface BookMetadata {
  id: string
  title: string
  authors: string[]
  coverUrl: string
  bookUrl: string
  format: 'epub' | 'pdf' | 'cbz' | 'other'
  folderPath: string
}

interface BookCardProps {
  book: BookMetadata
}

const BookCard: React.FC<BookCardProps> = ({ book }) => {
  const [coverError, setCoverError] = useState(false)

  const handleCoverError = () => {
    setCoverError(true)
  }

  return (
    <Link href={book.bookUrl} passHref>
      <div className="group relative cursor-pointer overflow-hidden rounded-fluent-lg bg-fluent-surface-card shadow-fluent-sm transition-all duration-150 hover:shadow-fluent-md dark:bg-fluent-surface-card">
        {/* Cover image */}
        <div className="aspect-[2/3] overflow-hidden rounded-t-fluent-lg bg-fluent-surface-panel">
          {!coverError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
              src={book.coverUrl}
              alt={`${book.title} cover`}
              onError={handleCoverError}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-fluent-surface-panel text-fluent-text-tertiary">
              <FontAwesomeIcon icon={faBookOpen} className="h-16 w-16" />
            </div>
          )}
        </div>

        {/* Book info */}
        <div className="p-3">
          <h3 className="mb-1 line-clamp-2 h-10 text-sm font-semibold text-fluent-text-primary dark:text-fluent-text-primary">
            {book.title}
          </h3>
          <p className="line-clamp-2 h-8 text-xs text-fluent-text-secondary dark:text-fluent-text-secondary">
            {book.authors.join(', ')}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded-full bg-fluent-brand-primary/10 px-2 py-1 text-xs font-medium text-fluent-brand-primary dark:bg-fluent-brand-primary/20 dark:text-fluent-brand-primary">
              {book.format.toUpperCase()}
            </span>
            <span className="text-xs text-fluent-text-tertiary dark:text-fluent-text-tertiary">
              {/* Optional: series or year */}
            </span>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center rounded-fluent-lg bg-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="rounded-full bg-white/20 p-3 text-white backdrop-blur-sm">
            <FontAwesomeIcon icon={faBookOpen} className="h-6 w-6" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default BookCard
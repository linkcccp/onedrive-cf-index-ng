import { useEffect, useRef, useState } from 'react'
import BookCard, { BookMetadata } from './Linkcccp_BookCard'

interface BookGridProps {
  books: BookMetadata[]
  hasMore: boolean
  loading: boolean
  loadMore: () => Promise<void> | void
}

const BookGrid: React.FC<BookGridProps> = ({ books, hasMore, loading, loadMore }) => {
  const loaderRef = useRef<HTMLDivElement>(null)
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (initialLoad && books.length === 0 && hasMore) {
      loadMore()
      setInitialLoad(false)
    }
  }, [initialLoad, books.length, hasMore, loadMore])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    const currentLoader = loaderRef.current
    if (currentLoader) {
      observer.observe(currentLoader)
    }
    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader)
      }
    }
  }, [hasMore, loading, loadMore])

  return (
    <div className="w-full">
      {books.length === 0 && !loading ? (
        <div className="py-12 text-center text-fluent-text-secondary">
          No books found.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {books.map((book) => (
              <div key={book.id} className="flex justify-center">
                <BookCard book={book} />
              </div>
            ))}
          </div>
          <div ref={loaderRef} className="py-6">
            {loading && (
              <div className="flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-fluent-brand-primary border-t-transparent"></div>
              </div>
            )}
            {!hasMore && books.length > 0 && (
              <div className="text-center text-sm text-fluent-text-tertiary">
                No more books.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default BookGrid
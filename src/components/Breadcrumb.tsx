import type { ParsedUrlQuery } from 'querystring'

import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const HomeCrumb = () => {
  return (
    <Link href="/" className="flex items-center rounded-fluent-md p-2 hover:bg-fluent-surface-panel">
      <FontAwesomeIcon className="h-4 w-4 text-fluent-text-secondary" icon={['far', 'home']} />
      <span className="ml-2 font-medium text-fluent-text-primary">{'Home'}</span>
    </Link>
  )
}

const Breadcrumb: React.FC<{ query?: ParsedUrlQuery }> = ({ query }) => {
  if (query) {
    const { path } = query
    if (Array.isArray(path)) {
      // We are rendering the path in reverse, so that the browser automatically scrolls to the end of the breadcrumb
      // https://stackoverflow.com/questions/18614301/keep-overflow-div-scrolled-to-bottom-unless-user-scrolls-up/18614561
      return (
        <ol className="no-scrollbar inline-flex flex-row-reverse items-center gap-1 overflow-x-scroll text-sm md:gap-2">
          {path
            .slice(0)
            .reverse()
            .map((p: string, i: number) => (
              <li key={i} className="flex flex-shrink-0 items-center">
                <FontAwesomeIcon className="h-3 w-3 text-fluent-text-tertiary" icon="angle-right" />
                <Link
                  href={`/${path
                    .slice(0, path.length - i)
                    .map(p => encodeURIComponent(p))
                    .join('/')}`}
                  passHref
                  className={`ml-1 rounded-fluent-md p-2 transition-all duration-75 hover:bg-fluent-surface-panel md:ml-2 ${
                    i == 0 ? 'pointer-events-none bg-fluent-surface-panel text-fluent-text-primary' : 'text-fluent-text-secondary'
                  }`}
                >
                  {p}
                </Link>
              </li>
            ))}
          <li className="flex-shrink-0">
            <HomeCrumb />
          </li>
        </ol>
      )
    }
  }

  return (
    <div className="text-sm">
      <HomeCrumb />
    </div>
  )
}

export default Breadcrumb

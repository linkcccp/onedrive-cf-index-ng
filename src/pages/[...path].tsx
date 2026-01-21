import Head from 'next/head'
import { useRouter } from 'next/router'

import siteConfig from '../../config/site.config'
import Navbar from '../components/Navbar'
import FileListing from '../components/FileListing'
import Footer from '../components/Footer'
import Breadcrumb from '../components/Breadcrumb'
import SwitchLayout from '../components/SwitchLayout'

export default function Folders() {
  const { query } = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fluent-surface">
      <Head>
        <title>{siteConfig.title}</title>
      </Head>

      <main className="flex w-full flex-1 flex-col bg-fluent-surface-panel">
        <Navbar />
        <div className="mx-auto w-full max-w-full py-6 px-2 sm:px-6">
          <nav className="mb-6 flex items-center justify-between rounded-fluent-lg bg-fluent-surface-card p-4 shadow-fluent-sm">
            <Breadcrumb query={query} />
            <SwitchLayout />
          </nav>
          <div className="rounded-fluent-lg bg-fluent-surface-card shadow-fluent-sm">
            <FileListing query={query} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

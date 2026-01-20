import Head from 'next/head'

import siteConfig from '../../config/site.config'
import Navbar from '../components/Navbar'
import FileListing from '../components/FileListing'
import Footer from '../components/Footer'
import Breadcrumb from '../components/Breadcrumb'
import SwitchLayout from '../components/SwitchLayout'
import Linkcccp_Sidebar from '../components/Linkcccp_Sidebar'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fluent-surface">
      <Head>
        <title>{siteConfig.title}</title>
      </Head>

      <main className="flex w-full flex-1 flex-col bg-fluent-surface-panel">
        <Navbar />
        <div className="flex flex-1">
          <Linkcccp_Sidebar />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-6xl py-6 sm:p-6">
              <nav className="mb-6 flex items-center justify-between rounded-fluent-lg bg-fluent-surface-card p-4 shadow-fluent-sm">
                <Breadcrumb />
                <SwitchLayout />
              </nav>
              <div className="rounded-fluent-lg bg-fluent-surface-card shadow-fluent-sm">
                <FileListing />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconName } from '@fortawesome/fontawesome-svg-core'
import { Dialog, Transition } from '@headlessui/react'
import toast, { Toaster } from 'react-hot-toast'
import { useHotkeys } from 'react-hotkeys-hook'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'

import siteConfig from '../../config/site.config'
import SearchModal from './SearchModal'
import useDeviceOS from '../utils/useDeviceOS'

const Navbar = () => {
  const router = useRouter()
  const os = useDeviceOS()

  const [tokenPresent, setTokenPresent] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isGeneratingIndex, setIsGeneratingIndex] = useState(false)

  const [searchOpen, setSearchOpen] = useState(false)
  const openSearchBox = () => setSearchOpen(true)

  useHotkeys(`${os === 'mac' ? 'meta' : 'ctrl'}+k`, e => {
    openSearchBox()
    e.preventDefault()
  })

  useEffect(() => {
    const storedToken = () => {
      for (const r of siteConfig.protectedRoutes) {
        if (localStorage.hasOwnProperty(r)) {
          return true
        }
      }
      return false
    }
    setTokenPresent(storedToken())
  }, [])

  const clearTokens = () => {
    setIsOpen(false)

    siteConfig.protectedRoutes.forEach(r => {
      localStorage.removeItem(r)
    })

    toast.success('Cleared all tokens')
    setTimeout(() => {
      router.reload()
    }, 1000)
  }

  const generateIndex = async () => {
    // [安全增强] 要求输入管理密码
    const accessKey = window.prompt('🔐 Please enter the admin access key to generate index:')
    if (!accessKey) return

    setIsGeneratingIndex(true)
    try {
      const response = await fetch('/api/Linkcccp_generateIndex', {
        headers: {
          'x-linkcccp-access-key': accessKey
        }
      })
      const data = await response.json()

      if (response.ok) {
        toast.success('Index generated successfully! 📚')
      } else {
        toast.error(`Failed: ${data.error}`)
      }
    } catch (error) {
      toast.error('Error generating index')
      console.error('Error:', error)
    } finally {
      setIsGeneratingIndex(false)
    }
  }

  return (
    <div className="sticky top-0 z-[100] border-b border-fluent-border bg-fluent-surface/80 backdrop-blur-fluent-md fluent-acrylic">
      <Toaster />

      <SearchModal searchOpen={searchOpen} setSearchOpen={setSearchOpen} />

      <div className="mx-auto flex w-full items-center justify-between space-x-4 px-4 py-2">
        <Link href="/" passHref className="flex items-center space-x-3 py-2 hover:opacity-80 md:p-2">
          <Image src={siteConfig.icon} alt="icon" width="28" height="28" priority className="rounded-fluent-sm" />
          <span className="hidden text-lg font-semibold text-fluent-text-primary sm:block">{siteConfig.title}</span>
        </Link>

        <div className="flex flex-1 items-center space-x-4 text-fluent-text-secondary md:flex-initial">
          <button
            className="flex flex-1 items-center justify-between rounded-fluent-lg bg-fluent-surface-card px-3 py-2 hover:bg-fluent-surface-panel active:bg-fluent-surface-panel md:w-56"
            onClick={openSearchBox}
          >
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon className="h-4 w-4 text-fluent-text-tertiary" icon="search" />
              <span className="truncate text-sm font-medium text-fluent-text-secondary">{'Search ...'}</span>
            </div>

            <div className="hidden items-center space-x-1 md:flex">
              <div className="rounded-fluent-sm bg-fluent-surface-panel px-2 py-1 text-xs font-medium text-fluent-text-tertiary">
                {os === 'mac' ? '⌘' : 'Ctrl'}
              </div>
              <div className="rounded-fluent-sm bg-fluent-surface-panel px-2 py-1 text-xs font-medium text-fluent-text-tertiary">K</div>
            </div>
          </button>

          {siteConfig.links.length !== 0 &&
            siteConfig.links.map((l: { name: string; link: string }) => (
              <a
                key={l.name}
                href={l.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 rounded-fluent-md p-2 hover:bg-fluent-surface-card"
              >
                <FontAwesomeIcon icon={['fab', l.name.toLowerCase() as IconName]} className="text-fluent-text-secondary" />
                <span className="hidden text-sm font-medium text-fluent-text-secondary md:inline-block">{l.name}</span>
              </a>
            ))}

          {siteConfig.email && (
            <a href={siteConfig.email} className="flex items-center space-x-2 rounded-fluent-md p-2 hover:bg-fluent-surface-card">
              <FontAwesomeIcon icon={['far', 'envelope']} className="text-fluent-text-secondary" />
              <span className="hidden text-sm font-medium text-fluent-text-secondary md:inline-block">{'Email'}</span>
            </a>
          )}

          {tokenPresent && (
            <button
              className="flex items-center space-x-2 rounded-fluent-md p-2 hover:bg-fluent-surface-card"
              onClick={() => setIsOpen(true)}
            >
              <span className="hidden text-sm font-medium text-fluent-text-secondary md:inline-block">{'Logout'}</span>
              <FontAwesomeIcon icon="sign-out-alt" className="text-fluent-text-secondary" />
            </button>
          )}
          <button
            className="flex items-center space-x-2 rounded-fluent-md p-2 hover:bg-fluent-surface-card disabled:opacity-50"
            onClick={generateIndex}
            disabled={isGeneratingIndex}
            title="Generate OneDrive file index"
          >
            <span className="hidden text-sm font-medium text-fluent-text-secondary md:inline-block">
              {isGeneratingIndex ? 'Generating...' : 'Index'}
            </span>
            <FontAwesomeIcon
              icon={isGeneratingIndex ? 'spinner' : 'file-alt'}
              spin={isGeneratingIndex}
              className={isGeneratingIndex ? 'text-fluent-primary' : 'text-fluent-text-secondary'}
            />
          </button>        </div>
      </div>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" open={isOpen} onClose={() => setIsOpen(false)}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-100"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-50"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-fluent-surface/80 backdrop-blur-fluent-md" />
            </Transition.Child>

            {/* This element is to trick the browser into centering the modal contents. */}
            <span className="inline-block h-screen align-middle" aria-hidden="true">
              &#8203;
            </span>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-100"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-50"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="my-8 inline-block w-full max-w-md transform overflow-hidden rounded-fluent-xl bg-fluent-surface-card p-6 text-left align-middle shadow-fluent-xl animate-fluent-enter">
                <Dialog.Title className="text-lg font-semibold text-fluent-text-primary">
                  {'Clear all tokens?'}
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-sm text-fluent-text-secondary">
                    {'These tokens are used to authenticate yourself into password protected folders, ' +
                      'clearing them means that you will need to re-enter the passwords again.'}
                  </p>
                </div>

                <div className="mt-4 max-h-32 overflow-y-scroll rounded-fluent-md border border-fluent-border bg-fluent-surface p-3 font-mono text-sm text-fluent-text-secondary">
                  {siteConfig.protectedRoutes.map((r, i) => (
                    <div key={i} className="flex items-center space-x-2 py-1">
                      <FontAwesomeIcon icon="key" className="text-fluent-text-tertiary" />
                      <span className="truncate">{r}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex items-center justify-end space-x-3">
                  <button
                    className="fluent-btn-secondary"
                    onClick={() => setIsOpen(false)}
                  >
                    {'Cancel'}
                  </button>
                  <button
                    className="fluent-btn-accent"
                    onClick={() => clearTokens()}
                  >
                    <FontAwesomeIcon icon={['far', 'trash-alt']} />
                    <span>{'Clear all'}</span>
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}

export default Navbar

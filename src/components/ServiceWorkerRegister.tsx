'use client'

import { useEffect } from 'react'

export const ServiceWorkerRegister = () => {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })
      } catch (error) {
        console.warn('[SW] registration failed', error)
      }
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }

    return () => {
      window.removeEventListener('load', register)
    }
  }, [])

  return null
}

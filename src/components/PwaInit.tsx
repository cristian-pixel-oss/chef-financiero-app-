'use client'

/**
 * CHEF FINANCIERO — PwaInit
 * Registra el service worker en el cliente. Montado en el RootLayout.
 * Se ejecuta una sola vez después de que la página carga.
 */

import { useEffect } from 'react'

export default function PwaInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.info('[SW] Registrado:', reg.scope)
        })
        .catch((err) => {
          console.warn('[SW] Error al registrar:', err)
        })
    })
  }, [])

  return null
}

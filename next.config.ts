import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Server Actions: permite el origen de la app (detectado automáticamente
  // en producción por Vercel; no es necesario listar dominios explícitos
  // cuando el cliente y el servidor comparten el mismo origen).
  experimental: {
    serverActions: {
      // Vacío = solo el mismo origen (comportamiento por defecto, correcto en Vercel)
      allowedOrigins: [],
    },
  },
}

export default nextConfig

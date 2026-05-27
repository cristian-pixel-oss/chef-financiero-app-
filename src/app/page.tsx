import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// La ruta raíz redirige al login
export default function HomePage() {
  redirect('/login')
}

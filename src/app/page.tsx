import { redirect } from 'next/navigation'

// La ruta raíz redirige al login
export default function HomePage() {
  redirect('/login')
}

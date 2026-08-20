import { LoginForm } from './components/LoginForm'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'

function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-ink/60">Cargando…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-primary text-3xl font-semibold">Sunname ERP</h1>
        <LoginForm />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-primary text-3xl font-semibold">Sunname ERP</h1>
      <p className="text-ink">
        Hola, {profile?.full_name ?? session.user.email} — rol: {profile?.role ?? '—'}
      </p>
      <button
        onClick={() => supabase.auth.signOut()}
        className="border-ink/20 text-ink rounded-md border px-4 py-2"
      >
        Cerrar sesión
      </button>
    </main>
  )
}

export default App

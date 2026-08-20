import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { CajaPage } from '@/features/caja/CajaPage'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './hooks/useAuth'

function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Cargando…</p>
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
    <AppShell session={session} profile={profile}>
      <Routes>
        <Route path="/" element={<Navigate to="/caja" replace />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/catalogo" element={<CatalogPage />} />
        <Route path="*" element={<Navigate to="/caja" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App

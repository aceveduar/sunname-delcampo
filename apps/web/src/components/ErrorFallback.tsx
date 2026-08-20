import { Button } from '@/components/ui/button'

export function ErrorFallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-primary text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Ocurrió un error inesperado. Ya quedó registrado — intenta recargar la página.
      </p>
      <Button onClick={() => window.location.reload()}>Recargar</Button>
    </main>
  )
}

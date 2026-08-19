function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-primary text-3xl font-semibold">Sunname ERP</h1>
      <p className="text-ink/70">Fase 0 — scaffold funcionando.</p>
      <div className="flex gap-3">
        <span
          className="bg-primary h-10 w-10 rounded-md"
          title="Indigo profundo"
        />
        <span
          className="bg-accent h-10 w-10 rounded-md"
          title="Dorado apagado"
        />
        <span
          className="bg-success h-10 w-10 rounded-md"
          title="Verde salvia"
        />
        <span className="bg-danger h-10 w-10 rounded-md" title="Terracota" />
      </div>
    </main>
  )
}

export default App

import { type FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-ink text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-ink/20 text-ink focus:border-primary rounded-md border bg-white px-3 py-2 outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-ink text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-ink/20 text-ink focus:border-primary rounded-md border bg-white px-3 py-2 outline-none"
        />
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

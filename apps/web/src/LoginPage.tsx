import { useState, type FormEvent } from 'react'
import { login, type MeResponse } from './api/client'

export function LoginPage({ onSuccess }: { onSuccess: (me: MeResponse) => void }) {
  const [email, setEmail] = useState('owner@yuvrajsaree.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const me = await login(email.trim().toLowerCase(), password)
      onSuccess(me)
    } catch {
      setError('Invalid email or password')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card panel" onSubmit={submit}>
        <h1>Yuvraj Saree Center</h1>
        <p>Sign in to manage orders and collections.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button className="btn btn-secondary" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

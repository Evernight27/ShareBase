import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext.js'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(identifier, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Email or username</span>
          <input
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="rounded-xl border border-neutral-300 p-3"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-neutral-300 p-3"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-neutral-900 px-4 py-3 font-semibold text-white disabled:bg-neutral-400"
        >
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        Need an account?{' '}
        <Link className="font-semibold text-neutral-900" to="/accounts/register">
          Register
        </Link>
      </p>
    </section>
  )
}

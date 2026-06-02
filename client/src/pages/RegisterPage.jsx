import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext.js'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await register(username, email, password)
      navigate(`/${user.username}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Username</span>
          <input
            required
            minLength="3"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="rounded-xl border border-neutral-300 p-3"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-xl border border-neutral-300 p-3"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Password</span>
          <input
            required
            minLength="8"
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
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        Already have an account?{' '}
        <Link className="font-semibold text-neutral-900" to="/accounts/login">
          Log in
        </Link>
      </p>
    </section>
  )
}

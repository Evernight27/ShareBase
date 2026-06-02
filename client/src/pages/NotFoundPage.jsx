import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-neutral-600">The page you requested does not exist.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-xl bg-neutral-900 px-4 py-3 font-semibold text-white"
      >
        Go home
      </Link>
    </section>
  )
}

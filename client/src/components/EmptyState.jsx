export default function EmptyState({ title, message }) {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 text-neutral-600">{message}</p>
    </section>
  )
}

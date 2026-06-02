import PostGrid from '../components/PostGrid.jsx'
import useApiResource from '../hooks/useApiResource.js'

export default function ExplorePage() {
  const { data, error, isLoading } = useApiResource('/posts/explore')
  const posts = data?.posts || []

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Explore</h1>
      {isLoading ? <p className="text-neutral-600">Loading explore posts...</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : null}
      {!isLoading && !error ? (
        <PostGrid
          posts={posts}
          emptyTitle="Explore posts will appear here"
          emptyMessage="Create the first image post to populate the explore grid."
        />
      ) : null}
    </section>
  )
}

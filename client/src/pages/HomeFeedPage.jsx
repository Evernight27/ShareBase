import PostGrid from '../components/PostGrid.jsx'
import { useAuth } from '../auth/authContext.js'
import useApiResource from '../hooks/useApiResource.js'

export default function HomeFeedPage() {
  const { isAuthenticated } = useAuth()
  const { data, error, isLoading } = useApiResource(isAuthenticated ? '/posts/feed' : '/posts/explore')
  const posts = data?.posts || []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Home feed</h1>
        {isLoading ? <p className="text-neutral-600">Loading posts...</p> : null}
        {error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : null}
        {!isLoading && !error ? (
          <PostGrid
            posts={posts}
            emptyTitle="Your feed is ready for posts"
            emptyMessage={
              isAuthenticated
                ? 'Follow users or create a post to populate your feed.'
                : 'Log in to see followed users or browse the public explore feed.'
            }
          />
        ) : null}
      </section>
      <aside className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Suggested next step</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Create an image post, then it will appear in explore and authenticated feeds.
        </p>
      </aside>
    </div>
  )
}

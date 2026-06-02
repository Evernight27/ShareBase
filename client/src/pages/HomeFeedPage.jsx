import PostGrid from '../components/PostGrid.jsx'
import { useAuth } from '../auth/authContext.js'
import useApiResource from '../hooks/useApiResource.js'

export default function HomeFeedPage() {
  const { isAuthenticated, isLoadingUser } = useAuth()

  // Wait for AuthProvider to validate any stored token before deciding
  // which feed to load. Otherwise a stale localStorage token would
  // fire `/posts/feed`, get a 401, flash an error, and only THEN flip
  // to `/posts/explore` once AuthProvider clears the token. Gating on
  // !isLoadingUser keeps the request lined up with the real auth state.
  const path = isAuthenticated ? '/posts/feed' : '/posts/explore'
  const { data, error, isLoading } = useApiResource(path, {
    enabled: !isLoadingUser,
  })
  const posts = data?.posts || []

  const heading = isAuthenticated ? 'Home feed' : 'Explore'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section>
        <h1 className="mb-4 text-2xl font-bold">{heading}</h1>
        {isLoadingUser || isLoading ? (
          <p className="text-neutral-600">Loading posts...</p>
        ) : null}
        {error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : null}
        {!isLoadingUser && !isLoading && !error ? (
          <PostGrid
            posts={posts}
            emptyTitle={
              isAuthenticated ? 'Your feed is ready for posts' : 'Explore posts will appear here'
            }
            emptyMessage={
              isAuthenticated
                ? 'Follow users or create a post to populate your feed.'
                : 'Log in to see posts from people you follow, or create the first one!'
            }
          />
        ) : null}
      </section>
      <aside className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Suggested next step</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Create an image post and it will appear here on your feed and on the public explore grid.
        </p>
      </aside>
    </div>
  )
}

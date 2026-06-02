import { useParams } from 'react-router-dom'
import PostGrid from '../components/PostGrid.jsx'
import useApiResource from '../hooks/useApiResource.js'

export default function ProfilePage() {
  const { username } = useParams()
  const profile = useApiResource(`/users/${username}`)
  const posts = useApiResource(`/posts/user/${username}`)
  const user = profile.data?.user

  return (
    <section>
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Profile</p>
        {profile.isLoading ? <p className="mt-2 text-neutral-600">Loading profile...</p> : null}
        {profile.error ? <p className="mt-2 text-red-600">{profile.error}</p> : null}
        {user ? (
          <>
            <h1 className="mt-2 text-3xl font-bold">@{user.username}</h1>
            {user.bio ? <p className="mt-2 text-neutral-700">{user.bio}</p> : null}
            <dl className="mt-4 flex gap-6 text-sm text-neutral-600">
              <div>
                <dt className="font-semibold text-neutral-900">{user.stats?.posts || 0}</dt>
                <dd>posts</dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">{user.stats?.followers || 0}</dt>
                <dd>followers</dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">{user.stats?.following || 0}</dt>
                <dd>following</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
      {posts.isLoading ? <p className="text-neutral-600">Loading posts...</p> : null}
      {posts.error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{posts.error}</p> : null}
      {!posts.isLoading && !posts.error ? (
        <PostGrid
          posts={posts.data?.posts || []}
          emptyTitle="No posts yet"
          emptyMessage="This user's image posts will appear here."
        />
      ) : null}
    </section>
  )
}

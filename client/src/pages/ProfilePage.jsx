import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../auth/authContext.js'
import PostGrid from '../components/PostGrid.jsx'
import useApiResource from '../hooks/useApiResource.js'

export default function ProfilePage() {
  const { username } = useParams()
  const { isAuthenticated } = useAuth()
  const profile = useApiResource(`/users/${username}`)
  const posts = useApiResource(`/posts/user/${username}`)

  const user = profile.data?.user
  // The server returns an `id` virtual on every Mongoose toJSON; fall
  // back to `_id` defensively in case a future serializer drops it.
  const targetId = user?.id || user?._id

  const [isFollowMutating, setIsFollowMutating] = useState(false)
  const [followError, setFollowError] = useState('')

  async function toggleFollow() {
    if (!user || !targetId || isFollowMutating) return
    const wasFollowing = user.viewerIsFollowing
    setIsFollowMutating(true)
    setFollowError('')
    try {
      await apiRequest(`/users/${targetId}/follow`, {
        method: wasFollowing ? 'DELETE' : 'POST',
      })
      // Refetch profile to pick up the new viewerIsFollowing flag and
      // the updated stats.followers count from the server. Doing a
      // full refetch (instead of optimistic local mutation) keeps the
      // UI honest about what the server actually persisted.
      await profile.refetch()
    } catch (err) {
      setFollowError(err.message)
    } finally {
      setIsFollowMutating(false)
    }
  }

  // Authenticated, viewing someone else's profile, server has loaded
  // the viewer flag. (`viewerIsFollowing` is `undefined` for anon and
  // for self; `isSelf` is the explicit signal.)
  const showFollowButton =
    isAuthenticated && user && user.isSelf === false

  return (
    <section>
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Profile</p>
        {profile.isLoading ? <p className="mt-2 text-neutral-600">Loading profile...</p> : null}
        {profile.error ? <p className="mt-2 text-red-600">{profile.error}</p> : null}
        {user ? (
          <>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">@{user.username}</h1>
                {user.name ? (
                  <p className="mt-1 text-neutral-600">{user.name}</p>
                ) : null}
              </div>
              {showFollowButton ? (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={isFollowMutating}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    user.viewerIsFollowing
                      ? 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  } disabled:opacity-50`}
                >
                  {isFollowMutating
                    ? '...'
                    : user.viewerIsFollowing
                      ? 'Following'
                      : 'Follow'}
                </button>
              ) : null}
            </div>
            {user.bio ? <p className="mt-2 text-neutral-700">{user.bio}</p> : null}
            {followError ? (
              <p className="mt-2 text-sm text-red-600">{followError}</p>
            ) : null}
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

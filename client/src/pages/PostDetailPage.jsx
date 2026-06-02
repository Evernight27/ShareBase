import { useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import useApiResource from '../hooks/useApiResource.js'

export default function PostDetailPage() {
  const { postId } = useParams()
  const { data, error, isLoading } = useApiResource(`/posts/${postId}`)
  const post = data?.post
  const author = post?.author || {}

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Post detail</h1>
      {isLoading ? <p className="text-neutral-600">Loading post...</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : null}
      {!isLoading && !error && post ? (
        <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <img
            src={post.imageUrl}
            alt={post.caption ? `Post by ${author.username}: ${post.caption}` : `Post by ${author.username}`}
            className="max-h-[70vh] w-full object-contain bg-neutral-100"
          />
          <div className="space-y-4 p-5">
            <p className="font-semibold">@{author.username}</p>
            {post.caption ? <p className="text-neutral-700">{post.caption}</p> : null}
            <p className="text-sm text-neutral-500">{post.likes?.length || 0} likes</p>
            <section>
              <h2 className="font-semibold">Comments</h2>
              {post.comments?.length ? (
                <ul className="mt-3 space-y-3">
                  {post.comments.map((comment) => (
                    <li key={comment._id || comment.id} className="text-sm">
                      <span className="font-semibold">@{comment.author?.username}</span> {comment.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">No comments yet.</p>
              )}
            </section>
          </div>
        </article>
      ) : null}
      {!isLoading && !error && !post ? (
        <EmptyState title={`Post ${postId}`} message="This post could not be loaded." />
      ) : null}
    </section>
  )
}

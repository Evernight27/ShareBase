import { Link } from 'react-router-dom'

/**
 * Read-only card. The interactive Like / Save / Comment controls live
 * on PostDetailPage so optimistic state lives in one place per post
 * and PostGrid can stay a pure list. The card surfaces filled vs
 * outlined heart and bookmark glyphs derived from the server-provided
 * `viewerHasLiked` / `viewerHasSaved` so an authed user can see their
 * own state at a glance.
 */
export default function PostCard({ post }) {
  const author = post.author || {}
  const likesCount = post.likes?.length || 0
  const commentsCount = post.comments?.length || 0
  const liked = Boolean(post.viewerHasLiked)
  const saved = Boolean(post.viewerHasSaved)

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <Link to={`/p/${post._id || post.id}`}>
        <img
          src={post.imageUrl}
          alt={post.caption ? `Post by ${author.username}: ${post.caption}` : `Post by ${author.username}`}
          className="aspect-square w-full object-cover"
        />
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Link to={`/${author.username}`} className="font-semibold">
            @{author.username || 'unknown'}
          </Link>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span title={liked ? 'You liked this' : `${likesCount} likes`}>
              <span aria-hidden="true">{liked ? '❤' : '♡'}</span> {likesCount}
            </span>
            {saved ? (
              <span title="You saved this" aria-label="Saved by you">
                <span aria-hidden="true">🔖</span>
              </span>
            ) : null}
          </div>
        </div>
        {post.caption ? <p className="text-sm text-neutral-700">{post.caption}</p> : null}
        <Link to={`/p/${post._id || post.id}`} className="text-sm text-neutral-500 hover:text-neutral-900">
          View {commentsCount} comments
        </Link>
      </div>
    </article>
  )
}

import { Link } from 'react-router-dom'

export default function PostCard({ post }) {
  const author = post.author || {}
  const likesCount = post.likes?.length || 0
  const commentsCount = post.comments?.length || 0

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
          <span className="text-sm text-neutral-500">{likesCount} likes</span>
        </div>
        {post.caption ? <p className="text-sm text-neutral-700">{post.caption}</p> : null}
        <Link to={`/p/${post._id || post.id}`} className="text-sm text-neutral-500 hover:text-neutral-900">
          View {commentsCount} comments
        </Link>
      </div>
    </article>
  )
}

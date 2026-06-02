import EmptyState from './EmptyState.jsx'
import PostCard from './PostCard.jsx'

export default function PostGrid({ posts, emptyTitle, emptyMessage }) {
  if (!posts?.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post._id || post.id} post={post} />
      ))}
    </div>
  )
}

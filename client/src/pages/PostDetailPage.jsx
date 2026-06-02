import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../auth/authContext.js'
import EmptyState from '../components/EmptyState.jsx'
import useApiResource from '../hooks/useApiResource.js'

export default function PostDetailPage() {
  const { postId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { data, error, isLoading, refetch } = useApiResource(`/posts/${postId}`)
  const post = data?.post
  const author = post?.author || {}
  const postIdValue = post?._id || post?.id

  const viewerId = user?.id || user?._id || null
  const isPostAuthor = Boolean(viewerId && author && (author._id === viewerId || author.id === viewerId))

  const [isLikeMutating, setIsLikeMutating] = useState(false)
  const [isSaveMutating, setIsSaveMutating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState('')

  const [commentText, setCommentText] = useState('')
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [deletingCommentId, setDeletingCommentId] = useState(null)

  async function toggleLike() {
    if (!post || !postIdValue || isLikeMutating) return
    setIsLikeMutating(true)
    setActionError('')
    try {
      await apiRequest(`/posts/${postIdValue}/like`, {
        method: post.viewerHasLiked ? 'DELETE' : 'POST',
      })
      await refetch()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setIsLikeMutating(false)
    }
  }

  async function toggleSave() {
    if (!post || !postIdValue || isSaveMutating) return
    setIsSaveMutating(true)
    setActionError('')
    try {
      await apiRequest(`/posts/${postIdValue}/save`, {
        method: post.viewerHasSaved ? 'DELETE' : 'POST',
      })
      await refetch()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setIsSaveMutating(false)
    }
  }

  async function deletePost() {
    if (!post || !postIdValue || isDeleting) return
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setIsDeleting(true)
    setActionError('')
    try {
      await apiRequest(`/posts/${postIdValue}`, { method: 'DELETE' })
      // The post is gone — bounce to the author's profile rather than
      // staying on a 404'd detail page.
      navigate(author.username ? `/${author.username}` : '/', { replace: true })
    } catch (err) {
      setActionError(err.message)
      setIsDeleting(false)
    }
  }

  async function deleteComment(commentId) {
    if (!postIdValue || !commentId || deletingCommentId) return
    setDeletingCommentId(commentId)
    setCommentError('')
    try {
      await apiRequest(`/posts/${postIdValue}/comments/${commentId}`, { method: 'DELETE' })
      await refetch()
    } catch (err) {
      setCommentError(err.message)
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (!post || !postIdValue || !commentText.trim() || isCommentSubmitting) return
    setIsCommentSubmitting(true)
    setCommentError('')
    try {
      await apiRequest(`/posts/${postIdValue}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: commentText.trim() }),
      })
      setCommentText('')
      await refetch()
    } catch (err) {
      setCommentError(err.message)
    } finally {
      setIsCommentSubmitting(false)
    }
  }

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to={`/${author.username}`} className="font-semibold">
                @{author.username}
              </Link>
              {isPostAuthor ? (
                <button
                  type="button"
                  onClick={deletePost}
                  disabled={isDeleting}
                  className="rounded-full border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete post'}
                </button>
              ) : null}
            </div>
            {post.caption ? <p className="text-neutral-700">{post.caption}</p> : null}

            {/* Like / save controls. Disabled (read-only label) for
                anonymous viewers; clicking otherwise toggles via the
                API and refetches so counts/state come from the server. */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={toggleLike}
                    disabled={isLikeMutating}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      post.viewerHasLiked
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    } disabled:opacity-50`}
                    aria-pressed={Boolean(post.viewerHasLiked)}
                  >
                    {post.viewerHasLiked ? '❤ Liked' : '♡ Like'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSave}
                    disabled={isSaveMutating}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      post.viewerHasSaved
                        ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                        : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    } disabled:opacity-50`}
                    aria-pressed={Boolean(post.viewerHasSaved)}
                  >
                    {post.viewerHasSaved ? 'Saved' : 'Save'}
                  </button>
                </>
              ) : (
                <p className="text-neutral-500">
                  <Link to="/accounts/login" className="font-semibold text-neutral-900">
                    Log in
                  </Link>{' '}
                  to like, save, or comment.
                </p>
              )}
              <span className="text-neutral-500">{post.likes?.length || 0} likes</span>
            </div>
            {actionError ? (
              <p className="text-sm text-red-600">{actionError}</p>
            ) : null}

            <section>
              <h2 className="font-semibold">Comments</h2>
              {post.comments?.length ? (
                <ul className="mt-3 space-y-3">
                  {post.comments.map((comment) => {
                    const cid = comment._id || comment.id
                    const cAuthorId = comment.author?._id || comment.author?.id
                    const isCommentAuthor = Boolean(viewerId && cAuthorId && cAuthorId === viewerId)
                    return (
                      <li key={cid} className="text-sm">
                        <Link to={`/${comment.author?.username}`} className="font-semibold">
                          @{comment.author?.username}
                        </Link>{' '}
                        {comment.text}
                        {isCommentAuthor ? (
                          <button
                            type="button"
                            onClick={() => deleteComment(cid)}
                            disabled={deletingCommentId === cid}
                            className="ml-2 text-xs text-neutral-500 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingCommentId === cid ? '...' : 'delete'}
                          </button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">No comments yet.</p>
              )}
              {isAuthenticated ? (
                <form onSubmit={submitComment} className="mt-4 flex flex-wrap gap-2">
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    maxLength={1000}
                    placeholder="Add a comment..."
                    className="flex-1 min-w-[12rem] rounded-xl border border-neutral-300 p-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isCommentSubmitting || !commentText.trim()}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isCommentSubmitting ? 'Posting...' : 'Post'}
                  </button>
                </form>
              ) : null}
              {commentError ? (
                <p className="mt-2 text-sm text-red-600">{commentError}</p>
              ) : null}
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

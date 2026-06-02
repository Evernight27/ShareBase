import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client.js'

export default function CreatePostPage() {
  const [caption, setCaption] = useState('')
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!image) {
      setError('Choose an image to upload')
      return
    }

    const formData = new FormData()
    formData.append('image', image)
    formData.append('caption', caption)
    setIsSubmitting(true)

    try {
      const data = await apiRequest('/posts', {
        method: 'POST',
        body: formData,
      })
      navigate(`/p/${data.post._id || data.post.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Create post</h1>
      <p className="mt-2 text-neutral-600">
        Upload a JPEG, PNG, WebP, or GIF image. ShareBase stores images in Cloudinary.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Image</span>
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setImage(event.target.files?.[0] || null)}
            className="rounded-xl border border-neutral-300 p-3"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Caption</span>
          <textarea
            rows="4"
            maxLength="2200"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Write a caption..."
            className="rounded-xl border border-neutral-300 p-3"
          />
        </label>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <button
          disabled={isSubmitting}
          className="rounded-xl bg-neutral-900 px-4 py-3 font-semibold text-white disabled:bg-neutral-400"
        >
          {isSubmitting ? 'Sharing...' : 'Share post'}
        </button>
      </form>
    </section>
  )
}

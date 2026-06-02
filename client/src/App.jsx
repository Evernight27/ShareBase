import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import CreatePostPage from './pages/CreatePostPage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import HomeFeedPage from './pages/HomeFeedPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PostDetailPage from './pages/PostDetailPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeFeedPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route
          path="create"
          element={
            <ProtectedRoute>
              <CreatePostPage />
            </ProtectedRoute>
          }
        />
        <Route path="p/:postId" element={<PostDetailPage />} />
        <Route path="accounts/login" element={<LoginPage />} />
        <Route path="accounts/register" element={<RegisterPage />} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path=":username" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}

export default App

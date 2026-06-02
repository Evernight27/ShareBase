import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/authContext.js'

// Static nav items shown to everyone. The "Create" entry is conditional
// because it's auth-required (ProtectedRoute would redirect anyway,
// but showing a link that always bounces to login is bad UX).
const PUBLIC_NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
]

export default function Layout() {
  const { isAuthenticated, logout, user } = useAuth()
  const navItems = isAuthenticated
    ? [...PUBLIC_NAV_ITEMS, { to: '/create', label: 'Create' }]
    : PUBLIC_NAV_ITEMS

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="text-xl font-bold tracking-tight">
            ShareBase
          </NavLink>
          <div className="flex items-center gap-2 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 ${
                    isActive ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {isAuthenticated ? (
              <>
                <NavLink
                  to={user?.username ? `/${user.username}` : '/'}
                  className="rounded-full px-3 py-2 text-neutral-700 hover:bg-neutral-100"
                >
                  Profile
                </NavLink>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-neutral-300 px-3 py-2 text-neutral-700 hover:bg-neutral-100"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink
                to="/accounts/login"
                className="rounded-full border border-neutral-300 px-3 py-2 text-neutral-700 hover:bg-neutral-100"
              >
                Log in
              </NavLink>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

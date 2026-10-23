import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly } from './components/GuestOnly.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { AppLayout } from './layout/AppLayout.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { PostDetailPage } from './pages/PostDetailPage.jsx'
import { SignupPage } from './pages/SignupPage.jsx'
import { TimelinePage } from './pages/TimelinePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<TimelinePage />} />
          <Route path="/posts/:postId" element={<PostDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

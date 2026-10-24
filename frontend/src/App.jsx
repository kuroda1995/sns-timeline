import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly } from './components/GuestOnly.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { AppLayout } from './layout/AppLayout.jsx'
import { FollowListPage } from './pages/FollowListPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { PostDetailPage } from './pages/PostDetailPage.jsx'
import { ProfileEditPage } from './pages/ProfileEditPage.jsx'
import { ProfilePage } from './pages/ProfilePage.jsx'
import { SearchPage } from './pages/SearchPage.jsx'
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
          <Route path="/search" element={<SearchPage />} />
          <Route path="/users/:username" element={<ProfilePage />} />
          <Route path="/users/:username/following" element={<FollowListPage kind="following" />} />
          <Route path="/users/:username/followers" element={<FollowListPage kind="followers" />} />
          <Route path="/settings/profile" element={<ProfileEditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

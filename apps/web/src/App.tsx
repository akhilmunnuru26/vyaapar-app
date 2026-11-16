import { useQuery } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { fetchMe } from './api/client'
import { LoginPage } from './LoginPage'
import { Shell } from './Shell'

export default function App() {
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
  })

  if (meQuery.isLoading) {
    return <div className="login-screen">Loading…</div>
  }

  if (meQuery.isError) {
    return (
      <LoginPage
        onSuccess={() => {
          void meQuery.refetch()
        }}
      />
    )
  }

  const me = meQuery.data!

  return (
    <Routes>
      <Route path="/" element={<Shell initialPage="dashboard" me={me} onLogout={() => void meQuery.refetch()} />} />
      <Route path="/orders" element={<Shell initialPage="orders" me={me} onLogout={() => void meQuery.refetch()} />} />
      <Route path="/messages" element={<Shell initialPage="messages" me={me} onLogout={() => void meQuery.refetch()} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

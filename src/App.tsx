import { useEffect } from 'react'
import { AppRouter } from '@/routes/app-router'
import { useSessionStore } from '@/lib/store/session-store'

function App() {
  // Restores the persisted session optimistically (via zustand's persist
  // middleware, before this even runs), then verifies it against the server
  // in the background — see `bootstrap` in session-store.ts.
  const bootstrap = useSessionStore((s) => s.bootstrap)
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return <AppRouter />
}

export default App

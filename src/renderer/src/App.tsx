import React, { useState } from 'react'
import { Mic } from './components/Mic'
import { Sidebar } from './components/Sidebar'
import { Integrations } from './components/Integrations'
import { EventBanner } from './components/EventBanner'

function App(): React.JSX.Element {
  const [page, setPage] = useState<string>('Home')

  return (
    <div className="min-h-screen w-full flex">
      <EventBanner />
      <Sidebar page={page} setPage={setPage} />
      <div className="bg-neutral-950 w-full">
        <div className={page === 'Home' ? 'block' : 'hidden'}>
          <Mic />
        </div>

        <div className={page === 'Integrations' ? 'block' : 'hidden'}>
          <Integrations />
        </div>
      </div>
    </div>
  )
}

export default App

import React, { useEffect, useState } from 'react'
import { MessageSquareIcon, XIcon } from 'lucide-react'
import type { EventAlert } from '../../../shared/events'

export function EventBanner(): React.JSX.Element {
  const [alerts, setAlerts] = useState<EventAlert[]>([])

  useEffect(() => {
    const off = window.events?.onAlert((alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 4))
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
      }, 15000)
    })
    return off
  }, [])

  const dismiss = (id: string): void => setAlerts((prev) => prev.filter((a) => a.id !== id))

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-80">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="bg-[#171717] rounded-md p-4 flex gap-3 shadow-lg shadow-black/40 border border-white/5"
        >
          <span className="mt-0.5 text-white/40 shrink-0">
            <MessageSquareIcon size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white/90 truncate">
                {a.channelName ?? 'Slack'}
                {a.count && a.count > 1 ? (
                  <span className="text-white/40"> · {a.count} new</span>
                ) : null}
              </p>
              <button
                onClick={() => dismiss(a.id)}
                className="text-white/40 hover:text-white transition-colors shrink-0"
              >
                <XIcon size={14} />
              </button>
            </div>
            <p className="mt-1 text-sm text-white/60 break-words line-clamp-3">
              {a.count && a.count > 1 ? `latest: ${a.text ?? ''}` : a.text ?? a.summary}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

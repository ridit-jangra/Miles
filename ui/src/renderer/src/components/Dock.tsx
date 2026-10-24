import { Brain, House, Inbox, ListChecks, Puzzle, type LucideIcon } from "lucide-react"

import { cn } from "../lib/cn"
import { PAGES, type Page } from "./Nav"
import { Dot } from "./ui"

const ICONS: Record<Page, LucideIcon> = {
  home: House,
  inbox: Inbox,
  tasks: ListChecks,
  plugins: Puzzle,
  memory: Brain,
}

function Tip({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="group relative grid place-items-center">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-control bg-[#121214] px-2.5 py-1 font-mono text-note whitespace-nowrap text-ink opacity-0 transition-opacity duration-120 group-focus-within:opacity-100 group-hover:opacity-100 group-hover:delay-300"
      >
        {label}
      </span>
    </span>
  )
}

export function Dock(props: { page: Page; onPage: (page: Page) => void; live: boolean }): React.JSX.Element {
  return (
    <nav
      aria-label="pages"
      className="fixed top-1/2 left-4 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-control bg-[#121214] p-1.5"
    >
      {PAGES.map((name) => {
        const Icon = ICONS[name]
        const active = props.page === name
        return (
          <Tip key={name} label={name}>
            <button
              type="button"
              aria-label={name}
              aria-current={active ? "page" : undefined}
              onClick={() => props.onPage(name)}
              className={cn(
                "grid size-10 cursor-pointer place-items-center rounded-control border border-transparent outline-none transition-colors duration-120",
                active ? "bg-ink text-on-light " : "text-ink-dim hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink",
              )}
            >
              <Icon size={18} />
            </button>
          </Tip>
        )
      })}
      <Tip label={props.live ? "connected" : "offline"}>
        <span className="grid size-8 place-items-center">
          <Dot on={props.live} />
        </span>
      </Tip>
    </nav>
  )
}

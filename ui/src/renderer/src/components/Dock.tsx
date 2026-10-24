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

export function Dock(props: { page: Page; onPage: (page: Page) => void; live: boolean }): React.JSX.Element {
  return (
    <nav
      aria-label="pages"
      className="fixed top-1/2 left-4 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-control p-1.5"
    >
      {PAGES.map((name) => {
        const Icon = ICONS[name]
        const active = props.page === name
        return (
          <button
            key={name}
            type="button"
            title={name}
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
        )
      })}
      <span className="grid size-8 place-items-center" title={props.live ? "connected" : "offline"}>
        <Dot on={props.live} />
      </span>
    </nav>
  )
}

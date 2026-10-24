import { cn } from "../lib/cn"
import { Dot } from "./ui"

export const PAGES = ["home", "inbox", "tasks", "plugins", "memory"] as const
export type Page = (typeof PAGES)[number]

const LINK = "inline-grid place-items-center rounded-control border border-transparent px-2.5 py-[7px] text-[15px] leading-none font-medium whitespace-nowrap cursor-pointer"

export function Nav(props: { page: Page; onPage: (page: Page) => void; live: boolean }): React.JSX.Element {
  return (
    <nav className="mx-auto flex w-full max-w-[880px] items-center gap-6 px-6 pt-5 max-[720px]:px-4">
      <span className="font-display text-[32px] leading-none tracking-[-0.01em] text-fg uppercase">Miles</span>
      <div className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {PAGES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => props.onPage(name)}
            className={cn(
              LINK,
              props.page === name
                ? "bg-ink text-on-light "
                : "bg-transparent text-ink-dim hover:bg-surface hover:text-ink ",
            )}
          >
            {name}
          </button>
        ))}
        <span className={LINK} aria-label={props.live ? "connected" : "offline"} title={props.live ? "connected" : "offline"}>
          <Dot on={props.live} />
        </span>
      </div>
    </nav>
  )
}

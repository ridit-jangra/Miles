import { Plus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "../lib/cn"
import { useWorkspace, type PaneNode, type Zone } from "../lib/workspace"
import { Inbox } from "../pages/Inbox"
import { Memory } from "../pages/Memory"
import { Plugins } from "../pages/Plugins"
import { Settings } from "../pages/Settings"
import { Tasks } from "../pages/Tasks"
import { ICONS, PAGES, type Page } from "./Nav"
import { Stage } from "./Stage"

const TAB_BAR = 48 // px, dropping on the tab bar always adds a tab
const EDGE = 0.25 // within this share of the pane from an edge, a drop splits instead

const HIGHLIGHT: Record<Zone, string> = {
  center: "inset-0",
  left: "inset-y-0 left-0 w-1/2",
  right: "inset-y-0 right-0 w-1/2",
  top: "inset-x-0 top-0 h-1/2",
  bottom: "inset-x-0 bottom-0 h-1/2",
}

function PageView({ page }: { page: Page }): React.JSX.Element {
  if (page === "home") return <Stage />
  let body: React.JSX.Element
  switch (page) {
    case "inbox":
      body = <Inbox />
      break
    case "tasks":
      body = <Tasks />
      break
    case "plugins":
      body = <Plugins />
      break
    case "memory":
      body = <Memory />
      break
    default:
      body = <Settings />
  }
  return <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden px-5 py-5">{body}</div>
}

// the "+" in a pane's tab bar: pick a page to open here (a page that's open elsewhere moves here)
function AddTab({ pane }: { pane: PaneNode }): React.JSX.Element {
  const ws = useWorkspace()
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!at) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setAt(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [at])

  const choices = PAGES.filter((page) => !pane.tabs.includes(page))

  return (
    <>
      <button
        type="button"
        aria-label="add tab"
        aria-expanded={at !== null}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setAt(at ? null : { x: Math.min(rect.left, window.innerWidth - 200), y: rect.bottom + 4 })
        }}
        className="my-2 grid size-8 shrink-0 cursor-pointer place-items-center rounded-control text-ink-dim outline-none transition-colors duration-120 hover:bg-lift hover:text-ink focus-visible:bg-lift focus-visible:text-ink"
      >
        <Plus size={16} />
      </button>
      {at && (
        <>
          <div className="fixed inset-0 z-[400]" onPointerDown={() => setAt(null)} />
          <div role="menu" style={{ left: at.x, top: at.y }} className="fixed z-[401] min-w-44 rounded-control border border-edge bg-[#121214] p-1">
            {choices.length === 0 && <p className="m-0 px-3 py-2 text-note text-ink-dim">everything is open here</p>}
            {choices.map((page) => {
              const Icon = ICONS[page]
              return (
                <button
                  key={page}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    ws.drop(page, pane.id, "center")
                    setAt(null)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-left font-display text-[15px] text-ink outline-none transition-colors duration-120 hover:bg-lift focus-visible:bg-lift"
                >
                  <Icon size={15} />
                  {page}
                  {ws.open.includes(page) && <span className="ml-auto pl-4 text-note text-ink-dim">move here</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

export function Pane({ pane }: { pane: PaneNode }): React.JSX.Element {
  const ws = useWorkspace()
  const box = useRef<HTMLElement>(null)
  const [zone, setZone] = useState<Zone | null>(null)
  const [bar, setBar] = useState<{ index: number; left: number } | null>(null)

  const zoneAt = (event: React.DragEvent): Zone => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return "center"
    if (event.clientY - rect.top < TAB_BAR) return "center"
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    const gaps: [Zone, number][] = [
      ["left", x],
      ["right", 1 - x],
      ["top", y],
      ["bottom", 1 - y],
    ]
    const [nearest, gap] = gaps.reduce((a, b) => (b[1] < a[1] ? b : a))
    return gap > EDGE ? "center" : nearest
  }

  // which gap between tabs the pointer is over, and where to draw the insertion line
  const slotAt = (clientX: number): { index: number; left: number } => {
    const rect = box.current?.getBoundingClientRect()
    const tabs = Array.from(box.current?.querySelectorAll<HTMLElement>("[data-tab]") ?? [])
    if (!rect || tabs.length === 0) return { index: 0, left: 12 }
    let index = tabs.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return clientX < r.left + r.width / 2
    })
    if (index === -1) index = tabs.length
    const edge = index < tabs.length ? tabs[index].getBoundingClientRect().left - 4 : tabs[tabs.length - 1].getBoundingClientRect().right + 4
    return { index, left: edge - rect.left - 1 }
  }

  // over the tab bar a drop picks a slot between tabs, anywhere else it uses the zone
  const aim = (event: React.DragEvent): { zone: Zone; slot: { index: number; left: number } | null } => {
    const next = zoneAt(event)
    const rect = box.current?.getBoundingClientRect()
    const inBar = next === "center" && rect !== undefined && event.clientY - rect.top < TAB_BAR
    return { zone: next, slot: inBar ? slotAt(event.clientX) : null }
  }

  return (
    <section ref={box} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-control border border-line">
      <header className="flex h-12 shrink-0 items-stretch gap-2 border-b border-edge px-3">
        <div role="tablist" className="flex min-w-0 items-stretch gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {pane.tabs.map((tab) => {
          const Icon = ICONS[tab]
          const active = tab === pane.active
          return (
            <div
              key={tab}
              role="tab"
              data-tab
              aria-selected={active}
              draggable
              onClick={() => ws.setActive(pane.id, tab)}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", tab)
                event.dataTransfer.effectAllowed = "move"
                setTimeout(() => ws.setDragging(tab), 0)
              }}
              onDragEnd={() => ws.setDragging(null)}
              className={cn(
                "group my-2 flex cursor-pointer items-center gap-2 rounded-control px-3 font-display text-[15px] whitespace-nowrap transition-colors duration-120",
                active ? "bg-lift text-ink" : "text-ink-dim hover:text-ink",
              )}
            >
              <Icon size={15} />
              {tab}
              {ws.count > 1 && (
                <button
                  type="button"
                  aria-label={`close ${tab}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    ws.close(tab)
                  }}
                  className={cn(
                    "-mr-1 grid size-5 cursor-pointer place-items-center rounded-control text-ink-dim outline-none transition-opacity duration-120 hover:text-ink focus-visible:opacity-100",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )
        })}
        </div>
        <AddTab pane={pane} />
      </header>

      <div className="min-h-0 flex-1">
        <PageView page={pane.active} />
      </div>

      {ws.dragging && (
        <div
          className="absolute inset-0 z-30"
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = "move"
            const target = aim(event)
            setZone(target.zone)
            setBar(target.slot)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) return
            setZone(null)
            setBar(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            const target = aim(event)
            if (ws.dragging) ws.drop(ws.dragging, pane.id, target.zone, target.slot?.index)
            setZone(null)
            setBar(null)
            ws.setDragging(null)
          }}
        >
          {bar ? (
            <div className="pointer-events-none absolute top-2 h-8 w-0.5 rounded-full bg-ink" style={{ left: bar.left }} />
          ) : (
            zone && <div className={cn("pointer-events-none absolute rounded-control border border-ink/60 bg-ink/15 transition-all duration-120", HIGHLIGHT[zone])} />
          )}
        </div>
      )}
    </section>
  )
}

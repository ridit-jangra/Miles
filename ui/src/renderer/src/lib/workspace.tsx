import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react"

import { PAGES, type Page } from "../components/Nav"

// The screen is a tree: a pane holds tabs, a split holds panes (or more splits) side by side.
// Every page lives in at most one tab, because the voice state is shared.

export type Zone = "center" | "left" | "right" | "top" | "bottom"
export type PaneNode = { kind: "pane"; id: string; tabs: Page[]; active: Page }
export type SplitNode = { kind: "split"; id: string; dir: "row" | "col"; sizes: number[]; children: Layout[] }
export type Layout = PaneNode | SplitNode

const KEY = "miles.workspace.v2"

export const MIN_PANE = 0.12

let counter = 0
const uid = (): string => `n${Date.now().toString(36)}${counter++}`

const makePane = (page: Page): PaneNode => ({ kind: "pane", id: uid(), tabs: [page], active: page })

function defaultLayout(): Layout {
  return makePane("home")
}

export function pagesIn(node: Layout): Page[] {
  return node.kind === "pane" ? node.tabs : node.children.flatMap(pagesIn)
}

function findPane(node: Layout, match: (pane: PaneNode) => boolean): PaneNode | null {
  if (node.kind === "pane") return match(node) ? node : null
  for (const child of node.children) {
    const found = findPane(child, match)
    if (found) return found
  }
  return null
}

function mapPane(node: Layout, id: string, change: (pane: PaneNode) => PaneNode): Layout {
  if (node.kind === "pane") return node.id === id ? change(node) : node
  return { ...node, children: node.children.map((child) => mapPane(child, id, change)) }
}

// take a page out of the tree; empty panes disappear and a split with one child collapses
function remove(node: Layout, page: Page): Layout | null {
  if (node.kind === "pane") {
    if (!node.tabs.includes(page)) return node
    const tabs = node.tabs.filter((tab) => tab !== page)
    if (tabs.length === 0) return null
    const active = node.active === page ? tabs[Math.min(node.tabs.indexOf(page), tabs.length - 1)] : node.active
    return { ...node, tabs, active }
  }
  const kept: { child: Layout; size: number }[] = []
  node.children.forEach((child, i) => {
    const next = remove(child, page)
    if (next) kept.push({ child: next, size: node.sizes[i] })
  })
  if (kept.length === 0) return null
  if (kept.length === 1) return kept[0].child
  const total = kept.reduce((sum, k) => sum + k.size, 0)
  return { ...node, children: kept.map((k) => k.child), sizes: kept.map((k) => k.size / total) }
}

// a split inside a split of the same direction is just more siblings
function flatten(node: Layout): Layout {
  if (node.kind === "pane") return node
  const children: Layout[] = []
  const sizes: number[] = []
  node.children.map(flatten).forEach((child, i) => {
    if (child.kind === "split" && child.dir === node.dir) {
      child.children.forEach((inner, j) => {
        children.push(inner)
        sizes.push(child.sizes[j] * node.sizes[i])
      })
    } else {
      children.push(child)
      sizes.push(node.sizes[i])
    }
  })
  return { ...node, children, sizes }
}

function insert(node: Layout, targetId: string, page: Page, zone: Zone, index?: number): Layout {
  if (node.kind === "pane") {
    if (node.id !== targetId) return node
    if (zone === "center") {
      const tabs = [...node.tabs]
      tabs.splice(index ?? tabs.length, 0, page)
      return { ...node, tabs, active: page }
    }
    const fresh = makePane(page)
    const before = zone === "left" || zone === "top"
    return {
      kind: "split",
      id: uid(),
      dir: zone === "left" || zone === "right" ? "row" : "col",
      sizes: [0.5, 0.5],
      children: before ? [fresh, node] : [node, fresh],
    }
  }
  return { ...node, children: node.children.map((child) => insert(child, targetId, page, zone, index)) }
}

type Action =
  | { type: "drop"; page: Page; target: string; zone: Zone; index?: number }
  | { type: "close"; page: Page }
  | { type: "active"; pane: string; page: Page }
  | { type: "sizes"; split: string; sizes: number[] }

function withSizes(node: Layout, id: string, sizes: number[]): Layout {
  if (node.kind === "pane") return node
  if (node.id === id) return { ...node, sizes }
  return { ...node, children: node.children.map((child) => withSizes(child, id, sizes)) }
}

function reduce(root: Layout, action: Action): Layout {
  switch (action.type) {
    case "drop": {
      const target = findPane(root, (p) => p.id === action.target)
      if (!target) return root
      const alone = target.tabs.length === 1 && target.tabs[0] === action.page
      if (alone) return root // dropping a pane's only tab on itself changes nothing
      if (action.zone === "center" && target.tabs.includes(action.page)) {
        const wanted = action.index
        if (wanted === undefined) return mapPane(root, target.id, (p) => ({ ...p, active: action.page }))
        // reorder inside the pane: wanted is a slot in the old list, so it shifts left once the tab is lifted out
        return mapPane(root, target.id, (p) => {
          const from = p.tabs.indexOf(action.page)
          const tabs = p.tabs.filter((tab) => tab !== action.page)
          tabs.splice(from < wanted ? wanted - 1 : wanted, 0, action.page)
          return { ...p, tabs, active: action.page }
        })
      }
      const without = remove(root, action.page)
      if (!without) return root
      return flatten(insert(without, target.id, action.page, action.zone, action.index))
    }
    case "close": {
      const next = remove(root, action.page)
      return next ? flatten(next) : root // the last tab stays
    }
    case "active":
      return mapPane(root, action.pane, (p) => ({ ...p, active: action.page }))
    case "sizes":
      return withSizes(root, action.split, action.sizes)
  }
}

function valid(node: unknown): node is Layout {
  if (!node || typeof node !== "object") return false
  const n = node as Record<string, unknown>
  if (typeof n.id !== "string") return false
  if (n.kind === "pane") {
    return (
      Array.isArray(n.tabs) &&
      n.tabs.length > 0 &&
      n.tabs.every((t) => (PAGES as readonly string[]).includes(t as string)) &&
      (n.tabs as string[]).includes(n.active as string)
    )
  }
  if (n.kind === "split") {
    return (
      (n.dir === "row" || n.dir === "col") &&
      Array.isArray(n.children) &&
      n.children.length >= 2 &&
      Array.isArray(n.sizes) &&
      n.sizes.length === n.children.length &&
      n.sizes.every((s) => typeof s === "number" && s > 0) &&
      n.children.every(valid)
    )
  }
  return false
}

function load(): Layout {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null")
    if (valid(saved)) {
      const all = pagesIn(saved)
      if (new Set(all).size === all.length) return saved
    }
  } catch {
    // no storage or bad data, start fresh
  }
  return defaultLayout()
}

type Workspace = {
  root: Layout
  open: Page[]
  count: number
  dragging: Page | null
  setDragging: (page: Page | null) => void
  drop: (page: Page, target: string, zone: Zone, index?: number) => void
  close: (page: Page) => void
  setActive: (pane: string, page: Page) => void
  resize: (split: string, sizes: number[]) => void
}

const Context = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const value = useContext(Context)
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return value
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [root, dispatch] = useReducer(reduce, undefined, load)
  const [dragging, setDragging] = useState<Page | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(root))
    } catch {
      // not saved, the layout just won't survive a restart
    }
  }, [root])

  // a drop can remove the element that started the drag, so don't rely on its dragend alone
  useEffect(() => {
    const clear = (): void => setDragging(null)
    window.addEventListener("dragend", clear)
    window.addEventListener("drop", clear)
    return () => {
      window.removeEventListener("dragend", clear)
      window.removeEventListener("drop", clear)
    }
  }, [])

  const drop = useCallback(
    (page: Page, target: string, zone: Zone, index?: number) => dispatch({ type: "drop", page, target, zone, index }),
    [],
  )
  const close = useCallback((page: Page) => dispatch({ type: "close", page }), [])
  const setActive = useCallback((pane: string, page: Page) => dispatch({ type: "active", pane, page }), [])
  const resize = useCallback((split: string, sizes: number[]) => dispatch({ type: "sizes", split, sizes }), [])

  const value = useMemo<Workspace>(
    () => {
      const open = pagesIn(root)
      return { root, open, count: open.length, dragging, setDragging, drop, close, setActive, resize }
    },
    [root, dragging, drop, close, setActive, resize],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

import { Fragment, useRef } from "react"

import { cn } from "../lib/cn"
import { MIN_PANE, useWorkspace, type Layout, type SplitNode } from "../lib/workspace"
import { Pane } from "./Pane"

function Divider(props: { split: SplitNode; index: number; box: React.RefObject<HTMLDivElement | null> }): React.JSX.Element {
  const ws = useWorkspace()
  const row = props.split.dir === "row"

  const onDown = (event: React.PointerEvent): void => {
    event.preventDefault()
    const el = props.box.current
    if (!el) return
    const total = row ? el.clientWidth : el.clientHeight
    const start = row ? event.clientX : event.clientY
    const base = props.split.sizes
    const pair = base[props.index] + base[props.index + 1]

    const move = (e: PointerEvent): void => {
      const delta = ((row ? e.clientX : e.clientY) - start) / total
      const first = Math.min(pair - MIN_PANE, Math.max(MIN_PANE, base[props.index] + delta))
      const sizes = [...base]
      sizes[props.index] = first
      sizes[props.index + 1] = pair - first
      ws.resize(props.split.id, sizes)
    }
    const up = (): void => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div
      role="separator"
      aria-orientation={row ? "vertical" : "horizontal"}
      onPointerDown={onDown}
      className={cn(
        "relative shrink-0 touch-none before:absolute before:bg-edge before:transition-colors before:duration-120 before:content-[''] hover:before:bg-ink-mid",
        row
          ? "w-2 cursor-col-resize before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2"
          : "h-2 cursor-row-resize before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2",
      )}
    />
  )
}

function SplitView({ split }: { split: SplitNode }): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  return (
    <div ref={box} className={cn("flex h-full w-full min-h-0 min-w-0", split.dir === "row" ? "flex-row" : "flex-col")}>
      {split.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && <Divider split={split} index={i - 1} box={box} />}
          <div style={{ flex: `${split.sizes[i]} 1 0` }} className="min-h-0 min-w-0">
            <NodeView node={child} />
          </div>
        </Fragment>
      ))}
    </div>
  )
}

function NodeView({ node }: { node: Layout }): React.JSX.Element {
  return node.kind === "pane" ? <Pane pane={node} /> : <SplitView split={node} />
}

export function Workspace(): React.JSX.Element {
  const { root } = useWorkspace()
  return <NodeView node={root} />
}

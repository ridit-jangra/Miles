import type { ServerStatus } from "../lib/server"
import { AsciiField } from "./AsciiField"
import { Note, PageTitle } from "./ui"

export function Loading({ status }: { status: ServerStatus }): React.JSX.Element {
  const failed = status.state === "error"

  return (
    <div className="grid h-dvh place-items-center px-6 text-center z-1000 absolute left-[50%] translate-x-[-50%]">
      <AsciiField />
      <PageTitle>
        Starting background server
      </PageTitle>
      <div className="flex max-w-xl flex-col gap-3">
        <Note>
          {failed ? "Miles could not start" : status.text}
        </Note>
        {failed && (
          <pre className="whitespace-pre-wrap text-left text-xs text-ink-dim">
            {status.text}
          </pre>
        )}
      </div>
    </div>
  )
}

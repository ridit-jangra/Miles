export type Alert = { id: number; source: string; text: string; priority: "urgent" | "normal"; when: string }
export type Task = { id: string; agent: string; text: string; status: "running" | "done"; took: string }
export type PluginRow = { name: string; hint: string; state: "ready" | "missing" }

export const sampleAlerts: Alert[] = [
  { id: 1, source: "ysws", text: "Ticket #4 is at risk", priority: "urgent", when: "2m" },
  { id: 2, source: "ysws", text: "3 new players joined", priority: "normal", when: "14m" },
]

export const sampleTasks: Task[] = [
  { id: "t2", agent: "researcher", text: "compare Whisper model sizes", status: "running", took: "0:42" },
  { id: "t1", agent: "clock", text: "time in Tokyo", status: "done", took: "0:04" },
]

export const samplePlugins: PluginRow[] = [
  { name: "web", hint: "web_search, web_fetch · researcher agent", state: "ready" },
  { name: "time", hint: "MCP server · clock agent", state: "ready" },
  { name: "playwright", hint: "MCP server for browsing", state: "missing" },
]

export const sampleFacts: string[] = ["Learning Godot", "Prefers short answers", "Uses Arch Linux"]

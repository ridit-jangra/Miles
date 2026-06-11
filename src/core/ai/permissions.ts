export type PermissionDecision = 'allow' | 'allow_session' | 'deny'

const sessionAllowed = new Set<string>()

export function isSessionAllowed(toolName: string): boolean {
  return sessionAllowed.has(toolName)
}

export function allowInSession(toolName: string): void {
  sessionAllowed.add(toolName)
}

export const TOOLS_REQUIRING_PERMISSION = new Set([
  'FileWriteTool',
  'FileEditTool',
  'BashTool',
  'DownloadTool'
])

type PendingPermission = {
  resolve: (decision: PermissionDecision) => void
  toolName: string
  input: unknown
}

let pending: PendingPermission | null = null

export function requestPermission(toolName: string, input: unknown): Promise<PermissionDecision> {
  if (isSessionAllowed(toolName)) return Promise.resolve('allow')
  return Promise.resolve('allow')
}

type PermissionListener = (p: PendingPermission) => void
const permissionListeners: PermissionListener[] = []

export function onPermissionRequest(listener: PermissionListener) {
  permissionListeners.push(listener)
  return () => {
    const i = permissionListeners.indexOf(listener)
    if (i >= 0) permissionListeners.splice(i, 1)
  }
}

export function resolvePermission(decision: PermissionDecision): void {
  if (!pending) return
  if (decision === 'allow_session') allowInSession(pending.toolName)
  pending.resolve(decision)
  pending = null
}

import { writeFile } from 'fs/promises'
import { join } from 'path'
import * as dbus from 'dbus-next'
import { ECHO_BASE_DIR } from '../../../utils/env'

const SERVICE = 'org.echo.iris'
const OBJECT_PATH = '/org/echo/iris'
const SCRIPT_NAME = 'echo-iris'
const SCRIPT_FILE = join(ECHO_BASE_DIR, 'iris-kwin.js')

const KWIN_SCRIPT = `var tracked = null;
function report(w) {
  callDBus("${SERVICE}", "${OBJECT_PATH}", "${SERVICE}", "Report",
    w ? String(w.resourceClass || "") : "",
    w ? String(w.caption || "") : "");
}
function recap() { report(tracked); }
function hook(w) {
  if (tracked) { try { tracked.captionChanged.disconnect(recap); } catch (e) {} }
  tracked = w;
  if (w) { try { w.captionChanged.connect(recap); } catch (e) {} }
  report(w);
}
workspace.windowActivated.connect(hook);
hook(workspace.activeWindow);
`

export type ActiveWindow = { app: string | null; title: string | null }

type RemoteInterface = { [method: string]: (...args: unknown[]) => Promise<unknown> }

class ReportInterface extends dbus.interface.Interface {
  onReport: (app: string, title: string) => void = () => {}

  Report(app: string, title: string): void {
    this.onReport(app, title)
  }
}
ReportInterface.configureMembers({ methods: { Report: { inSignature: 'ss' } } })

async function getRemote(
  bus: dbus.MessageBus,
  path: string,
  iface: string
): Promise<RemoteInterface> {
  const obj = await bus.getProxyObject('org.kde.KWin', path)
  return obj.getInterface(iface) as unknown as RemoteInterface
}

export async function startKwinDetector(
  onActive: (w: ActiveWindow) => void
): Promise<(() => void) | null> {
  let bus: dbus.MessageBus | null = null
  try {
    bus = dbus.sessionBus()
    const iface = new ReportInterface(SERVICE)
    iface.onReport = (app, title) => onActive({ app: app || null, title: title || null })
    bus.export(OBJECT_PATH, iface)
    await bus.requestName(SERVICE, 0)

    await writeFile(SCRIPT_FILE, KWIN_SCRIPT, 'utf-8')

    const scripting = await getRemote(bus, '/Scripting', 'org.kde.kwin.Scripting')
    if (await scripting.isScriptLoaded(SCRIPT_NAME)) {
      await scripting.unloadScript(SCRIPT_NAME)
    }
    const reply = await bus.call(
      new dbus.Message({
        destination: 'org.kde.KWin',
        path: '/Scripting',
        interface: 'org.kde.kwin.Scripting',
        member: 'loadScript',
        signature: 'ss',
        body: [SCRIPT_FILE, SCRIPT_NAME]
      })
    )
    const id = Number(reply?.body?.[0])

    let script: RemoteInterface
    try {
      script = await getRemote(bus, `/Scripting/Script${id}`, 'org.kde.kwin.Script')
    } catch {
      script = await getRemote(bus, `/${id}`, 'org.kde.kwin.Script')
    }
    await script.run()

    const activeBus = bus
    return () => {
      void scripting.unloadScript(SCRIPT_NAME).catch(() => {})
      try {
        activeBus.disconnect()
      } catch {
        // already gone
      }
    }
  } catch (err) {
    console.error('[iris] kwin detector unavailable:', err)
    try {
      bus?.disconnect()
    } catch {
      // never connected
    }
    return null
  }
}

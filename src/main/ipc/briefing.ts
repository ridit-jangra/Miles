import { ipcMain } from 'electron'
import { BRIEFING_GET } from '../../shared/channels'
import { getBriefing } from '../../core/briefing'

ipcMain.handle(BRIEFING_GET, () => getBriefing())

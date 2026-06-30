import { MemoryEditTool } from '../tools/MemoryEditTool/tool'
import { MemoryReadTool } from '../tools/MemoryReadTool/tool'
import { MemoryWriteTool } from '../tools/MemoryWriteTool/tool'
import { ThinkTool } from '../tools/ThinkTool/tool'
import { HumanEditTool } from '../tools/HumanEditTool/tool'
import { SubagentTool } from '../tools/SubagentTool/tool'
import { CheckAgentsTool } from '../tools/CheckAgentsTool/tool'
import { SubscribeTool } from '../tools/SubscribeTool/tool'
import { PlanTool } from '../tools/PlanTool/tool'
import { ScreenshotTool } from '../tools/ScreenshotTool/tool'

export const agentTools = {
  MemoryReadTool,
  MemoryWriteTool,
  MemoryEditTool,
  ThinkTool,
  HumanEditTool,
  SubagentTool,
  CheckAgentsTool,
  SubscribeTool,
  PlanTool,
  ScreenshotTool
}

export const chatTools = {
  MemoryReadTool,
  HumanEditTool,
  ScreenshotTool
}

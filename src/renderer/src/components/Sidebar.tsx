import { HomeIcon, LucideIcon, NetworkIcon, Settings } from 'lucide-react'
import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip/tooltip'

interface SidebarProps {
  page: string
  setPage: (page: string) => void
}

interface SidebarButtonProps {
  setPage: (page: string) => void
  id: string
  Icon: LucideIcon
}

export function SidebarButton({ Icon, id, setPage }: SidebarButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          id={id}
          onClick={() => setPage(id)}
          className="flex items-center text-white/70 hover:text-white transition-colors cursor-pointer hover:bg-white/10 rounded-md p-2"
        >
          <Icon />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="text-[16px]">{id}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ setPage }: SidebarProps): React.JSX.Element {
  return (
    <div className="flex flex-col left-0 p-5 items-center justify-between h-screen absolute z-100 bg-white/3">
      <ul className="flex flex-col items-center gap-3 list-none">
        <SidebarButton setPage={setPage} id="Home" Icon={HomeIcon} />
        <SidebarButton setPage={setPage} id="Integrations" Icon={NetworkIcon} />
      </ul>
      <ul className="flex flex-col items-center gap-3 list-none">
        <SidebarButton setPage={setPage} id="Settings" Icon={Settings} />
      </ul>
    </div>
  )
}

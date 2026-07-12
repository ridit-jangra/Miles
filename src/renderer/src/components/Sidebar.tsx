import { HomeIcon, LucideIcon, NetworkIcon, SettingsIcon } from 'lucide-react'
import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip/tooltip'
import { cn } from '../lib/utils'

interface SidebarProps {
  page: string
  setPage: (page: string) => void
}

interface SidebarButtonProps {
  setPage: (page: string) => void
  id: string
  Icon: LucideIcon
  page: string
  fill?: string
}

export function SidebarButton({
  Icon,
  id,
  setPage,
  page,
  fill
}: SidebarButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          id={id}
          onClick={() => setPage(id)}
          className={cn(
            'flex items-center text-white/70 hover:text-white transition-colors cursor-pointer hover:bg-white/10 rounded-md p-2',
            page === id && 'text-white bg-white/10',
            'text-white'
          )}
        >
          <Icon size={26} fill={fill} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="text-[16px]">{id}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ setPage, page }: SidebarProps): React.JSX.Element {
  return (
    <div className="flex flex-col left-0 p-5 items-center justify-between h-screen absolute z-100 bg-white/3">
      <ul className="flex flex-col items-center gap-3 list-none justify-center h-full">
        <SidebarButton
          setPage={setPage}
          id="Home"
          Icon={HomeIcon}
          page={page}
          fill="currentColor"
        />
        <SidebarButton setPage={setPage} id="Integrations" Icon={NetworkIcon} page={page} />
        <SidebarButton setPage={setPage} id="Settings" Icon={SettingsIcon} page={page} />
      </ul>
    </div>
  )
}

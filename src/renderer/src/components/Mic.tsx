import React, { useEffect, useState } from 'react'

import PixelBlast from './PixlBlast'
import { Bed, MicIcon, PlayIcon, Square } from 'lucide-react'
import { SpokenCaption, useSona } from '../../../sona/renderer'
import { MCPConnectionStatus, MCPServerConfig } from '../../../shared/mcp'

export type MCPServerState = MCPServerConfig & {
  status: MCPConnectionStatus
  tools: string[]
  error?: string
}

export function Mic(): React.JSX.Element {
  const {
    listening,
    thinking,
    speaking,
    transcript,
    transcriptVisible,
    audioLevel,
    spokenText,
    spokenProgress,
    isPlaying,
    wake,
    sleep,
    stopSpeaking
  } = useSona()

  const [mcp, setMcp] = useState<MCPServerState[]>([])

  useEffect(() => {
    const getMcp = async (): Promise<void> => {
      setMcp(await window.mcp.list())
    }

    getMcp()
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 w-[30%] translate-x-[-50%] left-[50%]">
        <PixelBlast
          audioLevel={audioLevel}
          thinking={thinking}
          pixelSize={5}
          patternDensity={1.2}
          edgeFade={0}
          enableRipples={false}
        />
      </div>

      {mcp && (
        <div
          className="absolute top-4 left-30 pointer-events-none
                grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4
                gap-2 sm:gap-3
                w-[90vw] max-w-4xl"
        ></div>
      )}

      <div className="relative inset-0 z-10 flex h-full flex-col items-center pb-10 gap-4 pointer-events-none">
        {spokenText ? (
          <div className="absolute bottom-[20%] translate-y-[50%] pointer-events-none">
            <SpokenCaption text={spokenText} progress={spokenProgress} active={isPlaying.current} />
          </div>
        ) : (
          transcript && (
            <div
              className="absolute bottom-[20%] translate-y-[50%] pointer-events-none"
              style={{
                opacity: transcriptVisible ? 1 : 0,
                transition: 'opacity 0.5s ease-out'
              }}
            >
              <div className="max-w-[80vw] wrap-break-word whitespace-pre-wrap text-center font-mono text-2xl px-10 py-5 rounded-md bg-black/50 flex items-center gap-2">
                {transcript}
              </div>
            </div>
          )
        )}
        <div className="flex items-center px-10 py-4 rounded-md gap-10 bg-[#171717] absolute bottom-10">
          <button
            onClick={wake}
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            <MicIcon />
          </button>
          <button
            onClick={sleep}
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            <Bed />
          </button>
          <button
            onClick={speaking ? stopSpeaking : listening ? sleep : wake}
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            {speaking || listening ? <Square /> : <PlayIcon />}
          </button>
        </div>
      </div>
    </div>
  )
}

import { PipecatClient, RTVIEvent, type BotOutputData } from "@pipecat-ai/client-js"
import { PipecatClientAudio, PipecatClientProvider } from "@pipecat-ai/client-react"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

const SERVER = "http://localhost:7860"

export type Line = { id: number; who: "you" | "miles" | "tool"; text: string; segments?: Record<number, string> }
export type VoiceStatus = "offline" | "connecting" | "live"

type Voice = {
  status: VoiceStatus
  speaking: boolean
  thinking: boolean
  muted: boolean
  error: string | null
  lines: Line[]
  userText: string
  level: React.RefObject<number>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  toggleMute: () => void
}

const VoiceContext = createContext<Voice | null>(null)

export function useVoice(): Voice {
  const value = useContext(VoiceContext)
  if (!value) throw new Error("useVoice must be used inside VoiceProvider")
  return value
}

export function VoiceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = useState(
    () => new PipecatClient({ transport: new SmallWebRTCTransport(), enableMic: true, enableCam: false }),
  )
  const [status, setStatus] = useState<VoiceStatus>("offline")
  const [speaking, setSpeaking] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [userText, setUserText] = useState("")
  const level = useRef(0)
  const nextId = useRef(1)

  const push = useCallback((who: "you" | "tool", text: string) => {
    setLines((current) => [...current.slice(-40), { id: nextId.current++, who, text }])
  }, [])

  const pushBot = useCallback((data: BotOutputData) => {
    const key = data.segment_id ?? 0
    setLines((current) => {
      const last = current[current.length - 1]
      if (last && last.who === "miles") {
        const known = Object.entries(last.segments ?? {})
        if (known.some(([k, t]) => Number(k) !== key && t === data.text)) return current
        const segments = { ...(last.segments ?? {}), [key]: data.text }
        const text = Object.keys(segments)
          .map(Number)
          .sort((a, b) => a - b)
          .map((k) => segments[k])
          .join(" ")
        return [...current.slice(0, -1), { ...last, segments, text }]
      }
      return [...current.slice(-40), { id: nextId.current++, who: "miles", text: data.text, segments: { [key]: data.text } }]
    })
  }, [])

  useEffect(() => {
    const onConnected = (): void => setStatus("live")
    const onDisconnected = (): void => {
      setStatus("offline")
      setSpeaking(false)
      setThinking(false)
    }
    const onThinkStart = (): void => setThinking(true)
    const onBotStart = (): void => {
      setSpeaking(true)
      setThinking(false)
      setUserText("")
    }
    const onBotStop = (): void => {
      setSpeaking(false)
      level.current = 0
    }
    const onLevel = (value: number): void => {
      level.current = value
    }
    const onUser = (data: { text: string; final: boolean }): void => {
      const text = data.text.trim()
      if (!text) return
      setUserText(text)
      if (data.final) push("you", text)
    }
    const onBot = (data: BotOutputData): void => {
      if (data.text) pushBot(data)
    }
    const onTool = (data: { function_name?: string }): void => {
      if (data.function_name) push("tool", data.function_name)
    }
    const onError = (): void => setError("the connection hit an error")

    client.on(RTVIEvent.Connected, onConnected)
    client.on(RTVIEvent.Disconnected, onDisconnected)
    client.on(RTVIEvent.BotStartedSpeaking, onBotStart)
    client.on(RTVIEvent.BotStoppedSpeaking, onBotStop)
    client.on(RTVIEvent.UserTranscript, onUser)
    client.on(RTVIEvent.UserStoppedSpeaking, onThinkStart)
    client.on(RTVIEvent.BotLlmStarted, onThinkStart)
    client.on(RTVIEvent.RemoteAudioLevel, onLevel)
    client.on(RTVIEvent.BotOutput, onBot)
    client.on(RTVIEvent.LLMFunctionCall, onTool)
    client.on(RTVIEvent.Error, onError)
    return () => {
      client.off(RTVIEvent.Connected, onConnected)
      client.off(RTVIEvent.Disconnected, onDisconnected)
      client.off(RTVIEvent.BotStartedSpeaking, onBotStart)
      client.off(RTVIEvent.BotStoppedSpeaking, onBotStop)
      client.off(RTVIEvent.UserTranscript, onUser)
      client.off(RTVIEvent.UserStoppedSpeaking, onThinkStart)
      client.off(RTVIEvent.BotLlmStarted, onThinkStart)
      client.off(RTVIEvent.RemoteAudioLevel, onLevel)
      client.off(RTVIEvent.BotOutput, onBot)
      client.off(RTVIEvent.LLMFunctionCall, onTool)
      client.off(RTVIEvent.Error, onError)
    }
  }, [client, push, pushBot])

  const connect = useCallback(async () => {
    setError(null)
    setStatus("connecting")
    try {
      const response = (await client.startBot({
        endpoint: `${SERVER}/start`,
        requestData: { createDailyRoom: false, enableDefaultIceServers: true, transport: "webrtc" },
      })) as { sessionId: string }
      await client.connect({
        webrtcRequestParams: { endpoint: `${SERVER}/sessions/${response.sessionId}/api/offer` },
      })
    } catch (e) {
      setStatus("offline")
      setError(e instanceof Error ? e.message : "could not reach the server")
    }
  }, [client])

  const disconnect = useCallback(async () => {
    await client.disconnect()
    setStatus("offline")
  }, [client])

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      client.enableMic(current)
      return !current
    })
  }, [client])

  const value = useMemo<Voice>(
    () => ({ status, speaking, thinking, muted, error, lines, userText, level, connect, disconnect, toggleMute }),
    [status, speaking, thinking, muted, error, lines, userText, level, connect, disconnect, toggleMute],
  )

  return (
    <PipecatClientProvider client={client}>
      <VoiceContext.Provider value={value}>
        {children}
        <PipecatClientAudio />
      </VoiceContext.Provider>
    </PipecatClientProvider>
  )
}

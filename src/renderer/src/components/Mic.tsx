/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { synthesize, playClip } from '../utils/speak'
import PixelBlast from './PixlBlast'
import { extractSpeakable } from '../utils/extractSpeakables'
import { Bed, MicIcon, PlayIcon, Square } from 'lucide-react'
import { SpokenCaption } from './SpokenCaption'
import { MCPConnectionStatus, MCPServerConfig } from '../../../shared/mcp'

export type MCPServerState = MCPServerConfig & {
  status: MCPConnectionStatus
  tools: string[]
  error?: string
}

const MIN_SPEECH_MS = 150

const HALLUCINATION_PATTERNS = [
  /^(uh+|um+|hm+|hmm+|ah+|eh+)\.?$/i,
  /^thank you\.?$/i,
  /^thanks for watching\.?$/i,
  /^\s*[.,!?]+\s*$/,
  /^[^a-zA-Z0-9]*$/
]

function isGarbage(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true

  return HALLUCINATION_PATTERNS.some((re) => re.test(trimmed))
}

export function Mic(): React.JSX.Element {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [transcriptVisible, setTranscriptVisible] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [spokenText, setSpokenText] = useState('')
  const [spokenProgress, setSpokenProgress] = useState(0)
  const [mcp, setMcp] = useState<MCPServerState[]>([])

  const [thinking, setThinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const isProcessing = useRef(false)
  const transcriptFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listeningRef = useRef(false)

  const continuousMode = useRef(false)

  const queue = useRef<{ text: string; onDone?: () => void; audio: Promise<ArrayBuffer | null> }[]>(
    []
  )
  const isPlaying = useRef(false)

  const speakAbort = useRef<AbortController | null>(null)

  const genRef = useRef(0)

  useEffect(() => {
    listeningRef.current = listening
  }, [listening])

  const showTranscript = useCallback((text: string) => {
    if (transcriptFadeTimer.current) {
      clearTimeout(transcriptFadeTimer.current)
      transcriptFadeTimer.current = null
    }
    setTranscript(text)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTranscriptVisible(true))
    })
  }, [])

  const fadeOutTranscript = useCallback(() => {
    setTranscriptVisible(false)
    transcriptFadeTimer.current = setTimeout(() => {
      setTranscript('')
    }, 500)
  }, [])

  const startListeningRef = useRef<(() => Promise<void>) | null>(null)

  const stopSpeaking = useCallback((): void => {
    speakAbort.current?.abort()
    speakAbort.current = null
    queue.current = []
    isPlaying.current = false
    setSpeaking(false)
    setAudioLevel(0)
    setSpokenText('')
  }, [])

  const playNext = useCallback((): void => {
    if (isPlaying.current || queue.current.length === 0) return
    isPlaying.current = true
    setSpeaking(true)

    setThinking(false)
    const { text, onDone, audio } = queue.current.shift()!

    setSpokenText(text)
    setSpokenProgress(0)

    const controller = new AbortController()
    speakAbort.current = controller

    const finish = (): void => {
      setAudioLevel(0)
      isPlaying.current = false
      onDone?.()
      if (queue.current.length === 0) {
        setSpeaking(false)
        setTimeout(() => setSpokenText(''), 800)
        fadeOutTranscript()

        if (continuousMode.current) {
          setTimeout(() => {
            startListeningRef.current?.()
          }, 300)
        }
      } else {
        playNext()
      }
    }

    audio.then((audioData) => {
      if (controller.signal.aborted) return
      if (!audioData) {
        finish()
        return
      }
      playClip(audioData, {
        signal: controller.signal,
        onLevel: (level) => setAudioLevel(level),
        onProgress: (p) => setSpokenProgress(p),
        onEnded: finish
      })
    })
  }, [fadeOutTranscript])

  const speak = useCallback(
    (text: string, onDone?: () => void): void => {
      queue.current.push({ text, onDone, audio: synthesize(text) })
      if (!isPlaying.current) playNext()
    },
    [playNext]
  )

  useEffect(() => {
    const off = window.speak?.onSay((text: string) => {
      const trimmed = text?.trim()
      if (trimmed) speak(trimmed)
    })
    return off
  }, [speak])

  useEffect(() => {
    const getMcp = async (): Promise<void> => {
      setMcp(await window.mcp.list())
    }

    getMcp()
  }, [])

  useEffect(() => {
    return () => {
      if (transcriptFadeTimer.current) clearTimeout(transcriptFadeTimer.current)
      speakAbort.current?.abort()
    }
  }, [])

  const handleStreamComplete = useCallback(
    (_fullText: string, remainder: string) => {
      const leftover = remainder.trim()
      if (leftover) speak(leftover)
    },
    [speak]
  )

  const chatStreaming = useCallback(
    async (userText: string): Promise<void> => {
      const myGen = ++genRef.current
      let buffer = ''
      let spokenYet = false

      const removeListener = window.ai.onChunk((delta: string) => {
        if (genRef.current !== myGen) return
        buffer += delta
        const [sentences, remaining] = spokenYet
          ? extractSpeakable(buffer)
          : extractSpeakable(buffer, 3, 4)
        if (sentences) {
          speak(sentences)
          spokenYet = true
        }
        buffer = remaining
      })

      try {
        const fullText: string = await window.ai.chatStream(userText)
        removeListener()
        if (genRef.current === myGen) handleStreamComplete(fullText, buffer)
      } catch (e) {
        removeListener()

        setThinking(false)
        console.error('[Echo] streaming failed:', e)
      }
    },
    [speak, handleStreamComplete]
  )

  const startListening = useCallback(async (): Promise<void> => {
    if (isProcessing.current || listeningRef.current || isPlaying.current) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      console.error('[Echo] mic access denied')
      return
    }

    setTranscript('')
    setTranscriptVisible(false)

    mediaRecorder.current = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    })
    chunks.current = []

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data)
    }

    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    let silenceStart = Date.now()
    let spokenOnce = false
    let firstSoundAt = 0
    let lastSoundAt = 0

    const SILENCE_THRESHOLD_MS = 650

    const checkSilence = (): void => {
      analyser.getByteFrequencyData(data)
      const volume = data.reduce((a, b) => a + b, 0) / data.length

      if (volume > 12) {
        if (!spokenOnce) firstSoundAt = Date.now()
        spokenOnce = true
        lastSoundAt = Date.now()
        silenceStart = Date.now()
      } else if (spokenOnce && Date.now() - silenceStart > SILENCE_THRESHOLD_MS) {
        mediaRecorder.current?.stop()
        stream.getTracks().forEach((t) => t.stop())
        audioCtx.close()
        return
      }
      requestAnimationFrame(checkSilence)
    }
    requestAnimationFrame(checkSilence)

    mediaRecorder.current.onstop = async () => {
      isProcessing.current = true

      const speechMs = spokenOnce ? lastSoundAt - firstSoundAt : 0
      try {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        const result = await window.server.transcribe(arrayBuffer)
        const text = result.success ? (result.text?.trim() ?? '') : ''

        const tooShort = speechMs < MIN_SPEECH_MS
        if (!text || tooShort || isGarbage(text)) {
          console.log(
            '[Echo] ignored:',
            JSON.stringify(text),
            `(speech ${speechMs}ms${tooShort ? ', too short' : ''})`
          )
          if (continuousMode.current) {
            setTimeout(() => startListeningRef.current?.(), 200)
          }
          return
        }

        showTranscript(text)

        setThinking(true)
        chatStreaming(text)
      } catch (e) {
        console.error('[Echo] transcription failed:', e)
        setThinking(false)

        if (continuousMode.current) {
          setTimeout(() => startListeningRef.current?.(), 1000)
        }
      } finally {
        isProcessing.current = false
        setListening(false)
      }
    }

    mediaRecorder.current.start()
    setListening(true)
  }, [chatStreaming, showTranscript])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const stopListening = (): void => {
    continuousMode.current = false
    setThinking(false)
    mediaRecorder.current?.stop()
  }

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
            onClick={() => {
              continuousMode.current = true
              startListening()
            }}
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            <MicIcon />
          </button>
          <button
            onClick={() => {
              continuousMode.current = false
              setThinking(false)
              mediaRecorder.current?.stop()
            }}
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            <Bed />
          </button>
          <button
            onClick={
              speaking
                ? stopSpeaking
                : listening
                  ? stopListening
                  : () => {
                      continuousMode.current = true
                      startListening()
                    }
            }
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            {speaking || listening ? <Square /> : <PlayIcon />}
          </button>
        </div>
      </div>
    </div>
  )
}

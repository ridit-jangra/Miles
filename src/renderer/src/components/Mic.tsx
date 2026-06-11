/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SERVER_PORT } from '../../../shared/constants'

import { speak as speakAudio } from '../utils/speak'
import PixelBlast from './PixlBlast'
import { extractSpeakable } from '../utils/extractSpeakables'
import { Bed, MicIcon, PlayIcon, Square } from 'lucide-react'
import { SpokenCaption } from './SpokenCaption'

const MIN_SPEECH_MS = 400

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

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const isProcessing = useRef(false)
  const transcriptFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listeningRef = useRef(false)

  const continuousMode = useRef(false)

  const queue = useRef<{ text: string; onDone?: () => void }[]>([])
  const isPlaying = useRef(false)

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

  const playNext = useCallback((): void => {
    if (isPlaying.current || queue.current.length === 0) return
    isPlaying.current = true
    const { text, onDone } = queue.current.shift()!

    setSpokenText(text)
    setSpokenProgress(0)

    speakAudio(text, {
      onLevel: (level) => setAudioLevel(level),
      onProgress: (p) => setSpokenProgress(p),
      onEnded: () => {
        setAudioLevel(0)
        isPlaying.current = false
        onDone?.()
        if (queue.current.length === 0) {
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
    })
  }, [fadeOutTranscript])

  const speak = useCallback(
    (text: string, onDone?: () => void): void => {
      queue.current.push({ text, onDone })
      if (!isPlaying.current) playNext()
    },
    [playNext]
  )

  useEffect(() => {
    window.server.start()
  }, [])

  useEffect(() => {
    return () => {
      if (transcriptFadeTimer.current) clearTimeout(transcriptFadeTimer.current)
    }
  }, [])

  const handleStreamComplete = useCallback(
    (fullText: string, remainder: string) => {
      const leftover = remainder.trim()
      if (leftover) speak(leftover)
    },
    [speak]
  )

  const chatStreaming = useCallback(
    async (userText: string): Promise<void> => {
      let buffer = ''

      const removeListener = window.ai.onChunk((delta: string) => {
        buffer += delta
        const [sentences, remaining] = extractSpeakable(buffer)
        if (sentences) speak(sentences)
        buffer = remaining
      })

      try {
        const fullText: string = await window.ai.chatStream(userText)
        removeListener()
        handleStreamComplete(fullText, buffer)
      } catch (e) {
        removeListener()
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

    const SILENCE_THRESHOLD_MS = 1200

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
        chatStreaming(text)
      } catch (e) {
        console.error('[Echo] transcription failed:', e)

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
    mediaRecorder.current?.stop()
  }

  useEffect(() => {
    let ws: WebSocket
    let retryTimeout: ReturnType<typeof setTimeout>

    const connect = (): void => {
      ws = new WebSocket(`ws://127.0.0.1:${SERVER_PORT}/wake`)

      ws.onopen = () => console.log('[Echo] Wake word connected')

      ws.onmessage = (e) => {
        if (e.data !== 'wake') return
        if (isProcessing.current || listeningRef.current) return
        continuousMode.current = true
        speak('Yes sir', startListening)
      }

      ws.onerror = () => ws.close()
      ws.onclose = () => {
        retryTimeout = setTimeout(connect, 2000)
      }
    }

    retryTimeout = setTimeout(connect, 3000)

    return () => {
      clearTimeout(retryTimeout)
      ws?.close()
    }
  }, [startListening, speak])

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 w-[40%] translate-x-[-50%] left-[50%]">
        <PixelBlast
          audioLevel={audioLevel}
          pixelSize={5}
          patternDensity={1.2}
          edgeFade={0}
          enableRipples={false}
        />
      </div>
      <div className="relative inset-0 z-10 flex h-full flex-col items-center pb-10 gap-4 pointer-events-none">
        {spokenText ? (
          <div className="absolute bottom-[30%] translate-y-[50%] pointer-events-none">
            <SpokenCaption text={spokenText} progress={spokenProgress} active={isPlaying.current} />
          </div>
        ) : (
          transcript && (
            <div
              className="absolute bottom-[30%] translate-y-[50%] pointer-events-none"
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
        <div className="flex items-center px-10 py-3 rounded-md gap-10 bg-white/10 absolute bottom-10">
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
              mediaRecorder.current?.stop()
            }}
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            <Bed />
          </button>
          <button
            onClick={
              listening
                ? stopListening
                : () => {
                    continuousMode.current = true
                    startListening()
                  }
            }
            className="pointer-events-auto hover:text-white text-white/70 backdrop-blur transition-colors cursor-pointer"
          >
            {listening ? <Square /> : <PlayIcon />}
          </button>
        </div>
      </div>
    </div>
  )
}

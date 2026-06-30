/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { synthesize, playClip } from './speak'
import { extractSpeakable } from './extractSpeakables'

const MIN_SPEECH_MS = 150

const BARGE_THRESHOLD = 22
const BARGE_SUSTAIN_MS = 350
const BARGE_ARM_MS = 600

const SILENCE_THRESHOLD_MS = 650

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

export interface Sona {
  listening: boolean
  thinking: boolean
  speaking: boolean
  transcript: string
  transcriptVisible: boolean
  audioLevel: number
  spokenText: string
  spokenProgress: number
  isPlaying: RefObject<boolean>
  wake: () => void
  sleep: () => void
  stopSpeaking: () => void
}

export function useSona(): Sona {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [transcriptVisible, setTranscriptVisible] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [spokenText, setSpokenText] = useState('')
  const [spokenProgress, setSpokenProgress] = useState(0)

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

  const bargeStream = useRef<MediaStream | null>(null)
  const bargeCtx = useRef<AudioContext | null>(null)
  const bargeRaf = useRef(0)
  const bargeWanted = useRef(false)

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

  const stopBargeMonitor = useCallback((): void => {
    bargeWanted.current = false
    if (bargeRaf.current) cancelAnimationFrame(bargeRaf.current)
    bargeRaf.current = 0
    bargeStream.current?.getTracks().forEach((t) => t.stop())
    bargeStream.current = null
    bargeCtx.current?.close()
    bargeCtx.current = null
  }, [])

  const stopSpeaking = useCallback((): void => {
    stopBargeMonitor()
    speakAbort.current?.abort()
    speakAbort.current = null
    queue.current = []
    isPlaying.current = false
    setSpeaking(false)
    setAudioLevel(0)
    setSpokenText('')
  }, [stopBargeMonitor])

  const startBargeMonitor = useCallback(async (): Promise<void> => {
    if (bargeCtx.current) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
      })
    } catch {
      return
    }

    if (!bargeWanted.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    bargeStream.current = stream
    const ctx = new AudioContext()
    bargeCtx.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const armAt = Date.now() + BARGE_ARM_MS
    let voiceStart = 0

    const tick = (): void => {
      if (!bargeCtx.current) return
      analyser.getByteFrequencyData(data)
      const volume = data.reduce((a, b) => a + b, 0) / data.length

      if (Date.now() >= armAt && volume > BARGE_THRESHOLD) {
        if (!voiceStart) voiceStart = Date.now()
        else if (Date.now() - voiceStart > BARGE_SUSTAIN_MS) {
          stopSpeaking()
          startListeningRef.current?.()
          return
        }
      } else {
        voiceStart = 0
      }
      bargeRaf.current = requestAnimationFrame(tick)
    }
    bargeRaf.current = requestAnimationFrame(tick)
  }, [stopSpeaking])

  const playNext = useCallback((): void => {
    if (isPlaying.current || queue.current.length === 0) return
    isPlaying.current = true
    setSpeaking(true)
    bargeWanted.current = true
    startBargeMonitor()

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
        stopBargeMonitor()
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
  }, [fadeOutTranscript, startBargeMonitor, stopBargeMonitor])

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
    return () => {
      if (transcriptFadeTimer.current) clearTimeout(transcriptFadeTimer.current)
      speakAbort.current?.abort()
      if (bargeRaf.current) cancelAnimationFrame(bargeRaf.current)
      bargeStream.current?.getTracks().forEach((t) => t.stop())
      bargeCtx.current?.close()
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

    genRef.current++
    setThinking(false)

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
        const tone = result.tone
        console.log(`[Echo] tone: ${tone ?? 'none'} — ${JSON.stringify(text)}`)

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
        bargeWanted.current = true
        startBargeMonitor()
        chatStreaming(tone && tone !== 'neutral' ? `[tone: ${tone}] ${text}` : text)
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
  }, [chatStreaming, showTranscript, startBargeMonitor])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const wake = useCallback((): void => {
    continuousMode.current = true
    startListening()
  }, [startListening])

  const sleep = useCallback((): void => {
    continuousMode.current = false
    setThinking(false)
    stopBargeMonitor()
    mediaRecorder.current?.stop()
  }, [stopBargeMonitor])

  return {
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
  }
}

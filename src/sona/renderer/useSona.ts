/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { synthesize } from './speak'
import { extractSpeakable } from './extractSpeakables'

const MIN_SPEECH_MS = 150

const BARGE_THRESHOLD = 22
const BARGE_SUSTAIN_MS = 350
const BARGE_ARM_MS = 600
const BARGE_DEBUG = true

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

  const playCtx = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const scheduleCursor = useRef(0)
  const scheduledSources = useRef<AudioBufferSourceNode[]>([])
  const timeline = useRef<{ text: string; start: number; end: number }[]>([])
  const levelRaf = useRef(0)
  const lastCaption = useRef('')
  const pumping = useRef(false)

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

  const ensureCtx = useCallback((): AudioContext => {
    if (!playCtx.current) {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.connect(ctx.destination)
      playCtx.current = ctx
      analyserRef.current = analyser
    }
    if (playCtx.current.state === 'suspended') void playCtx.current.resume()
    return playCtx.current
  }, [])

  const startLevelLoop = useCallback((): void => {
    if (levelRaf.current) return
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = (): void => {
      const ctx = playCtx.current
      if (!ctx || !analyserRef.current) {
        levelRaf.current = 0
        return
      }
      analyserRef.current.getByteFrequencyData(data)
      const volume = data.reduce((a, b) => a + b, 0) / data.length
      setAudioLevel(Math.min(volume / 80, 1))

      const now = ctx.currentTime
      const cur = timeline.current.find((f) => now >= f.start && now < f.end)
      if (cur) {
        if (cur.text !== lastCaption.current) {
          lastCaption.current = cur.text
          setSpokenText(cur.text)
        }
        setSpokenProgress(Math.min((now - cur.start) / (cur.end - cur.start), 1))
      }
      levelRaf.current = requestAnimationFrame(tick)
    }
    levelRaf.current = requestAnimationFrame(tick)
  }, [])

  const stopSpeaking = useCallback((): void => {
    stopBargeMonitor()
    queue.current = []
    scheduledSources.current.forEach((s) => {
      s.onended = null
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    })
    scheduledSources.current = []
    timeline.current = []
    scheduleCursor.current = 0
    lastCaption.current = ''
    pumping.current = false
    isPlaying.current = false
    if (levelRaf.current) cancelAnimationFrame(levelRaf.current)
    levelRaf.current = 0
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
    if (ctx.state === 'suspended') await ctx.resume()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const armAt = Date.now() + BARGE_ARM_MS
    let voiceStart = 0
    let lastLog = 0

    const tick = (): void => {
      if (!bargeCtx.current) return
      analyser.getByteFrequencyData(data)
      const volume = data.reduce((a, b) => a + b, 0) / data.length

      if (BARGE_DEBUG && Date.now() - lastLog > 200) {
        lastLog = Date.now()
        console.log(
          `[barge] vol=${volume.toFixed(1)} thr=${BARGE_THRESHOLD} armed=${Date.now() >= armAt} ctx=${ctx.state}`
        )
      }

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

  const endOfSpeech = useCallback((): void => {
    isPlaying.current = false
    scheduleCursor.current = 0
    timeline.current = []
    lastCaption.current = ''
    if (levelRaf.current) cancelAnimationFrame(levelRaf.current)
    levelRaf.current = 0
    stopBargeMonitor()
    setSpeaking(false)
    setAudioLevel(0)
    setSpokenProgress(1)
    setTimeout(() => setSpokenText(''), 800)
    fadeOutTranscript()

    if (continuousMode.current) {
      setTimeout(() => startListeningRef.current?.(), 300)
    }
  }, [fadeOutTranscript, stopBargeMonitor])

  const maybeEnd = useCallback((): void => {
    if (
      !pumping.current &&
      queue.current.length === 0 &&
      scheduledSources.current.length === 0 &&
      isPlaying.current
    ) {
      endOfSpeech()
    }
  }, [endOfSpeech])

  const pump = useCallback(async (): Promise<void> => {
    if (pumping.current) return
    pumping.current = true
    const ctx = ensureCtx()

    while (queue.current.length > 0) {
      const item = queue.current.shift()!

      let arr: ArrayBuffer | null = null
      try {
        arr = await item.audio
      } catch {
        arr = null
      }
      if (!isPlaying.current) {
        pumping.current = false
        return
      }
      if (!arr) {
        item.onDone?.()
        continue
      }

      let buf: AudioBuffer
      try {
        buf = await ctx.decodeAudioData(arr.slice(0))
      } catch {
        item.onDone?.()
        continue
      }
      if (!isPlaying.current) {
        pumping.current = false
        return
      }

      const startAt = Math.max(ctx.currentTime + 0.03, scheduleCursor.current)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(analyserRef.current!)
      src.start(startAt)
      scheduledSources.current.push(src)
      timeline.current.push({ text: item.text, start: startAt, end: startAt + buf.duration })
      scheduleCursor.current = startAt + buf.duration

      const onDone = item.onDone
      src.onended = (): void => {
        scheduledSources.current = scheduledSources.current.filter((s) => s !== src)
        onDone?.()
        maybeEnd()
      }
    }

    pumping.current = false
    maybeEnd()
  }, [ensureCtx, maybeEnd])

  const speak = useCallback(
    (text: string, onDone?: () => void): void => {
      queue.current.push({ text, onDone, audio: synthesize(text) })
      if (!isPlaying.current) {
        isPlaying.current = true
        setSpeaking(true)
        setThinking(false)
        bargeWanted.current = true
        startBargeMonitor()
        ensureCtx()
        startLevelLoop()
      }
      void pump()
    },
    [pump, startBargeMonitor, startLevelLoop, ensureCtx]
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
      if (levelRaf.current) cancelAnimationFrame(levelRaf.current)
      scheduledSources.current.forEach((s) => {
        s.onended = null
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
      })
      playCtx.current?.close()
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
        console.error('[Miles] streaming failed:', e)
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
      console.error('[Miles] mic access denied')
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
        console.log(`[Miles] tone: ${tone ?? 'none'} — ${JSON.stringify(text)}`)

        const tooShort = speechMs < MIN_SPEECH_MS
        if (!text || tooShort || isGarbage(text)) {
          console.log(
            '[Miles] ignored:',
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
        console.error('[Miles] transcription failed:', e)
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

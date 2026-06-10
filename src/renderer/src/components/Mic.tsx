import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SERVER_PORT } from '../../../shared/constants'
import { speak as speakAudio } from '../utils/speak'
import PixelBlast from './PixlBlast'

export function Mic(): React.JSX.Element {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const isProcessing = useRef(false)

  const queue = useRef<{ text: string; onDone?: () => void }[]>([])
  const isPlaying = useRef(false)

  const playNext = useCallback(async (): Promise<void> => {
    if (isPlaying.current || queue.current.length === 0) return
    isPlaying.current = true
    const { text, onDone } = queue.current.shift()!
    await speakAudio(text, {
      onLevel: (level) => setAudioLevel(level),
      onEnded: () => {
        setAudioLevel(0)
        isPlaying.current = false
        onDone?.()
        // eslint-disable-next-line react-hooks/immutability
        playNext()
      }
    })
  }, [])

  const speak = useCallback(
    (text: string, onDone?: () => void): void => {
      queue.current.push({ text, onDone })
      playNext()
    },
    [playNext]
  )

  useEffect(() => {
    window.server.start()
  }, [])

  const startListening = useCallback(async (): Promise<void> => {
    if (isProcessing.current || listening) return

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    setTranscript('')

    mediaRecorder.current = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    })
    chunks.current = []

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data)
    }

    // ── Silence detection (NOT updating audioLevel anymore) ──────────────
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let silenceStart = Date.now()
    let spokenOnce = false

    const checkSilence = (): void => {
      analyser.getByteFrequencyData(data)
      const volume = data.reduce((a, b) => a + b, 0) / data.length

      if (volume > 10) {
        spokenOnce = true
        silenceStart = Date.now()
      } else if (spokenOnce && Date.now() - silenceStart > 800) {
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

      try {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        const result = await window.server.transcribe(arrayBuffer)
        const text = result.success ? (result.text?.trim() ?? '') : ''

        console.log('[Echo] Transcript:', text)
        setTranscript(text)

        if (text) {
          const response = await window.ai.chat(text)
          console.log('[Echo] AI response:', response)
          speak(response)
        }
      } catch (e) {
        console.error('[Echo] transcription failed:', e)
      } finally {
        isProcessing.current = false
        setListening(false)
      }
    }

    mediaRecorder.current.start()
    setListening(true)
  }, [listening, speak])

  const stopListening = (): void => {
    mediaRecorder.current?.stop()
  }

  useEffect(() => {
    let ws: WebSocket
    let retryTimeout: ReturnType<typeof setTimeout>

    const connect = (): void => {
      ws = new WebSocket(`ws://127.0.0.1:${SERVER_PORT}/wake`)
      ws.onopen = () => console.log('[Echo] Wake word connected')
      ws.onmessage = (e) => {
        if (e.data === 'wake' && !isProcessing.current) {
          speak('Yes sir', startListening)
        }
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
    <div className="relative h-screen w-screen overflow-hidden ">
      <div className="absolute inset-0 w-[40%] translate-x-[-50%] left-[50%]">
        <PixelBlast
          audioLevel={audioLevel}
          pixelSize={5}
          patternDensity={1.2}
          edgeFade={0}
          enableRipples={false}
        />
      </div>
      <div className="absolute pt-50 inset-0 z-10 flex flex-col items-center justify-center gap-4 pointer-events-none">
        <button
          onClick={listening ? stopListening : startListening}
          className="pointer-events-auto px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur"
        >
          {listening ? 'Stop' : 'Start'}
        </button>
        {transcript && (
          <p className="text-white/80 text-sm max-w-md text-center px-4">{transcript}</p>
        )}
      </div>
    </div>
  )
}

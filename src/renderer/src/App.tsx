import { useCallback, useEffect } from 'react'
import { useState, useRef } from 'react'
import { SERVER_PORT } from '../../shared/constants'

function App(): React.JSX.Element {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])

  useEffect(() => {
    window.server.start()
  }, [])

  const startListening = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.current = new MediaRecorder(stream)
    chunks.current = []

    // silence detection
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    let silenceStart = Date.now()
    let speaking = false

    const checkSilence = (): void => {
      analyser.getByteFrequencyData(data)
      const volume = data.reduce((a, b) => a + b, 0) / data.length

      if (volume > 10) {
        speaking = true
        silenceStart = Date.now()
      } else if (speaking && Date.now() - silenceStart > 800) {
        mediaRecorder.current?.stop()
        stream.getTracks().forEach((t) => t.stop())
        audioCtx.close()
        return
      }
      requestAnimationFrame(checkSilence)
    }

    requestAnimationFrame(checkSilence)

    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data)
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'audio/wav' })
      const arrayBuffer = await blob.arrayBuffer()
      const result = await window.server.transcribe(arrayBuffer)
      if (result.success && result.text) {
        setTranscript(result.text)
        const tts = await window.server.speak(result.text)
        if (tts.success && tts.audio) {
          const audioBlob = new Blob([tts.audio], { type: 'audio/wav' })
          const url = URL.createObjectURL(audioBlob)
          const audio = new Audio(url)
          audio.play()
        }
      }
      setListening(false)
    }

    mediaRecorder.current.start()
    setListening(true)
  }, [])

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
        if (e.data === 'wake') startListening()
      }
      ws.onerror = () => {
        ws.close()
      }
      ws.onclose = () => {
        retryTimeout = setTimeout(connect, 2000)
      }
    }

    retryTimeout = setTimeout(connect, 3000)

    return () => {
      clearTimeout(retryTimeout)
      ws?.close()
    }
  }, [startListening])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Echo</h1>
      <button onClick={listening ? stopListening : startListening}>
        {listening ? 'Stop' : 'Start'}
      </button>
      {transcript && <p>{transcript}</p>}
    </div>
  )
}

export default App

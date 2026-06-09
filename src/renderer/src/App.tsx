import { useEffect } from 'react'
import { useState, useRef } from 'react'
import { SERVER_PORT, SERVER_URL } from '../../shared/constants'

function App(): React.JSX.Element {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])

  const startListening = async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.current = new MediaRecorder(stream)
    chunks.current = []

    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data)

    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'audio/wav' })
      const arrayBuffer = await blob.arrayBuffer()

      const result = await window.server.transcribe(arrayBuffer)
      if (result.success && result.text) {
        setTranscript(result.text)

        const tts = await window.server.speak(result.text)
        console.log(tts)
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
  }

  useEffect(() => {
    const ws = new WebSocket(`ws://${SERVER_URL.replace('http://', '')}:${SERVER_PORT}/wake`)
    ws.onmessage = (e) => {
      if (e.data === 'wake') startListening()
    }
    return () => ws.close()
  }, [])

  const stopListening = (): void => {
    mediaRecorder.current?.stop()
  }

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

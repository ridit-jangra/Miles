import { Mic } from './components/Mic'

function App(): React.JSX.Element {
  // const [transcript, setTranscript] = useState('')

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Echo</h1>
      <Mic />
    </div>
  )
}

export default App

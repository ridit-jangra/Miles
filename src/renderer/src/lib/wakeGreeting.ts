const USE_LIVE_CONTEXT = false
const WEATHER_API_KEY = window.env.WEATHER_API_KEY ?? ''
const NEWS_API_KEY = window.env.NEWS_API_KEY ?? ''
const WEATHER_LAT = 28.67
const WEATHER_LON = 77.41

const CONTEXT_SNIPPETS = [
  "It's looking like a productive day ahead.",
  'Markets opened slightly up this morning.',
  'No major alerts in your area.',
  'Your schedule looks clear for now.',
  'A good time to get things done.'
]

type Period = 'morning' | 'afternoon' | 'evening' | 'night'

const GREETINGS: Record<Period, string[]> = {
  morning: ['Good morning.', 'Morning — hope you slept well.', 'Rise and shine.'],
  afternoon: [
    'Good afternoon.',
    'Hey, afternoon already.',
    'Good to hear from you this afternoon.'
  ],
  evening: [
    'Good evening.',
    `Evening — how's the day been?`,
    'Good evening, what can I do for you?'
  ],
  night: [
    'Hey, burning the midnight oil?',
    'Still up? What do you need?',
    `Late night session — I'm here.`
  ]
}

function getPeriod(): Period {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function fetchWeatherLine(): Promise<string | null> {
  if (!WEATHER_API_KEY) return null
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&appid=${WEATHER_API_KEY}&units=metric`
    const res = await fetch(url)
    const json = (await res.json()) as {
      main: { temp: number }
      weather: { description: string }[]
    }
    const temp = Math.round(json.main.temp)
    const desc = json.weather[0]?.description ?? 'clear'
    return `It's ${temp}°C and ${desc} outside.`
  } catch {
    return null
  }
}

async function fetchHeadline(): Promise<string | null> {
  if (!NEWS_API_KEY) return null
  try {
    const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=1&apiKey=${NEWS_API_KEY}`
    const res = await fetch(url)
    const json = (await res.json()) as { articles: { title: string }[] }
    const title = json.articles?.[0]?.title
    return title ? `Top headline: ${title.split(' - ')[0]}.` : null
  } catch {
    return null
  }
}

async function fetchLiveContext(): Promise<string> {
  const [weather, headline] = await Promise.all([fetchWeatherLine(), fetchHeadline()])

  const parts: string[] = []
  if (weather) parts.push(weather)
  if (headline) parts.push(headline)
  if (!parts.length) parts.push(pick(CONTEXT_SNIPPETS))

  return parts.join(' ')
}

export async function buildWakeGreeting(): Promise<string> {
  const period = getPeriod()
  const salute = pick(GREETINGS[period])
  const context = USE_LIVE_CONTEXT ? await fetchLiveContext() : pick(CONTEXT_SNIPPETS)

  return `${salute} ${context}`
}

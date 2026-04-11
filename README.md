# @ridit/echo

A voice-enabled CLI for interacting with Milo using speech-to-text.

## Features

- 🎤 **Voice Input**: Record audio from your microphone
- 🤖 **Speech Recognition**: Transcribe speech using Replicate's incredibly-fast-whisper
- 💬 **Milo Integration**: Send transcribed text to Milo and get responses
- 🖥️ **TUI Interface**: Optional React-based terminal UI

## Prerequisites

1. **Bun runtime**: Install from [bun.sh](https://bun.sh)
2. **SoX (Sound eXchange)**: Required for audio recording
   - **Windows**: Download from [SoX download page](https://sourceforge.net/projects/sox/files/latest/download)
   - **macOS**: `brew install sox`
   - **Linux**: `sudo apt-get install sox libsox-fmt-all`
3. **Replicate API Token**: Get from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)

## Installation

```bash
bun install
```

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Replicate API token:
   ```
   REPLICATE_API_TOKEN=your_token_here
   ```

## Usage

### Voice Mode (Speech-to-Text)

Record audio, transcribe it, and chat with Milo:

```bash
bun run voice
```

Record for a specific duration (e.g., 10 seconds):

```bash
bun run voice 10
```

### TUI Mode (Terminal UI)

Run the React-based terminal interface:

```bash
bun start
```

## How It Works

1. **Recording**: Uses `node-record-lpcm16` with SoX to record WAV audio
2. **Transcription**: Sends audio to Replicate's `vaibhavs10/incredibly-fast-whisper` model
3. **Chat**: Sends transcribed text to Milo via `@ridit/dev` SDK
4. **Response**: Displays Milo's response in the terminal

## Project Structure

- `src/voice.ts` - Core voice STT functionality
- `src/voice-cli.ts` - CLI entry point for voice mode
- `src/index.tsx` - React TUI entry point
- `src/screens/REPL.tsx` - React component for TUI

## Environment Variables

- `REPLICATE_API_TOKEN` (required): Your Replicate API token
- `MILO_API_KEY` (optional): Milo API key if needed

## Troubleshooting

### "SoX is required for audio recording"
- Install SoX and ensure it's in your PATH
- On Windows, add SoX installation directory to System Path

### "No speech detected"
- Speak louder or increase recording duration
- Check microphone permissions

### "REPLICATE_API_TOKEN is required"
- Set the environment variable in `.env` file or shell

## License

MIT

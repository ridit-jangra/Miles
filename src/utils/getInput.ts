//@ts-ignore
import mic from "mic";
import * as readline from "readline";

const SILENCE = ["you", "thank you", "thanks", "bye", ".", "...", "the"];
const SILENCE_THRESHOLD = 500;
const SILENCE_DURATION = 1500;

function getRMS(buffer: Buffer): number {
  let sum = 0;
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const sample = buffer.readInt16LE(i);
    sum += sample * sample;
  }
  return Math.sqrt(sum / (buffer.length / 2));
}

function showVolumeBar(rms: number) {
  const bars = Math.min(20, Math.floor(rms / 100));
  const bar = "█".repeat(bars) + "░".repeat(20 - bars);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`🎙️  [${bar}]`);
}

export function getAudioEnergy(buffer: Buffer): number {
  let sum = 0;
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const sample = buffer.readInt16LE(i);
    sum += Math.abs(sample);
  }
  return sum / (buffer.length / 2);
}

export function recordUntilSilence(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let silenceTimer: NodeJS.Timeout | null = null;
    let started = false;

    const micInstance = mic({
      rate: "16000",
      channels: "1",
      bitwidth: "16",
      encoding: "signed-integer",
      fileType: "wav",
    });

    const stream = micInstance.getAudioStream();

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      const rms = getRMS(chunk);
      showVolumeBar(rms);

      if (rms > SILENCE_THRESHOLD) {
        started = true;
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      } else if (started) {
        if (!silenceTimer) {
          silenceTimer = setTimeout(() => {
            micInstance.stop();
          }, SILENCE_DURATION);
        }
      }
    });

    stream.on("error", reject);
    micInstance.start();
    setTimeout(() => micInstance.stop(), 15000);
    stream.on("stopComplete", () => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      resolve(Buffer.concat(chunks));
    });
  });
}

export function isJunk(text: string): boolean {
  const clean = text.trim().toLowerCase();
  return !clean || clean.length < 3 || SILENCE.includes(clean);
}

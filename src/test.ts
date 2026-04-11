// main.ts
import { ReplicateSTT } from "./utils/stt/replicate";
import * as readline from "readline";
import { chat } from "./utils/milo";
import { recordUntilSilence, isJunk, getAudioEnergy } from "./utils/getInput";
import { ReplicateTTS } from "./utils/tts/replicate";

const stt = new ReplicateSTT();
const tts = new ReplicateTTS();

console.log("🎙️  echo is listening...\n");

while (true) {
  const audio = await recordUntilSilence();

  const energy = getAudioEnergy(audio);
  if (energy < 100) continue;

  process.stdout.write("⏳ transcribing...");
  try {
    const text = await stt.transcribe(audio);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    if (isJunk(text)) continue;

    console.log(`you: ${text}`);
    const response = await chat(text);
    console.log(`milo: ${response}\n`);
    await tts.speak(response);
  } catch (e) {
    console.error("error:", e);
  }
}

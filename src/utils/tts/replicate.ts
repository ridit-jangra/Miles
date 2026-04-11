import Replicate from "replicate";
import type { TTSProvider } from "../../types";
import { exec } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export class ReplicateTTS implements TTSProvider {
  private client: Replicate;

  constructor() {
    this.client = new Replicate({
      baseUrl: "https://ai.hackclub.com/proxy/v1/replicate",
    });
  }

  async speak(text: string): Promise<void> {
    const output = (await this.client.run("minimax/speech-02-turbo", {
      input: {
        text,
        voice_id: "male-qn-qingse",
      },
    })) as any;

    // output is a URL or base64, download and play
    const audioUrl = typeof output === "string" ? output : output?.audio;
    if (!audioUrl) throw new Error("No audio output from TTS");

    const res = await fetch(audioUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpFile = join(tmpdir(), `echo-tts-${Date.now()}.mp3`);
    writeFileSync(tmpFile, buffer);

    await new Promise<void>((resolve, reject) => {
      // windows: use powershell to play audio
      exec(
        `powershell -c (New-Object Media.SoundPlayer).PlaySync()` +
          ` ; Add-Type -AssemblyName presentationCore ; $mp = [System.Windows.Media.MediaPlayer]::new() ; $mp.Open([uri]"${tmpFile}") ; $mp.Play() ; Start-Sleep -s 10`,
        (err) => {
          unlinkSync(tmpFile);
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }
}

import Replicate from "replicate";
import type { STTProvider } from "../../types";

export class ReplicateSTT implements STTProvider {
  private client: Replicate;

  constructor() {
    this.client = new Replicate({
      baseUrl: "https://ai.hackclub.com/proxy/v1/replicate",
    });
  }

  async transcribe(audio: Buffer): Promise<string> {
    const base64 = audio.toString("base64");
    const output = (await this.client.run(
      "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
      {
        input: {
          audio: `data:audio/wav;base64,${base64}`,
          batch_size: 64,
        },
      },
    )) as any;

    return output?.text ?? "";
  }
}

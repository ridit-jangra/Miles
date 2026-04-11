import type { STTProvider } from "../../types";

export class LocalSTT implements STTProvider {
  async transcribe(audio: Buffer): Promise<string> {
    throw new Error("Local STT not implemented yet — coming with @ridit/mira");
  }
}

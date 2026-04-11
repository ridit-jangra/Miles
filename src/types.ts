export interface STTProvider {
  transcribe(audio: Buffer): Promise<string>;
}

export interface TTSProvider {
  speak(text: string): Promise<void>;
}

import type { STTProvider } from "../../types";
import { ReplicateSTT } from "./replicate";
import { LocalSTT } from "./local";

export type STTProviderName = "replicate" | "local";

export function createSTT(
  provider: STTProviderName = "replicate",
): STTProvider {
  switch (provider) {
    case "replicate":
      return new ReplicateSTT();
    case "local":
      return new LocalSTT();
    default:
      throw new Error(`Unknown STT provider: ${provider}`);
  }
}

export type { STTProvider };

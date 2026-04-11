import { Milo } from "@ridit/dev";

let instance: Milo | null = null;

export async function getMilo(): Promise<Milo> {
  if (instance) return instance;
  // if (!(await Milo.isRunning())) await Milo.start();
  instance = new Milo("chat");
  await instance.connect();
  return instance;
}

export async function chat(prompt: string): Promise<string> {
  const milo = await getMilo();
  return milo.chat(prompt, (e) => {
    if (e.type === "tool_call") console.log("[tool_call]: ", e.toolName, e);
    if (e.type === "tool_result") console.log("[tool_result]: ", e.toolName, e);
    if (e.type === "permission_request")
      milo.resolvePermission(milo.getSessionId()!, "allow");
  });
}

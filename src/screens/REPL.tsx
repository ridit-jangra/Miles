import { Text } from "ink";
import { Milo } from "@ridit/dev";
import { useEffect, useState } from "react";

export function REPL() {
  const [msg, setMsg] = useState<string>("starting...");

  useEffect(() => {
    (async () => {
      try {
        // if (!(await Milo.isRunning())) await Milo.start();
        const milo = new Milo("chat");
        await milo.connect();
        const text = await milo.chat("Hey milo");
        setMsg(text);
      } catch (e) {
        setMsg(`error: ${e}`);
      }
    })();
  }, []);

  return <Text>echo: {msg}</Text>;
}

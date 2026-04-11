import { render } from "ink";
import { REPL } from "./screens/REPL";

const args = process.argv.slice(2);

if (args[0] === "serve") {
  const { serve } = await import("./server/serve");
  serve();
} else {
  render(<REPL />);
}

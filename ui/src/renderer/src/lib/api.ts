const BASE = "http://localhost:7860/api"

export const api = {
  get: <T,>(path: string): Promise<T> => fetch(BASE + path).then((r) => r.json()),
  post: (path: string, body?: unknown): Promise<Response> =>
    fetch(BASE + path, {
      method: "POST",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    }),
  del: (path: string): Promise<Response> => fetch(BASE + path, {method: "DELETE"})
}

export type Fact = {id: string, date: string, source: string, text: string}

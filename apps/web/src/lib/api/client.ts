import { config } from "../config";

/** JSON request to the Grow API; throws an Error carrying the API's message. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `API ${res.status}`;
    try {
      const body = await res.json();
      const m = body?.message;
      message = Array.isArray(m) ? m.join(", ") : (m ?? body?.error ?? message);
    } catch {
      message = `${message}: ${await res.text().catch(() => "")}`;
    }
    throw new Error(String(message));
  }
  return (await res.json()) as T;
}

/** POST a JSON body. */
export function post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "POST", body: JSON.stringify(body) });
}

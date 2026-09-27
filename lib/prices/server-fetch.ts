import https from "node:https";

/**
 * The Pokémon TCG API returns 500 to Node's global fetch (undici) from this
 * host, and answers node:https. Live price calls go through here so a working
 * source is not reported as a failure.
 */
function headerRecord(headers?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "CardScout/0.1",
  };
  if (!headers) return record;
  new Headers(headers).forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function request(
  url: URL,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("The operation was aborted due to timeout"));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function withRetries(
  run: () => Promise<{ status: number; text: string }>,
  attempts = 3,
): Promise<{ status: number; text: string }> {
  let last: { status: number; text: string } | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await run();
      last = response;
      if (!retryable(response.status)) return response;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  return last ?? { status: 0, text: "" };
}

export function serverGet(url: URL, headers?: HeadersInit, timeoutMs = 12_000): Promise<{ status: number; text: string }> {
  const record = headerRecord(headers);
  return withRetries(() => request(url, "GET", record, undefined, timeoutMs));
}

export function serverPost(
  url: URL,
  body: string,
  headers: HeadersInit,
  timeoutMs = 12_000,
): Promise<{ status: number; text: string }> {
  const record = headerRecord(headers);
  return withRetries(() => request(url, "POST", record, body, timeoutMs));
}

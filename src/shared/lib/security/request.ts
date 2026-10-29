export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || request.url).origin;
  return origin === expected;
}
export async function readJsonBody(
  request: Request,
  limit = 65536,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Requisição vazia.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new Error("Requisição muito grande.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

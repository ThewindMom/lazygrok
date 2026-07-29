import { describe, expect, test } from "bun:test"
import { PassThrough, Writable } from "node:stream"
import { readStdioJsonRpcMessages, writeStdioJsonRpcResponse } from "./transport.js"

describe("stdio JSON-RPC transport", () => {
  test("#given line-delimited JSON #when read #then it yields line-mode requests", async () => {
    const input = new PassThrough()
    input.end('{"jsonrpc":"2.0","id":1,"method":"ping"}\n')

    const messages = await collect(input)

    expect(messages).toEqual([
      {
        kind: "request",
        payload: { jsonrpc: "2.0", id: 1, method: "ping" },
        responseMode: "line",
      },
    ])
  })

  test("#given content-length JSON #when read #then it yields framed requests", async () => {
    const input = new PassThrough()
    const body = '{"jsonrpc":"2.0","id":2,"method":"initialize"}'
    input.end(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`)

    const messages = await collect(input)

    expect(messages).toEqual([
      {
        kind: "request",
        payload: { jsonrpc: "2.0", id: 2, method: "initialize" },
        responseMode: "framed",
      },
    ])
  })

  test("#given response mode #when written #then framing bytes are stable", async () => {
    const output = new PassThrough()
    const chunks: string[] = []
    output.on("data", (chunk: Buffer | string) => chunks.push(String(chunk)))

    await writeStdioJsonRpcResponse(output, { jsonrpc: "2.0", id: 1, result: {} }, "framed")

    expect(chunks.join("")).toBe('Content-Length: 36\r\n\r\n{"jsonrpc":"2.0","id":1,"result":{}}')
  })

  test("#given an oversized declared frame #when the header arrives #then it rejects without waiting for the body", async () => {
    const input = new PassThrough()
    input.end("Content-Length: 33\r\n\r\n")

    await expect(collect(input, { maxMessageBytes: 32 })).rejects.toThrow(/exceeds.*32 bytes/i)
  })

  test("#given a newline-free line exceeding the limit #when chunks arrive #then buffer growth is rejected", async () => {
    const input = new PassThrough()
    input.write(Buffer.alloc(20, 0x20))
    input.end(Buffer.alloc(13, 0x20))

    await expect(collect(input, { maxMessageBytes: 32 })).rejects.toThrow(/exceeds.*32 bytes/i)
  })

  test("#given a destroyed output with callback-only failure #when a response write rejects #then the error listener is removed", async () => {
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })
    output.destroy()

    await expect(writeStdioJsonRpcResponse(output, { jsonrpc: "2.0", id: 1, result: {} }, "line")).rejects.toMatchObject({
      code: "ERR_STREAM_DESTROYED",
    })
    await Promise.resolve()

    expect(output.listenerCount("error")).toBe(0)
  })
})

async function collect(input: PassThrough, limits?: { readonly maxMessageBytes: number }) {
  const messages = []
  for await (const message of readStdioJsonRpcMessages(input, limits)) {
    messages.push(message)
  }
  return messages
}

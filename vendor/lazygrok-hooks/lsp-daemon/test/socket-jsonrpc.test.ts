import { describe, expect, it } from "vitest";

import { createLineDecoder, encodeJsonLine } from "../src/socket-jsonrpc.js";

describe("socket json-rpc framing", () => {
	it("#given a message #when encodeJsonLine #then appends a newline", () => {
		expect(encodeJsonLine({ a: 1 })).toBe('{"a":1}\n');
	});

	it("#given chunks split mid-line #when push #then reassembles whole messages", () => {
		const received: unknown[] = [];
		const decoder = createLineDecoder((value) => received.push(value));
		decoder.push('{"id":1,"v":');
		decoder.push('"hello"}\n{"id":2}\n');
		expect(received).toEqual([{ id: 1, v: "hello" }, { id: 2 }]);
	});

	it("#given two messages in one chunk #when push #then emits both", () => {
		const received: unknown[] = [];
		const decoder = createLineDecoder((value) => received.push(value));
		decoder.push('{"a":1}\n{"b":2}\n');
		expect(received).toEqual([{ a: 1 }, { b: 2 }]);
	});

	it("#given a malformed line #when push #then reports parse error and keeps going", () => {
		const received: unknown[] = [];
		const errors: string[] = [];
		const decoder = createLineDecoder(
			(value) => received.push(value),
			(raw) => errors.push(raw),
		);
		decoder.push("not-json\n");
		decoder.push('{"ok":true}\n');
		expect(errors).toEqual(["not-json"]);
		expect(received).toEqual([{ ok: true }]);
	});

	it("#given blank lines #when push #then ignores them", () => {
		const received: unknown[] = [];
		const decoder = createLineDecoder((value) => received.push(value));
		decoder.push("\n  \n");
		expect(received).toEqual([]);
	});

	it("#given newline-free input exceeding the message limit #when pushed #then it rejects before retaining more bytes", () => {
		const decoder = createLineDecoder(() => {}, undefined, { maxMessageBytes: 32 });
		decoder.push(Buffer.alloc(20, 0x20));

		expect(() => decoder.push(Buffer.alloc(13, 0x20))).toThrow(/exceeds.*32 bytes/i);
	});

	it("#given an oversized complete line #when pushed #then it rejects before JSON parsing", () => {
		const decoder = createLineDecoder(() => {}, undefined, { maxMessageBytes: 32 });

		expect(() => decoder.push(`${JSON.stringify({ value: "x".repeat(40) })}\n`)).toThrow(/exceeds.*32 bytes/i);
	});
});

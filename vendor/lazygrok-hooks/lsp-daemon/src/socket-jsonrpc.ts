export function encodeJsonLine(message: unknown): string {
	return `${JSON.stringify(message)}\n`;
}

export interface LineDecoder {
	push(chunk: Buffer | string): void;
}

export interface LineDecoderOptions {
	readonly maxMessageBytes?: number;
}

export class JsonRpcLineTooLargeError extends Error {
	override readonly name = "JsonRpcLineTooLargeError";

	constructor(
		readonly actualBytes: number,
		readonly maxBytes: number,
	) {
		super(`JSON-RPC line exceeds ${maxBytes} bytes (received ${actualBytes} bytes)`);
	}
}

const DEFAULT_MAX_MESSAGE_BYTES = 8 * 1024 * 1024;

export function createLineDecoder(
	onMessage: (value: unknown) => void,
	onParseError?: (raw: string, error: unknown) => void,
	options: LineDecoderOptions = {},
): LineDecoder {
	let buffer = Buffer.alloc(0);
	let rejected = false;
	const maxMessageBytes = options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;

	const rejectOversized = (actualBytes: number): void => {
		buffer = Buffer.alloc(0);
		rejected = true;
		const error = new JsonRpcLineTooLargeError(actualBytes, maxMessageBytes);
		if (onParseError) {
			onParseError("", error);
			return;
		}
		throw error;
	};

	return {
		push(chunk: Buffer | string): void {
			if (rejected) return;
			const input = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
			let offset = 0;
			let index = input.indexOf(0x0a, offset);
			while (index !== -1) {
				const segment = input.subarray(offset, index);
				const lineBytes = buffer.length + segment.length;
				if (lineBytes > maxMessageBytes) {
					rejectOversized(lineBytes);
					return;
				}
				const raw = (
					buffer.length === 0
						? segment.toString("utf8")
						: Buffer.concat([buffer, segment], lineBytes).toString("utf8")
				)
					.replace(/\r$/, "")
					.trim();
				buffer = Buffer.alloc(0);
				if (raw.length > 0) {
					try {
						onMessage(JSON.parse(raw));
					} catch (error) {
						if (error instanceof Error) {
							onParseError?.(raw, error);
						} else {
							throw error;
						}
					}
				}
				offset = index + 1;
				index = input.indexOf(0x0a, offset);
			}

			const trailing = input.subarray(offset);
			const pendingBytes = buffer.length + trailing.length;
			if (pendingBytes > maxMessageBytes) {
				rejectOversized(pendingBytes);
				return;
			}
			if (trailing.length > 0) {
				buffer = buffer.length === 0 ? Buffer.from(trailing) : Buffer.concat([buffer, trailing], pendingBytes);
			}
		},
	};
}

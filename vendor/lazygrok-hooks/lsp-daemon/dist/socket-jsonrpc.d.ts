export declare function encodeJsonLine(message: unknown): string;
export interface LineDecoder {
    push(chunk: Buffer | string): void;
}
export interface LineDecoderOptions {
    readonly maxMessageBytes?: number;
}
export declare class JsonRpcLineTooLargeError extends Error {
    readonly actualBytes: number;
    readonly maxBytes: number;
    readonly name = "JsonRpcLineTooLargeError";
    constructor(actualBytes: number, maxBytes: number);
}
export declare function createLineDecoder(onMessage: (value: unknown) => void, onParseError?: (raw: string, error: unknown) => void, options?: LineDecoderOptions): LineDecoder;

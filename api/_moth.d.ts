import type { IncomingMessage, ServerResponse } from "node:http";

export declare const COIN: { engine: string; params: { mode: string; shots: number } };
export declare function coin(req: IncomingMessage, res: ServerResponse): Promise<void>;

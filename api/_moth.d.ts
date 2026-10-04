import type { IncomingMessage, ServerResponse } from "node:http";

export declare const COIN: { engine: string; params: { mode: string; shots: number } };
export declare function coin(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function labyrinth(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare const LABYRINTHS: Record<string, { rows: number; cols: number; edges: number[][]; start: number }>;

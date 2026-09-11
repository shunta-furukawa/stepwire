import { type Foot } from "./chart";
export declare function drawArrow(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, cx: number, cy: number, size: number, rotation: number, color: string): void;
export declare function drawGhostArrow(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, cx: number, cy: number, size: number, rotation: number, color?: string, fill?: string): void;
export declare function drawFootBadge(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, foot: Foot, pinned: boolean): void;

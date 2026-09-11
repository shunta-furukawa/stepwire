export declare const DIFF_COLORS: string[];
type FootCircle = {
    cx: number;
    cy: number;
    r: number;
};
type FootEllipse = {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    rot: number;
};
export type FootBlob = FootCircle | FootEllipse;
export declare const FOOT_BLOBS: FootBlob[];
export declare function isFootCircle(b: FootBlob): b is FootCircle;
/** dfパラメータ ("318"=クラス3のLv18、"x17"=クラスなしLv17、"2"=クラスのみ) */
export declare function parseDiffParam(v?: string): {
    cls: number | null;
    lvl: string;
};
export declare function serializeDiff(cls: number | null, lvl: string): string;
/** SM/SSCの難易度表記を5段階クラスへ (対応しない表記はnull) */
export declare function diffClassFromSm(difficulty: string): number | null;
/** SMのメーター表記を表示用レベル文字列へ */
export declare function diffLevelFromSm(meter: string): string;
/**
 * canvasへ足あとアイコンを描く (x,yは左上、sizeは24pxボックスの拡大サイズ)。
 * outline指定時は全パーツをその色で太らせて下描きし、縁取りの
 * シルエットを作る (背景色とクラス色が近くても視認できるように)
 */
export declare function drawDiffFoot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, outline?: string): void;
export {};

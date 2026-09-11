export type Foot = "L" | "R";
export type FootOverride = Foot | "LL" | "RR" | "C" | "CL" | "CR";
export interface ChartRow {
    measure: number;
    idx: number;
    total: number;
    beat: number;
    cols: string;
    quant: number;
}
export interface StepEvent {
    eventIdx: number;
    row: ChartRow;
    panels: number[];
    ghostPanels: number[];
    shock?: boolean;
}
export interface Hold {
    panel: number;
    startBeat: number;
    endBeat: number;
    roll: boolean;
}
export interface FootStep {
    feet: (Foot | null)[];
    leftPos: number;
    rightPos: number;
    jump: boolean;
    jack: boolean;
    crossover: boolean;
    doubleStep: boolean;
    oneFootJump: boolean;
    ghost: boolean;
    liftedFoot: Foot | null;
    shock: boolean;
    stretch: {
        foot: Foot;
        panels: number[];
    } | null;
    heldFeet: Foot[];
    facing: number;
}
export interface ParsedChart {
    measures: string[][];
    rows: ChartRow[];
    events: StepEvent[];
    holds: Hold[];
    mines: {
        panel: number;
        beat: number;
    }[];
    shocks: ChartRow[];
    totalBeats: number;
}
export declare const MAX_MEASURES = 256;
export declare function quantOf(idx: number, total: number): number;
export declare const QUANT_COLORS: Record<number, string>;
export declare const CENTER_POS = 4;
export declare const PANEL_COORDS: {
    x: number;
    y: number;
}[];
export declare function facingDeg(leftPos: number, rightPos: number): number;
/**
 * コンパクト形式の譜面文字列をパースする。
 * 形式: 小節を "-" 区切りで連結。各小節は4文字/行を改行なしで連結した [0123456M] の列。
 * 5 = 空打ち (フリーズ保持中の踏み直し。判定はないが足の持ち替えを表す)
 * 6 = フリーズ終端 + 空打ち (終端のタイミングで踏み直す。3と5を兼ねる)
 * 例: "0001001001001000-1000010000100001" (2小節、各4分×4行)
 */
export declare function parseCompact(n: string): ParsedChart;
export declare function tickOf(beat: number): number;
/**
 * 交互踏みを基本とするグリーディな足割り。
 * - 縦連 (直前と同じパネル) は同じ足
 * - ジャンプは移動距離と交差ペナルティが最小になる割り当て
 * - それ以外は直前と逆の足 (交差・振り向きもそのまま表示する)
 * - overrides でノーツ単位の手動指定 (tick → 足) を与えると、
 *   そのノーツは指定した足になり、以降はそこを起点に再計算される
 * - holds を渡すと、フリーズ保持中の足はロックされ、その間のノーツは
 *   もう片方の足に割り当てられる。フリーズ開始の足も保持中のノーツの
 *   配置から踏みやすい側を選ぶ
 */
export declare function assignFeet(events: StepEvent[], overrides?: Map<number, FootOverride>, holds?: Hold[]): FootStep[];
export interface ChartStats {
    steps: number;
    jumps: number;
    jacks: number;
    crossovers: number;
    doubleSteps: number;
    shocks: number;
    holdSwaps: number;
}
export declare function statsOf(footsteps: FootStep[], shocks?: number): ChartStats;
export declare const FOOT_COLORS: Record<Foot, string>;
/**
 * 体の向きに対応する背景色。左向き=ピンク・右向き=水色。
 * 90度まで (通常の踏み) は向きを示すだけの薄い一定色にとどめ、
 * 捻り (135度以上) から濃くして際立たせる。
 * 225〜270度 (イレギュラー) は紫の警告色、315度以上 (一回転級) は真っ暗。
 * 正面 (±22度未満) は無色 (null)。
 */
export declare function facingColor(facing: number): string | null;
export declare const ARROW_ROTATIONS: number[];

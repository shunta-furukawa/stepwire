export interface BpmChange {
    beat: number;
    bpm: number;
}
export interface Stop {
    beat: number;
    sec: number;
}
export declare function normalizeParam(v: string): string;
/**
 * 変速・停止の入力欄用の正規化。
 * SMファイルの "#BPMS:0=90,5.5=180;" のような行をそのまま貼っても
 * 動くように、タグ・セミコロン・空白を除去し "=" を ":" に変換する。
 */
export declare function sanitizeTimingInput(raw: string): string;
export declare function parseBpmParam(b: string | undefined): BpmChange[];
export declare function parseStopsParam(s: string | undefined): Stop[];
export declare function serializeBpmParam(bpms: BpmChange[]): string;
export declare function serializeStopsParam(stops: Stop[]): string;
export declare function bpmAtBeat(bpms: BpmChange[], beat: number): number;
export interface TimingSeg {
    move: boolean;
    t0: number;
    t1: number;
    beat0: number;
    beat1: number;
    bpm: number;
}
export declare function buildTimeline(bpms: BpmChange[], stops: Stop[], totalBeats: number): TimingSeg[];
export declare function beatAtTime(segs: TimingSeg[], time: number): number;
export declare function timeAtBeat(segs: TimingSeg[], beat: number): number;
export declare function extractTimingFromSM(text: string): {
    b?: string;
    s?: string;
};

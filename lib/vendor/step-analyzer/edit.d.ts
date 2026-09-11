import { type FootOverride } from "./chart";
/**
 * 指定位置のノーツをトグルする。
 * @param mIdx 小節番号
 * @param resRow 解像度res上での行番号 (0 <= resRow < res)
 * @param res 小節あたりの行数としての解像度 (4/8/12/16/24 または小節の元解像度)
 * @param panel 0=←, 1=↓, 2=↑, 3=→
 * @param ch 置くノーツ文字 (通常 "1"、フリーズ中のセルには "5"=空打ち)
 */
export declare function toggleNote(compact: string, mIdx: number, resRow: number, res: number, panel: number, ch?: "1" | "5"): string;
/**
 * 指定行のショックアロー (MMMM) をトグルする。
 * 置く場合はその行のノーツを上書きする (踏めない行なので共存しない)。
 */
export declare function toggleShock(compact: string, mIdx: number, resRow: number, res: number): string;
/**
 * フリーズアローを配置する。始点 (aM, aRow) から終点 (bM, bRow) まで、
 * 小節をまたいでもよい。範囲に重なる同列の既存フリーズ・ノーツは置き換える。
 * 始点と終点が同じセルなら何もしない (キャンセル扱い)。
 * @param res 解像度 (resRowはこの解像度上の行番号)
 */
export declare function placeHoldRange(compact: string, aM: number, aRow: number, bM: number, bRow: number, res: number, panel: number): string;
/** コピーバッファ: 1拍ごとの行配列 (行=4文字)。拍ごとに解像度を保つ */
export type BeatClip = string[][];
/** 拍範囲 [startBeat, endBeat) をコピーする */
export declare function copyBeats(compact: string, startBeat: number, endBeat: number): BeatClip;
/** 拍範囲 [startBeat, endBeat) のノーツを消す (小節数=時間は保つ) */
export declare function clearBeats(compact: string, startBeat: number, endBeat: number): string;
/**
 * クリップを指定拍位置へ上書き貼り付けする。
 * はみ出すぶんは末尾に空小節を足して受ける (maxMeasuresまで)
 */
export declare function pasteBeats(compact: string, atBeat: number, clip: BeatClip, maxMeasures: number): string;
/** 空の小節をn個末尾に追加する (maxMeasuresまで) */
export declare function appendMeasures(compact: string, n: number, maxMeasures: number): string;
export declare function parseOverrides(f: string | undefined): Map<number, FootOverride>;
export declare function serializeOverrides(map: Map<number, FootOverride>): string;
export declare function parseHighlights(h: string | undefined): Set<number>;
export declare function serializeHighlights(hl: Set<number>): string;
export declare function parseComments(h: string | undefined): Map<number, string>;
export declare function serializeComments(m: Map<number, string>): string;

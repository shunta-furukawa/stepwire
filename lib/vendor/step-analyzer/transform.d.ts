export declare const NAMED_TRANSFORMS: Record<string, number[]>;
/** tr= パラメータを列並べ替えに解決する。無効・恒等ならnull */
export declare function parseTransform(tr: string | undefined | null): number[] | null;
export declare function invertPerm(perm: number[]): number[];
/** コンパクト譜面文字列の全行に列並べ替えを適用する */
export declare function applyTransform(compact: string, perm: number[]): string;
/** ランダム用: 恒等以外の並べ替えを1つ選んで4桁文字列で返す */
export declare function randomTransform(): string;

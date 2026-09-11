/**
 * 譜面全体のクラップトラックをWAVにレンダリングし、Blob URLを返す。
 * eventTimes は各ノーツの発音時刻 (秒、ソフラン・停止込み)。
 * ghostTimes には空打ち (ストンプ音)、metroTimes には4つ打ちの
 * メトロノームティックの発音時刻を渡す。
 * 使い終わったURLは呼び出し側で URL.revokeObjectURL すること。
 */
/** クラップトラックの生波形を生成する (動画書き出しでの音声ミックスにも使う) */
export declare function renderClapTrackSamples(eventTimes: number[], accents: boolean[], durationSec: number, ghostTimes?: number[], metroTimes?: number[], sr?: number): {
    samples: Float32Array;
    sr: number;
};
export declare function buildClapTrackUrl(eventTimes: number[], accents: boolean[], durationSec: number, ghostTimes?: number[], metroTimes?: number[]): string;
export declare function setPlaybackAudioSession(): void;

import { type Foot } from "./chart";
export interface FootSceneProps {
    leftPos: number;
    rightPos: number;
    stepping: number[];
    feet: (Foot | null)[];
    facing: number;
    stepKey: number;
    heldFeet: Foot[];
    oneFoot: {
        foot: Foot;
        panels: number[];
    } | null;
    liftedFoot: Foot | null;
    /** このステップと直前ノーツ (LR問わず) の等速換算の間隔秒。
        トレイルの濃さ・減衰時間の算出に使う (省略時は既定値) */
    trailGapSec?: number | null;
    /** 再生速度 (0.5=半分の速さ)。トレイルの見え方が等速時と同じに
        なるよう、減衰時間と足の移動時間をこの逆数で引き伸ばす */
    playSpeed?: number;
}
export interface FootScene {
    canvas: HTMLCanvasElement;
    setSize(w: number, h: number, dpr?: number): void;
    /** props変更のコミット時に呼ぶ (トゥイーン・ホップの起点になる) */
    setProps(p: FootSceneProps, nowMs?: number): void;
    /** 毎フレーム呼ぶ (トゥイーンを進めて描画する) */
    frame(nowMs?: number): void;
    /** Seekable video frame: independent of previous calls and wall-clock time. */
    renderAt(from: FootSceneProps, to: FootSceneProps, progress: number, nowMs: number, hitAgeMs: number): void;
    /** 足の軌跡 (トレイル) 表示の切り替え */
    setTrail(on: boolean): void;
    dispose(): void;
}
export declare function createFootScene(): FootScene | null;

import { createFootScene } from '../vendor/step-analyzer/footScene';
import type { ChartPlayback } from './chart-model';
import { chartFootFrame } from './chart-foot-frame';

export interface ChartStage {
  render(playback: ChartPlayback, frame: number, fps: number, width: number, height: number): HTMLCanvasElement;
  dispose(): void;
}

/** One upstream WebGL scene per preview/export, reused across all chart cards. */
export function createChartStage(): ChartStage {
  const scene = createFootScene();
  if (!scene) throw new Error('3Dステップ表示を初期化できません。ほかのタブを閉じて再読み込みしてください。');
  let width = 0; let height = 0;
  return {
    render(playback, frame, fps, w, h) {
      if (scene.canvas.getContext('webgl2')?.isContextLost()) throw new Error('3D描画が中断されました。再読み込みして書き出し直してください。');
      const nextW = Math.max(1, Math.round(w)); const nextH = Math.max(1, Math.round(h));
      if (nextW !== width || nextH !== height) {
        width = nextW; height = nextH;
        scene.setSize(width, height, 1);
      }
      const pose = chartFootFrame(playback, frame, fps);
      scene.renderAt(pose.from, pose.to, pose.progress, pose.nowMs, pose.hitAgeMs);
      return scene.canvas;
    },
    dispose: () => scene.dispose(),
  };
}

import { matrixTone } from '../../public/bpl/matrix.js';
import { teamName } from './summary';
import type { shareModel } from './share';
import data from '../../public/bpl/data.json';
import brand from '../../public/bpl/brand.json';

const teams: Record<string, { name: string; color: string }> = data.teams;
const palette: Record<string, { color: string; rgb: string }> = brand.teams;
export const matrixFontFamily = 'BplMatrixSans, BplMatrixJapanese';
const fg = '#ecece7', muted = '#a4a49e', ground = '#0a0a0b';

/** Team identity lives on the axes; result cells retain the table's win-rate palette. */
export function MatrixCard({ model: m }: { model: ReturnType<typeof shareModel> }) {
  if (!m.matrix) return null;
  const table = m.matrix;
  const identity = (key: string) => {
    const id = m.params.get(key) || '';
    const team = teams[id], colors = palette[id];
    if (!team || !colors) throw new RangeError('Unknown matrix team');
    return { name: teamName(id, 6), color: colors.color, tint: `rgba(${colors.rgb},0.14)` };
  };
  const row = identity('previewA'), col = identity('previewB');
  const identities = [row, col];
  const axisWidth = 176, cellWidth = 238;
  return <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '24px 36px', background: ground, color: fg, fontFamily: matrixFontFamily, fontSize: 16, fontWeight: 400 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40 }}>
      <span style={{ fontSize: 32, fontWeight: 700 }}>選手同士の過去対戦</span>
      <span style={{ fontSize: 16, color: muted }}>BPL DDR / S6登録メンバー</span>
    </div>
    <div style={{ display: 'flex', gap: 16, marginTop: 14, height: 48 }}>
      {identities.map((team, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', width: 556, padding: '0 16px', borderLeft: `5px solid ${team.color}`, background: team.tint, gap: 14 }}>
        <span style={{ fontSize: 16, color: muted }}>{i === 0 ? '行' : '列'}</span>
        <span style={{ fontFamily: 'BplTeam', fontWeight: 700, fontSize: 25 }}>{team.name}</span>
      </div>)}
    </div>
    <div style={{ display: 'flex', color: muted, marginTop: 12, height: 22 }}>{m.detail}</div>
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
      <div style={{ display: 'flex', height: 46 }}>
        <div style={{ display: 'flex', width: axisWidth, alignItems: 'center', fontSize: 15, color: muted }}>行の選手 → 列の選手</div>
        {table.right.map(p => <div key={p.id} style={{ display: 'flex', width: cellWidth, alignItems: 'center', justifyContent: 'center', background: col.tint, borderTop: `4px solid ${col.color}`, borderLeft: `4px solid ${ground}`, fontSize: p.name.length > 12 ? 18 : 22, fontWeight: 700 }}>{p.name}</div>)}
      </div>
      {table.left.map((p, i) => <div key={p.id} style={{ display: 'flex', height: 76 }}>
        <div style={{ display: 'flex', width: axisWidth, alignItems: 'center', paddingLeft: 12, background: row.tint, borderLeft: `5px solid ${row.color}`, borderTop: `4px solid ${ground}`, fontSize: p.name.length > 12 ? 16 : 21, fontWeight: 700 }}>{p.name}</div>
        {(table.cells[i] || []).map((c, j) => <div key={j} style={{ display: 'flex', flexDirection: 'column', width: cellWidth, alignItems: 'center', justifyContent: 'center', background: matrixTone(c.rate).background, borderLeft: `4px solid ${ground}`, borderTop: `4px solid ${ground}` }}>
          <div style={{ display: 'flex', fontSize: 30, lineHeight: 1.1, fontWeight: 700, color: matrixTone(c.rate).color }}>{c.rate === null ? '—' : c.rate + '%'}</div>
          <div style={{ display: 'flex', fontSize: 15, color: '#d0d1ca', marginTop: 5 }}>{c.n ? `${c.w}勝 ${c.d}分 ${c.l}敗 · ${c.n}曲` : '該当記録なし · 0曲'}</div>
        </div>)}
      </div>)}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 15, color: muted, marginTop: 16, gap: 7 }}>
      <span>行の選手基準 / 勝率＝勝ち ÷（勝ち＋負け）・引分除外 / Duoは個人EX SCORE比較</span>
      <div style={{ display: 'flex', gap: 18 }}>
        <span>見出しの色：所属チーム</span>
        <span style={{ color: matrixTone(100).color }}>50%超：勝ち越し</span>
        <span style={{ color: matrixTone(50).color }}>50%：五分</span>
        <span style={{ color: matrixTone(0).color }}>50%未満：負け越し</span>
      </div>
      <span>勝率 —：未対戦・該当0曲・引分のみ / S5以前の記録・ZERO除外 / 非公式</span>
    </div>
  </div>;
}

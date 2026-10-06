/* eslint-disable @next/next/no-img-element -- Social cards embed reviewed local images. */
import type { shareModel } from './share';
import { seasonName } from './summary';

type Model = ReturnType<typeof shareModel>;

function Metric({ value, label, note }: { value: string; label: string; note?: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: 220, flexShrink: 0 }}>
    <span style={{ fontSize: 40, lineHeight: 1.2, color: '#ecece7' }}>{value}</span>
    <span style={{ fontSize: 18, color: '#bbbdb6' }}>{label}</span>
    {note ? <span style={{ fontSize: 15, color: '#bbbdb6' }}>{note}</span> : null}
  </div>;
}

export function EntityCard({ model: m, logo, images }: { model: Model; logo: string; images: Record<string, string> }) {
  const entity = m.entity;
  if (!entity) throw new RangeError('Entity card requires a team or player');
  const s = entity.stats;
  const hidden = m.params.get('hideResults') !== '0';
  const scope = `通算${entity.kind === 'team' ? 'チーム' : '個人'}成績${hidden ? ' / S6結果を除く' : ''}`;
  const isPlayer = entity.kind === 'player';
  return <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '32px 44px 26px', background: '#0a0a0b', color: '#ecece7', fontFamily: 'Bpl', borderTop: `10px solid ${m.color}` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 38 }}>
      <img src={logo} width={265} height={34} alt="STEPWIRE" />
      <span style={{ fontSize: 20, color: '#b4da46' }}>BPL DDR / {m.eyebrow}</span>
    </div>
    <div style={{ display: 'flex', flex: 1, gap: 32, marginTop: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', fontSize: isPlayer ? 62 : m.title.length > 22 ? 40 : 48, lineHeight: 1.2 }}>{m.title}</div>
        <div style={{ display: 'flex', marginTop: 10, fontSize: 21, color: '#bbbdb6' }}>{entity.kind === 'player' ? entity.affiliation : scope}</div>
        {isPlayer ? <div style={{ display: 'flex', fontSize: 17, color: '#bbbdb6', marginTop: 7 }}>{scope}</div> : null}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: isPlayer ? 24 : 18 }}>
          <span style={{ fontSize: 68, color: '#b4da46' }}>{s.wins}</span><span style={{ fontSize: 26 }}>勝</span>
          <span style={{ fontSize: 68 }}>{s.losses}</span><span style={{ fontSize: 26 }}>敗</span>
          <span style={{ fontSize: 46, color: '#bbbdb6' }}>{s.draws}</span><span style={{ fontSize: 23, color: '#bbbdb6' }}>分</span>
        </div>
        <div style={{ display: 'flex', fontSize: 18, color: '#bbbdb6', marginTop: 1 }}>{entity.kind === 'player' ? `Single / EX SCORE比較・${entity.stats.songs}楽曲` : 'チーム対抗試合単位 / 全ステージ合算'}</div>
        <div style={{ display: 'flex', gap: isPlayer ? 36 : 56, marginTop: 25 }}>
          <Metric value={`${s.matches}試合`} label={isPlayer ? '通算出場（ZERO含む）' : '通算試合数'} />
          {entity.kind === 'player' ? <>
            <Metric value={s.rate === null ? '—' : `${s.rate}%`} label="Single 勝率" note="引分を分母から除外" />
            <Metric value={`${entity.stats.firsts} / ${entity.stats.duoSongs}`} label="Duo 個人1位 / 楽曲" note="同率1位を含む" />
          </> : <>
            <Metric value={`${entity.stats.titles}回`} label={entity.roster.latest === 0 ? 'ZERO 優勝' : '優勝'} />
            <Metric value={`${entity.roster.members.length}選手`} label={`${seasonName(entity.roster.season)}所属`} />
          </>}
        </div>
      </div>
      {entity.kind === 'player' && entity.portrait && images[entity.portrait] ? <div style={{ display: 'flex', width: 270, flexShrink: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
        <div style={{ display: 'flex', width: 270, height: 310, background: '#e5e9ee', borderBottom: `8px solid ${m.color}` }}><img src={images[entity.portrait]} width={270} height={302} style={{ objectFit: 'contain' }} alt={m.title} /></div>
        <span style={{ fontSize: 15, color: '#bbbdb6', marginTop: 11 }}>非公式イラスト</span>
      </div> : null}
    </div>
    {entity.kind === 'team' ? <div style={{ display: 'flex', gap: 20, marginTop: 20, marginBottom: 16, borderTop: '1px solid #34343a', paddingTop: 14 }}>
      {entity.roster.members.map(member => <div key={member.id} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 12 }}>
        {member.portrait && images[member.portrait] ? <img src={images[member.portrait]} width={68} height={68} style={{ background: '#e5e9ee', objectFit: 'contain' }} alt={member.name} /> : null}
        <span style={{ fontSize: member.name.length > 9 ? 17 : 20 }}>{member.name}</span>
      </div>)}
    </div> : null}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: isPlayer ? 20 : 0, borderTop: '1px solid #34343a', paddingTop: 13, fontSize: 15, color: '#bbbdb6' }}>
      <span>{isPlayer ? 'Single勝率 = 勝ち ÷（勝ち + 負け） / 楽曲別成績はZEROを除く' : `数値は通算戦績 / ${seasonName(entity.kind === 'team' ? entity.roster.season : '')}は所属の表示 / 非公式イラスト`}</span>
      <span>公式記録に基づく非公式アーカイブ / 本人・チームの公認ではありません</span>
    </div>
  </div>;
}

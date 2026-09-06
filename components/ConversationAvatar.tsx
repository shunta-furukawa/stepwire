import type { Mood, Speaker } from '@/lib/content/dialogue';

/** The same blank illustration and registered facial coordinates as the video.
 * Static SVG keeps article reading independent of JavaScript or animation.
 */
export function ConversationAvatar({ speaker, mood = 'neutral' }: { speaker: Speaker; mood?: Mood }) {
  const wire = speaker === 'WIRE';
  return (
    <span className="block h-[64px] w-[64px] overflow-hidden rounded-xl border border-line-strong bg-[#171917] shadow-[inset_0_-2px_0_#c5ef35] sm:h-[80px] sm:w-[80px]" aria-hidden="true">
      <svg viewBox={wire ? '130 170 470 470' : '1070 150 570 570'} className="h-full w-full" focusable="false">
        <image href="/images/studio/mono-wire-characters.webp" x={wire ? 100 : 0} y={wire ? 62 : 0} width={wire ? 1672 * 0.81 : 1672} height={wire ? 941 * 0.81 : 941} />
        {wire && <g fill="#d5ff37" stroke="#d5ff37" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          {([[295, 472, 34, 38], [434, 408, 24, 38]] as const).map(([x, y, rx, ry], i) => {
            const closed = mood === 'wink' && i === 0;
            const height = mood === 'think' ? ry * 0.45 : mood === 'surprise' ? ry * 1.1 : ry;
            return <g key={i} transform={`translate(${x} ${y}) rotate(-13.178)`}>
              {closed || mood === 'grin' ? <path d={`M ${-rx * 0.8} 4 Q 0 ${closed ? 8 : -ry} ${rx * 0.8} 4`} fill="none" /> : <>
                <ellipse rx={rx} ry={height} stroke="none" />
                <ellipse cx={mood === 'think' ? -5 : 5} cy={mood === 'think' ? -3 : -6} rx={rx * (mood === 'surprise' ? 0.28 : 0.45)} ry={height * 0.65} fill="#080b05" stroke="none" />
                <circle cx={mood === 'think' ? -8 : 2} cy={-height * 0.42} r="3" fill="#f5ffe3" stroke="none" />
              </>}
            </g>;
          })}
          <g transform="translate(383 490) rotate(-13.178)" fill="none">
            {mood === 'surprise' ? <ellipse rx="9" ry="12" /> : <path d={mood === 'think' ? 'M -16 4 L -4 -2 L 8 3 L 19 -2' : mood === 'grin' ? 'M -18 -2 Q 0 20 20 -4 L -18 -2' : 'M -18 -2 Q 0 8 20 -4'} />}
          </g>
        </g>}
      </svg>
    </span>
  );
}

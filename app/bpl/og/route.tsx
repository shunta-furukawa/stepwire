/* eslint-disable @next/next/no-img-element -- ImageResponse embeds data URIs. */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { matrixTone } from '../../../public/bpl/matrix.js';
import { shareModel } from '@/lib/bpl/share';

export async function GET(request: Request) {
  try {
    const m=shareModel(new URL(request.url).searchParams);
    const [font,logo]=await Promise.all([readFile(join(process.cwd(),'public/fonts/BplShare.ttf')),readFile(join(process.cwd(),'public/brand/wordmark.svg'))]);
    if(m.matrix){
      const table=m.matrix;
      return new ImageResponse(<div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',padding:'26px 36px',background:'#0a0a0b',color:'#ecece7',fontFamily:'Bpl',borderTop:'8px solid #b4da46'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><img src={`data:image/svg+xml;base64,${logo.toString('base64')}`} width={234} height={30} alt="STEPWIRE"/><span style={{fontSize:18,color:'#b4da46'}}>BPL DDR / S6 ROSTER</span></div>
        <div style={{display:'flex',fontSize:28,marginTop:14}}>{m.title} · 選手同士の過去対戦</div>
        <div style={{display:'flex',fontSize:17,color:'#bbbdb6',marginTop:8,marginBottom:14}}>{m.detail}</div>
        <div style={{display:'flex',flexDirection:'column',width:'100%'}}>
          <div style={{display:'flex',height:38,alignItems:'center'}}><div style={{display:'flex',width:168,fontSize:16,color:'#a4a69d'}}>行 → 列</div>{table.right.map(p=><div key={p.id} style={{display:'flex',width:240,justifyContent:'center',fontSize:20}}>{p.name}</div>)}</div>
          {table.left.map((p,i)=><div key={p.id} style={{display:'flex',height:84,borderTop:'1px solid #3a3a40'}}><div style={{display:'flex',width:168,alignItems:'center',fontSize:21}}>{p.name}</div>{table.cells[i]!.map((c,j)=><div key={j} style={{display:'flex',flexDirection:'column',width:240,alignItems:'center',justifyContent:'center',background:matrixTone(c.rate).background,borderLeft:'4px solid #0a0a0b',borderBottom:'4px solid #0a0a0b'}}><div style={{display:'flex',fontSize:30,color:matrixTone(c.rate).color}}>{c.rate===null?'—':c.rate+'%'}</div><div style={{display:'flex',fontSize:15,color:'#d0d1ca'}}>{c.n?`${c.w}勝 ${c.d}分 ${c.l}敗 · ${c.n}曲`:'該当記録なし · 0曲'}</div></div>)}</div>)}
        </div>
        <div style={{display:'flex',flexDirection:'column',fontSize:14,color:'#a4a69d',marginTop:12,gap:5}}><span>行の選手基準・勝率＝勝ち ÷（勝ち＋負け）・Duoは個人EX SCORE比較</span><span>緑：勝ち越し / 無彩色：五分 / 赤：負け越し / 引分のみは — / S5以前・ZERO除外 / 非公式</span></div>
      </div>,{width:1200,height:630,fonts:[{name:'Bpl',data:font,style:'normal',weight:400}],headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}});
    }
    return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:56,background:'#0a0a0b',color:'#ecece7',fontFamily:'Bpl',borderTop:`12px solid ${m.color}`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><img src={`data:image/svg+xml;base64,${logo.toString('base64')}`} width={334} height={42} alt="STEPWIRE"/><span style={{fontSize:22,color:'#b4da46'}}>BPL DDR / {m.eyebrow}</span></div>
      <div style={{display:'flex',flexDirection:'column',gap:18}}><div style={{fontSize:26,color:'#bdbfbd'}}>{m.detail}</div><div style={{fontSize:m.title.length>30?44:60,lineHeight:1.3}}>{m.title}</div>{m.score?<div style={{fontSize:104,color:'#b4da46',lineHeight:1.1}}>{m.score}</div>:null}<div style={{fontSize:m.metric.length>45?22:28,color:'#d0d1ca'}}>{m.metric}</div></div>
      <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #3a3a40',paddingTop:20,fontSize:19,color:'#9a9a94'}}><span>公式記録に基づく非公式アーカイブ</span><span>STEPWIRE / BPL</span></div>
    </div>,{width:1200,height:630,fonts:[{name:'Bpl',data:font,style:'normal',weight:400}],headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}});
  }catch(error){if(error instanceof RangeError)return new Response('Not found',{status:404});throw error;}
}

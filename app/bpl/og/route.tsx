/* eslint-disable @next/next/no-img-element -- ImageResponse embeds data URIs. */
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MatrixCard } from '@/lib/bpl/matrix-card';
import { shareModel } from '@/lib/bpl/share';
import { EntityCard } from '@/lib/bpl/entity-card';

export async function GET(request: Request) {
  try {
    const m=shareModel(new URL(request.url).searchParams);
    // Load the same plain sans-serif style as the archive, not its display-card font.
    // All font bytes are local and awaited before rendering; no browser font race.
    if(m.matrix){
      const specs = [
        ['BplMatrixSans', 'BplMatrixSans-Regular.ttf', 400],
        ['BplMatrixSans', 'BplMatrixSans-Bold.ttf', 700],
        ['BplMatrixJapanese', 'BplMatrixJapanese-Regular.otf', 400],
        ['BplMatrixJapanese', 'BplMatrixJapanese-Bold.otf', 700],
        ['BplTeam', 'BplTeam.ttf', 700],
      ] as const;
      const fonts = await Promise.all(specs.map(async ([name, file, weight]) => ({name, data: await readFile(join(process.cwd(), 'public/fonts', file)), weight, style: 'normal' as const})));
      return new ImageResponse(<MatrixCard model={m}/>, {width:1200,height:630,fonts,headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}});
    }
    const [font,logo]=await Promise.all([readFile(join(process.cwd(),'public/fonts/BplShare.ttf')),readFile(join(process.cwd(),'public/brand/wordmark.svg'))]);
    if(m.entity){
      const paths=m.entity.kind==='player'?[m.entity.portrait]:m.entity.roster.members.map(member=>member.portrait);
      const images=Object.fromEntries(await Promise.all(paths.filter((path):path is string=>path!==null).map(async path=>[path,`data:image/png;base64,${(await sharp(await readFile(join(process.cwd(),'public',path))).resize(320,320,{fit:'inside',withoutEnlargement:true}).png().toBuffer()).toString('base64')}`])));
      return new ImageResponse(<EntityCard model={m} logo={`data:image/svg+xml;base64,${logo.toString('base64')}`} images={images}/>,{width:1200,height:630,fonts:[{name:'Bpl',data:font,style:'normal',weight:400}],headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}});
    }
    return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:56,background:'#0a0a0b',color:'#ecece7',fontFamily:'Bpl',borderTop:`12px solid ${m.color}`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><img src={`data:image/svg+xml;base64,${logo.toString('base64')}`} width={334} height={42} alt="STEPWIRE"/><span style={{fontSize:22,color:'#b4da46'}}>BPL DDR / {m.eyebrow}</span></div>
      <div style={{display:'flex',flexDirection:'column',gap:18}}><div style={{fontSize:26,color:'#bdbfbd'}}>{m.detail}</div><div style={{fontSize:m.title.length>30?44:60,lineHeight:1.3}}>{m.title}</div>{m.score?<div style={{fontSize:104,color:'#b4da46',lineHeight:1.1}}>{m.score}</div>:null}<div style={{fontSize:m.metric.length>45?22:28,color:'#d0d1ca'}}>{m.metric}</div></div>
      <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #3a3a40',paddingTop:20,fontSize:19,color:'#9a9a94'}}><span>公式記録に基づく非公式アーカイブ</span><span>STEPWIRE / BPL</span></div>
    </div>,{width:1200,height:630,fonts:[{name:'Bpl',data:font,style:'normal',weight:400}],headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}});
  }catch(error){if(error instanceof RangeError)return new Response('Not found',{status:404});throw error;}
}

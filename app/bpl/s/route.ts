import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { shareModel, escapeHtml as e } from '@/lib/bpl/share';
import { site } from '@/lib/site';

export async function GET(request: Request) {
  try {
    const m=shareModel(new URL(request.url).searchParams);
    const url=new URL('/bpl/s',site.url);url.search=m.params.toString();
    const image=new URL('/bpl/og',site.url);image.search=m.params.toString();if(m.entity)image.searchParams.set('v',m.summaryRevision);
    const title=`${m.title} — STEPWIRE`;
    const meta=`<meta name="bpl:summary-revision" content="${m.summaryRevision}"><title>${e(title)}</title><meta name="description" content="${e(m.description)}"><link rel="canonical" href="${e(url.href)}"><meta property="og:type" content="website"><meta property="og:site_name" content="STEPWIRE"><meta property="og:locale" content="ja_JP"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(m.description)}"><meta property="og:url" content="${e(url.href)}"><meta property="og:image" content="${e(image.href)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(m.description)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(m.description)}"><meta name="twitter:image" content="${e(image.href)}"><meta name="twitter:image:alt" content="${e(m.description)}">`;
    let html=await readFile(join(process.cwd(),'public/bpl/index.html'),'utf8');
    html=html.replace(/<title>.*?<\/title>/,'').replace(/<meta name="description"[^>]*>/,'').replace('</head>',meta+'</head>');
    return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
  }catch(error){if(error instanceof RangeError)return new Response('共有先が見つかりません。',{status:404});throw error;}
}

import { writeFileSync } from 'node:fs';
// One master alphabet: the wordmark and initials use the exact same glyphs.
const glyphs = {
 S: [100, 'M25 0H100L84 26H35L25 42H76L100 68L80 104H0L16 78H66L76 62H25L0 36Z'],
 T: [100, 'M0 0H100V26H65V104H35V26H0Z'],
 E: [90, 'M0 0H90V26H28V39H70L85 52L70 65H28V78H90V104H0Z'],
 P: [100, 'M0 0H75L100 26V42L75 68H29V104H0ZM29 26V43H64L73 35L64 26Z'],
 W: [140, 'M0 0H30L49 63L70 16L91 63L110 0H140L108 104H83L70 73L57 104H32Z'],
 I: [30, 'M0 0H30V104H0Z'],
 R: [100, 'M0 0H75L100 26V42L77 64L100 104H67L46 68H29V104H0ZM29 26V43H64L73 35L64 26Z'],
};
const colors=['#f3f3ef','#dededb','#bdbfbd','#e8e9e5','#969b98'];
function glyph(letter,id){
 const [width,path]=glyphs[letter]; let facets='';
 for(let row=0;row<4;row++)for(let col=-1;col<6;col++){
  const x=col*30+(row%2)*15,y=row*26;
  const lime=(letter==='S'&&row===3&&col===2)||(letter==='W'&&row===2&&col===2)||(letter==='E'&&row===1&&col===1)||(letter==='I'&&row===0&&col===0)||(letter==='R'&&row===2&&col===2);
  facets+=`<path d="M${x} ${y}h30l-15 26Z" fill="${lime?'#b4da46':colors[(row+col+6)%5]}"/><path d="M${x+30} ${y}l15 26h-30Z" fill="${colors[(row*2+col+7)%5]}"/>`;
 }
 return `<defs><clipPath id="${id}"><path d="${path}" clip-rule="evenodd" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#${id})"><path d="M0 0h${width}v104H0Z" fill="#ecece7"/>${facets}</g>`;
}
function svg(letters,icon=false){let x=0,body='';for(const [i,l] of [...letters].entries()){body+=`<g transform="translate(${x} 0)">${glyph(l,'g'+i)}</g>`;x+=glyphs[l][0]+12;}x-=12;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon?'0 0 280 280':`0 0 ${x} 104`}" role="img" aria-label="STEPWIRE">${icon?'<rect width="280" height="280" rx="40" fill="#0a0a0b"/><g transform="translate(14 88)">':''}${body}${icon?'</g>':''}</svg>`;
}
for(const [name,letters,icon] of [['wordmark','STEPWIRE',false],['monogram','SW',false],['icon','SW',true]])writeFileSync(new URL(`../public/brand/${name}.svg`,import.meta.url),svg(letters,icon));

"""Rebuild the existing OFL-licensed social-card subset (fontTools + brotli)."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
sources = ['public/bpl/data.json', 'public/bpl/brand.json', 'public/bpl/matrix.js',
           'lib/bpl/share.ts', 'lib/bpl/summary.ts', 'lib/bpl/entity-card.tsx',
           'app/bpl/og/route.tsx']
text = ''.join(chr(n) for n in range(32, 127)) + ''.join((root / p).read_text() for p in sources)
font = TTFont(root / 'public/fonts/DelaGothicOne-Regular.woff2')
font.flavor = None
options = subset.Options()
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
font.save(root / 'public/fonts/BplShare.ttf')

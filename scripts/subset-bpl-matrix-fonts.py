"""Subset ordinary sans faces for matrix exports (fontTools required).

Sources: Debian fonts-liberation and fonts-noto-cjk, both SIL OFL 1.1.
Latin has Arial-compatible metrics, matching the archive's system sans stack;
Japanese uses Noto Sans CJK JP. Team names use the site's existing BplTeam.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
sources = ['public/bpl/data.json', 'public/bpl/brand.json', 'lib/bpl/share.ts',
           'lib/bpl/matrix-card.tsx', 'public/bpl/matrix.js']
text = ''.join(chr(n) for n in range(32, 127)) + ''.join((root / p).read_text() for p in sources)
for weight in ['Regular', 'Bold']:
    for family, source, ext in [
        ('BplMatrixSans', f'/usr/share/fonts/truetype/liberation/LiberationSans-{weight}.ttf', 'ttf'),
        ('BplMatrixJapanese', f'/usr/share/fonts/opentype/noto/NotoSansCJK-{weight}.ttc', 'otf'),
    ]:
        font = TTFont(source, fontNumber=0, recalcTimestamp=False)
        options = subset.Options()
        options.recalc_timestamp = False
        sub = subset.Subsetter(options=options)
        sub.populate(text=text)
        sub.subset(font)
        # Rename subsets to avoid retaining reserved font names in modified fonts.
        for record in font['name'].names:
            if record.nameID in [1, 2, 3, 4, 6, 16, 17]:
                value = weight if record.nameID in [2, 17] else f'{family}-{weight}'
                record.string = value.encode(record.getEncoding())
        if 'CFF ' in font:
            cff = font['CFF '].cff
            cff.fontNames[0] = f'{family}-{weight}'
            cff.topDictIndex[0].FamilyName = family
            cff.topDictIndex[0].FullName = f'{family} {weight}'
        font.save(root / f'public/fonts/{family}-{weight}.{ext}')

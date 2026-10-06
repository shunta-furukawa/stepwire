"""Offline extraction and exact approved-trial regression checks; no image fetches."""
import json
from pathlib import Path
import unittest
from PIL import Image
from extract_palette import clusters, extract, score, select

EXPECTED = {
 'Wuv U':['#faf1dd','#31adc7','#bb72af','#eb5796'],
 'ALPACORE':['#26cbee','#26cdf5','#ffffff','#1dcdf6'],
 'CHAOS':['#873216','#983410','#772931','#5b1816'],
 'ビューティフル レシート':['#42e0cc','#71f377','#76e840','#ebef29'],
 '888':['#030303','#020303','#636179','#472835'],
 '50th Memorial Songs -The BEMANI History-':['#b2071a','#b30417','#b40517','#b30316'],
 'MAX 300':['#be4734','#b7371d','#cc3d53','#d7323f'],
}
class PaletteTests(unittest.TestCase):
 def test_approved_seven_palettes(self):
  fixture=json.loads(Path(__file__).with_name('approved-clusters.json').read_text())
  self.assertEqual(set(fixture),set(EXPECTED))
  for name,quadrants in fixture.items():
   self.assertEqual(list(quadrants),['topLeft','topRight','bottomLeft','bottomRight'])
   with self.subTest(song=name):self.assertEqual([select(rows)['color'] for rows in quadrants.values()],EXPECTED[name])
 def test_quadrant_positions(self):
  im=Image.new('RGBA',(20,20))
  for box,c in [((0,0,10,10),'#f00000'),((10,0,20,10),'#00f000'),((0,10,10,20),'#0000f0'),((10,10,20,20),'#e0b000')]:im.paste(c,box)
  self.assertEqual(list(extract(im).values()),['#f00000','#00f000','#0000f0','#e0b000'])
 def test_transparency(self):
  im=Image.new('RGBA',(20,20),(0,0,0,0));im.paste('#e326a5',(3,3,17,17))
  self.assertEqual(set(extract(im).values()),{'#e326a5'})
  self.assertEqual(set(extract(Image.new('RGBA',(20,20),(0,0,0,0))).values()),{None})
 def test_tiny_text_and_neutral_backgrounds(self):
  for background,accent in [('#ffffff','#ff0060'),('#090909','#ff0060'),('#123abc','#ffffff')]:
   for fraction in [0,.03,.08,.10]:
    with self.subTest(background=background,fraction=fraction):
     im=Image.new('RGB',(128,128),background)
     for x,y in [(0,0),(64,0),(0,64),(64,64)]:
      for i in range(round(4096*fraction)):im.putpixel((x+i%64,y+i//64),tuple(bytes.fromhex(accent[1:])))
     self.assertEqual(set(extract(im).values()),{background})
 def test_guard_cutoffs_and_existing_dark_penalty(self):
  gray={'color':'#999999','fraction':.8,'L':.6,'C':0}
  color={'color':'#e326a5','fraction':.2,'L':.6,'C':.06}
  self.assertFalse(select([gray,color])['neutralFallback'])
  self.assertTrue(select([gray,{**color,'C':.059999}])['neutralFallback'])
  self.assertTrue(select([gray,{**color,'fraction':.04999}])['neutralFallback'])
  self.assertFalse(select([gray,{**color,'fraction':.05}])['neutralFallback'])
  self.assertEqual(score({**color,'fraction':.04999},a=.7,lam=2,beta=2,cref=.1),0)
  self.assertAlmostEqual(score({**color,'L':.17},a=.7,lam=2,beta=2,cref=.1),score(color,a=.7,lam=2,beta=2,cref=.1)*.7)
 def test_sampled_pixels_and_determinism(self):
  im=Image.new('RGB',(20,20),'#f00000');im.paste('#00f0f0',(0,0,9,20))
  self.assertTrue(set(extract(im).values())<={'#f00000','#00f0f0'})
  self.assertEqual(clusters(im),clusters(im))
 def test_stable_max_tie(self):
  rows=[{'color':'#111111','fraction':.5,'L':.2,'C':0},{'color':'#222222','fraction':.5,'L':.2,'C':0}]
  self.assertEqual(select(rows)['color'],'#111111')
if __name__=='__main__':unittest.main()

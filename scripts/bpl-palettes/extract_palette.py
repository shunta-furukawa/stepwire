"""Offline analysis only; outputs sampled thumbnail colors, never source images.

Reproduces the user-approved moderate trial, including stable mass-order ties.
Inputs are split/resampled before clustering exactly as the original selector.
"""
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

M1=np.array([[0.4122214708,0.5363325363,0.0514459929],[0.2119034982,0.6806995451,0.1073969566],[0.0883024619,0.2817188376,0.6299787005]])
M2=np.array([[0.2104542553,0.7936177850,-0.0040720468],[1.9779984951,-2.4285922050,0.4505937099],[0.0259040371,0.7827717662,-0.8086757660]])
def oklab(rgb):
 rgb=rgb/255
 linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 return np.cbrt(linear@M1.T)@M2.T

KEYS=['topLeft','topRight','bottomLeft','bottomRight']
def clusters(im):
 im=im.convert('RGBA');im.thumbnail((128,128));w,h=im.size;mx,my=w//2,h//2
 out={}
 for key,box in zip(KEYS,[(0,0,mx,my),(mx,0,w,my),(0,my,mx,h),(mx,my,w,h)]):
  rgba=np.asarray(im.crop(box)).reshape(-1,4);rgba=rgba[rgba[:,3]>=32]
  if len(rgba)==0:
   out[key]=[];continue
  rgb=rgba[:,:3].astype(float);lab=oklab(rgb);alpha=rgba[:,3]/255
  k=min(5,len(np.unique(rgb,axis=0)))
  model=KMeans(n_clusters=k,random_state=23,n_init=8,max_iter=80).fit(lab,sample_weight=alpha)
  weights=np.bincount(model.labels_,weights=alpha,minlength=k);fractions=weights/weights.sum()
  q=[]
  for j in range(k):
   ids=np.where(model.labels_==j)[0];center=model.cluster_centers_[j]
   medoid=ids[np.argmin(np.sum((lab[ids]-center)**2,axis=1))]
   q.append(dict(color='#'+''.join(f'{int(c):02x}' for c in rgb[medoid]),fraction=float(fractions[j]),L=float(center[0]),C=float(np.linalg.norm(center[1:]))))
  out[key]=sorted(q,key=lambda c:-c['fraction'])
 return out

def score(c,a=1,lam=0,beta=1,cref=.15,mode='new',minimum=.05):
 p,C,L=c['fraction'],c['C'],c['L'];q=min(C/cref,1)
 s=p*(.75+.65*q) if mode=='old' else p**a*(1+lam*q**beta)
 if p<minimum:s=0
 if L<.18 and p<.65:s*=.7
 return s

MODERATE = dict(a=.7,lam=2,beta=2,cref=.10)

def select(rows):
 if not rows:return None
 supported=any(c['fraction']>=.05 and c['C']>=.06 for c in rows)
 params=MODERATE if supported else dict(mode='old')
 return {**max(rows,key=lambda c:score(c,**params)), 'neutralFallback':not supported}

def extract(im):
 return {key:(select(rows)['color'] if rows else None) for key,rows in clusters(im).items()}

import React from 'react';
import { Img, staticFile } from 'remotion';

/**
 * Full-bleed picture with a darkening so type stays legible over it.
 *
 * Mounted once at the composition root, under the field and the scene, rather
 * than inside each scene that has a picture: the stack under a card is one
 * decision (`lib/video/ground.ts`), and it is made in one place.
 */
export function Backdrop({ src, dim, zoom }: { src: string; dim: number; zoom: number }) {
  return (
    <>
      <Img
        src={staticFile(src.replace(/^\//, ''))}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${zoom})`,
          transformOrigin: '50% 50%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to top, rgba(10,10,11,${dim}) 30%, rgba(10,10,11,${dim * 0.55}) 100%)`,
        }}
      />
    </>
  );
}

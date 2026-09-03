# Audio sources — free, with a credit

STEPWIRE の動画に使う BGM と効果音を、どこから、どの条件で持ってくるかの一覧。

前提はふたつ。**システムは音源を取りに行かない。** オペレーターがファイルを
`public/audio/bgm/` に置き、frontmatter の `bgm.credit` に出典を書く。書かなければ
`pnpm content:validate` が落ちる。そして **クレジットは動画の最後のカードに印字される。**
`lib/video/scenes.ts` が outro に `credits` を積み、両方のレンダラーがそれを描く。
「概要欄に書けばよい」ライセンスでも、動画本体に載っているほうが強い。

打鍵音（タイプ音）は `lib/video/canvas/sfx.ts` で合成しているので、
効果音のライセンスは発生しない。ここに載せる効果音は、それを差し替えたくなったとき用。

## 使える（クレジットだけでよい）

| ライブラリ | ライセンス | クレジット | 注意 |
| --- | --- | --- | --- |
| [魔王魂](https://maou.audio/rule/) | CC BY 4.0 | 「音楽：魔王魂」（動画内でも概要欄でも可） | 曲単体の再配布・ストリーミング配信・NFT は禁止。商用可、報告不要 |
| [OtoLogic](https://otologic.jp/free/license.html) | CC BY 4.0 | 「OtoLogic」とサイトへのリンク | BGM と効果音の両方。素材単体の再配布は不可 |
| [Kevin MacLeod / incompetech](https://incompetech.com/music/royalty-free/faq.html) | CC BY 4.0 | サイトが生成する定型文（曲名・作者・ライセンス URL） | YouTube 収益化可。クレジットは「見つけられる場所」に必須 |
| [Freesound](https://freesound.org/help/faq/) | 音ごとに CC0 / CC BY / CC BY-NC | CC BY のものは作者名と URL | **音ごとに違う。** BY-NC は商用不可なので使わない。CC0 は表記不要 |

## 使える（クレジット不要だが、書く）

| ライブラリ | ライセンス | 注意 |
| --- | --- | --- |
| [効果音ラボ](https://soundeffect-lab.info/agreement/) | 独自（商用可、表記任意） | 再配布禁止、直リンク禁止、**効果音を紹介する動画は禁止**、AI 学習禁止 |
| [DOVA-SYNDROME](https://dova-s.jp/_contents/license/) | 独自（商用可、表記は作曲者ごとに確認） | 背景音楽としての利用は可。音源を主役にする配信（作業用 BGM 等）は範囲外。政治・宗教コンテンツは禁止 |
| [Pixabay](https://pixabay.com/service/license-summary/) | Pixabay Content License | 表記不要。素材単体の再配布・販売は不可 |

表記が任意でも `bgm.credit` は必須のまま。理由は法的な要請ではなく編集上の約束で、
**動画の下に何が流れているかを読者が確かめられる** ことが、記事の source と同じ意味を持つ。

## 使わない

- **ゲーム内楽曲、ゲームプレイ動画の音声。** DDR の曲は KONAMI と各作曲者の権利物で、
  引用として主張できる範囲を超える。Content ID にも当たる。
- **AI 生成 BGM サービス。** 出典として読者が確かめられない。記事の「AI の出力は source
  にならない」と同じ理由。
- **「フリー」とだけ書かれた個人サイトの素材。** 規約本文が読めないものは条件が分からない。

## 手順

1. 上の表からダウンロードし、`public/audio/bgm/<name>.<m4a|mp3|wav|ogg>` に置く。
2. frontmatter に書く。

   ```yaml
   bgm:
     src: audio/bgm/shining-star.mp3
     credit: '音楽：魔王魂'
     gain: 0.3
   ```

3. `pnpm content:validate` を通す。`credit` が無ければここで止まる。
4. 書き出した動画の最後のカードに `MUSIC: 音楽：魔王魂` が出ていることを目で確かめる。
   YouTube に上げるなら概要欄にも同じ行を書く。CC BY の作者はそこを見る。

`content/fixtures/` のサンプルが鳴らしている `sample-loop.wav` は合成音で、
どのライブラリの音でもない。fixture が本物の楽曲を鳴らしてはいけない。

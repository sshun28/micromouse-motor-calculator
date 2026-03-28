# micromouse-motor-calculator

GitHub Pages で公開する、マイクロマウスのモータ出力に関する計算用の静的 Web サイトです。

現在は以下を実装しています。

- 車両パラメータ、モータパラメータ、動作点の入力フォーム
- 左右モータそれぞれの回転数、逆起電力、電流、Duty 比、出力、損失、電池電流、電池出力の計算
- 各計算結果ごとに、式と代入値を確認できる計算フローモーダル
- コア計算ロジックの ES Module 化
- Node 組み込みテストによる代表ケースの検証

## 使い方

- ブラウザで [index.html](./index.html) を開く
- もしくは静的ファイルサーバで公開する
- 計算結果の各項目にある `?` ボタンを押すと、計算の流れを確認できる

## テスト

```powershell
node --test
```

## Third-Party

- Color palette based on Catppuccin Macchiato: https://catppuccin.com/palette/
- Formula rendering in the calculation-flow dialog uses KaTeX via CDN: https://katex.org/
- License notice is included in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)

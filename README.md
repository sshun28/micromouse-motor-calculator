# micromouse-motor-calculator

GitHub Pages で公開する、マイクロマウスのモータ出力に関する計算用の静的 Web サイトです。

現在は以下を実装しています。

- 車両パラメータ、モータパラメータ、動作点の入力フォーム
- 左右モータそれぞれの回転数、逆起電力、電流、Duty 比、出力、損失、電池電流、電池出力の計算
- コア計算ロジックの ES Module 化
- Node 組み込みテストによる代表ケースの検証

## 使い方

- ブラウザで [index.html](./index.html) を開く
- もしくは静的ファイルサーバで公開する

## テスト

```powershell
node --test
```

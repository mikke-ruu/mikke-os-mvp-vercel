# mikkeOS Phase 4 Item Studio Supabase Test Mode

作成日: 2026-07-07

このメモは、Phase 4の3パターン確認後に追加した「1アプリ・1操作だけ」のSupabase保存テスト導線を記録するものです。

通常画面の保存先はまだSupabaseへ切り替えません。`/os` / `/log` / `/story` / `/desk` / 各ミニ画面の通常Activity Log追加はlocalStorageベースのままです。

## 1. 対象

対象は `/apps/item-studio` の「作品を登録」だけです。

理由:

- 既存MarketNote本体に影響しない
- 金額なし
- Story公開対象として扱いやすい
- 活動実績対象として自然
- DESK非集計なので安全

## 2. 実装範囲

追加:

- `lib/mikkeos/item-studio-supabase-test.ts`
- `components/mikkeos/AppMiniPage.tsx` のItem Studio限定テスト枠

変更しない:

- 既存MarketNote本体
- `lib/activity-log.ts`
- `/os` / `/log` / `/story` / `/desk` の読み取り元
- 各ミニ画面の通常保存先
- RLS / policy / constraint

## 3. 画面上の挙動

`/apps/item-studio` で「作品を登録」を選んだときだけ、`Supabase保存テスト` の枠を表示します。

通常の「この活動をActivity Logに追加」ボタンはlocalStorage保存のままです。

別ボタンの「この作品登録をSupabaseへテスト保存」を押したときだけ、Supabaseへ保存します。

## 4. 保存payload

UnifiedActivityLogから `toSupabaseActivityLogInsert()` を通して `activity_logs` payloadを作ります。

期待値:

| field | value |
| --- | --- |
| `source_service` | `item_studio` |
| `activity_type` | `item_created` |
| `category` | `product` |
| `visibility` | `public` |
| `display_on_story` | `true` |
| `display_in_timeline` | `true` |
| `display_as_achievement` | `true` |
| `counts_toward_summary` | `true` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| `payment_status` | `not_required` |
| `status` | `completed` |

## 5. insert / select確認

保存後、同じ `source_service = "item_studio"` と `source_record_id` でselectします。

画面には以下を表示します。

- insert結果
- select結果
- `source_record_id`
- Story対象か
- DESK対象か
- 活動実績対象か

## 6. Story / DESK / summary 判定

期待:

| target | expected |
| --- | --- |
| Story | 公開対象 |
| public Story policy | 読み取り可能 |
| DESK | 非集計 |
| 活動実績 | 含める |

Story公開対象になる理由:

- `visibility = "public"`
- `display_on_story = true`

DESK非集計になる理由:

- `has_financial_value = false`
- `amount = null`
- `transaction_type = "none"`

活動実績対象になる理由:

- `counts_toward_summary = true`

## 7. まだしないこと

- 通常画面の保存先をSupabaseへ切り替える
- 各ミニ画面を一斉にSupabase保存へ変える
- `/os` / `/log` / `/story` / `/desk` の読み取り元をSupabaseへ切り替える
- 既存MarketNote本体を変更する
- `lib/activity-log.ts` を変更する
- 金額ログの通常導線接続
- RLS / policy / constraintを変更する

## 8. 次の判断

このItem Studio単体テストでinsert/selectと公開Story policy確認が通ったら、次は以下を検討します。

1. テストログをDashboardで確認する。
2. テストログを残すか、`source_service = "item_studio"` と該当 `source_record_id` 限定で削除するか決める。
3. Supabase保存ON/OFFのfeature flag設計を固める。
4. localStorageとSupabaseを混ぜない読み取り設計を決める。
5. それでもまだMarketNote本体には触らない。

## 9. 2026-07-07 implementation check

実装済み:

- `/apps/item-studio` で「作品を登録」を選んだときだけ `Supabase保存テスト` 枠を表示。
- 通常の「この活動をActivity Logに追加」はlocalStorageのまま維持。
- 別ボタンの「この作品登録をSupabaseへテスト保存」だけがSupabase insert/selectを試す。
- 保存payloadは `toSupabaseActivityLogInsert()` を通す。
- 保存後は同じ `source_service = "item_studio"` / `source_record_id` でselect確認する。
- public Story policy確認用に匿名clientで読み取り確認する。

ブラウザ確認:

| check | result |
| --- | --- |
| `/apps/item-studio` 表示 | OK |
| 「作品を登録」表示 | OK |
| `Supabase保存テスト` 枠表示 | OK |
| テスト保存ボタン表示 | OK |
| localStorage通常ボタン維持 | OK |

保存テスト実行結果:

| check | result |
| --- | --- |
| insert | not attempted |
| select | not attempted |
| reason | browser session was not logged in |
| screen message | `Supabase test save needs a logged-in user.` |

この停止は想定どおりです。ログイン済みユーザーがいない状態では、RLSを通すための `user_id` / `profile_id` が確定できないため、insertを行いません。

次に実DB保存を確認する場合:

1. ブラウザでmikkeOSへログインする。
2. `/apps/item-studio` を開く。
3. 「作品を登録」を選ぶ。
4. 「この作品登録をSupabaseへテスト保存」を押す。
5. 画面上のinsert/select/Story/DESK/活動実績の結果を見る。

まだ通常画面の保存先はSupabaseへ切り替えません。

## 10. 2026-07-07 logged-in browser test result

ログイン済みのin-app browserで、`/apps/item-studio` の「作品を登録」Supabase保存テストを実行しました。

画面上の結果:

| check | result |
| --- | --- |
| browser login | OK |
| `/apps/item-studio` 表示 | OK |
| `Supabase保存テスト` 枠表示 | OK |
| test button click | OK |
| insert | ok |
| select | ok |
| Story | 公開対象 |
| DESK | 対象外 |
| 活動実績 | 含める |

保存された `source_record_id`:

```text
item-studio-test-2026-07-07T05:01:58.621Z-d74eb705-50d3-4dc9-8e6b-8a9309f59532
```

このテストで通ったpayloadの意図:

| field | expected |
| --- | --- |
| `source_service` | `item_studio` |
| `category` | `product` |
| `visibility` | `public` |
| `display_on_story` | `true` |
| `counts_toward_summary` | `true` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |

判定:

- Item Studioの「作品を登録」1操作は、現在のRLSと制約でinsert/selectできる。
- Story対象として扱える。
- DESK非対象として扱える。
- 活動実績対象として扱える。
- 通常のlocalStorage保存は引き続き変更していない。

補足:

- 画面のselect結果はOK。
- 画面のStory/DESK/活動実績判定も期待どおり。
- 別経路のNode実行によるDB再取得は、ローカル実行環境からSupabaseへのTLS接続が不安定だったため未完了。
- 追加のDB再取得が必要な場合は、同じ `source_record_id` に限定してDashboardまたは安定したネットワーク経路から確認する。

## 11. 2026-07-07 Item Studio sale log test result

ログイン済みのin-app browserで、`/apps/item-studio` の「販売を記録」Supabase保存テストを実行しました。

目的:

```text
金額ログは公開Storyや活動実績に混ぜず、DESK対象として保存される
```

画面上の結果:

| check | result |
| --- | --- |
| browser login | OK |
| `/apps/item-studio` 表示 | OK |
| `販売を記録` 選択 | OK |
| `Supabase保存テスト` 枠表示 | OK |
| test button click | OK |
| insert | ok |
| select | ok |
| `source_service` | `item_studio` |
| `category` | `product` |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |
| `amount` | `4800` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |
| Story | 対象外 |
| DESK | 集計対象 |
| 活動実績 | 対象外 |

保存された `source_record_id`:

```text
item-studio-sale-test-2026-07-07T05:41:13.228Z-c08117e7-a872-4525-a9f7-d036382e2b1a
```

判定:

- 販売ログはDESK対象。
- ただし金額ありログのため、Story非対象・活動実績非対象として扱う。
- `item_sold` の画面プリセットはStory表示を含むが、Supabase保存payloadではadapter側の安全方針を優先する。
- `shouldForcePrivateStory()` により、金額ありログは `visibility: private` / `display_on_story: false` / `counts_toward_summary: false` へ寄せられる。
- 通常のlocalStorage保存は引き続き変更していない。

補足:

- このテストはItem Studio内の「販売を記録」1パターンだけを対象にした。
- 通常保存のSupabase本接続、Order連携、`/log` のSupabase読み取り、RLS / policy / constraint には触れていない。

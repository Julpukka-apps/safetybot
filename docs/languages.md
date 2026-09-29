# Languages

Source of truth: `LANGUAGES` in `src/schema.ts`.

The default UI language is English. The picker includes Auto-detect plus every row below. Do not add a language that is not in this table.

| id | label | speech |
| --- | --- | --- |
| auto | Auto-detect | (empty) |
| en | English | en-US |
| fi | Suomi | fi-FI |
| ar | العربية | ar |
| cs | Čeština | cs-CZ |
| da | Dansk | da-DK |
| nl | Nederlands | nl-NL |
| fil | Filipino | fil-PH |
| fr | Français | fr-FR |
| de | Deutsch | de-DE |
| hi | हिन्दी | hi-IN |
| id | Bahasa Indonesia | id-ID |
| it | Italiano | it-IT |
| ja | 日本語 | ja-JP |
| ko | 한국어 | ko-KR |
| mk | Македонски | mk-MK |
| ms | Bahasa Melayu | ms-MY |
| fa | فارسی | fa-IR |
| pl | Polski | pl-PL |
| pt | Português | pt-PT |
| ro | Română | ro-RO |
| ru | Русский | ru-RU |
| es | Español | es-ES |
| sv | Svenska | sv-SE |
| th | ไทย | th-TH |
| tr | Türkçe | tr-TR |
| vi | Tiếng Việt | vi-VN |

`speech` is the tag sent to speech-to-text. Auto-detect sends an empty tag and follows the browser language for UI chrome when that language is in the table. Otherwise the UI stays English.

The selected language is stored in the browser (`localStorage` key `safetybot_lang`). Speech-to-text and the generated description follow that choice.

## Right to left

`ar` and `fa` set `dir="rtl"` on the document. Every other id uses left to right.

## Where the packs live

UI chrome is translated. English strings are the `en` object in `src/i18n.tsx`. Other packs are merged on top of English:

| File | Ids |
| --- | --- |
| `src/i18n.tsx` | `en`, `fi` |
| `src/locale-rest.ts` | `sv`, `de`, `fr`, `es` |
| `src/locale-more.ts` | the remaining ids, plus later copies of `sv`, `de`, `fr`, `es` |

A missing key falls back to English.

Packs still contain labels for older field keys that are not in `defaultLogic()`. Those labels are not seed fields. See [schema.md](schema.md).

## Add a language later

Do not add one in a docs-only change.

1. Add one row to `LANGUAGES` in `src/schema.ts`. Use a new `id`. Set `speech` to the tag the speech service expects.
2. Add a pack with the same keys as `en`. Put it in `src/locale-more.ts`, or in `src/i18n.tsx` if you are extending the small set there.
3. If the language is right to left, add its id to the RTL set in `src/i18n.tsx`.
4. Update this file and the Languages table in `README.md` in the same change.
5. Run `npm run build`.

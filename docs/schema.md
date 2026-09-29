# Schema

Source: `src/schema.ts`. `defaultLogic()` is the seed. `normalizeLogic()` fills anything a saved logic object omits.

`schema_version` is `1.0.0`. `app_name` is `SafetyBot`. `default_language` is `en`.

The seed is a generic construction-site set. Only `description` is required.

## Case types

Ids, in priority order:

| id | Label | Priority | Needs confirm | Hint |
| --- | --- | --- | --- | --- |
| `injury` | Injury | 1 | yes | Person was hurt |
| `near_miss` | Near miss | 2 | no | Something happened, nobody hurt |
| `good_practice` | Good practice | 3 | no | Praising something done well |
| `improvement_idea` | Idea | 4 | no | Proposal, no live hazard |
| `safety_observation` | Observation | 5 | no | Hazard or risk seen |

Each case type also has `enabled`.

## Logic the admin can edit

- `classification_rules`
- `description_template`
- `extract_system_prompt`
- `photo_prompt` — sent with every attached photo
- `stt_keyterms`
- `case_types`
- `fields`

## Field shape

| Property | Values |
| --- | --- |
| `type` | `text`, `textarea`, `enum`, `boolean`, `datetime`, `number` |
| `extract_from` | `speech`, `photo`, `both`, `none` |
| `show_if` | `null`, or `{ field, op, value }` |
| `show_if.op` | `eq`, `neq`, `in`, `not_in` |

`extract_from: none` is stored but not sent to the model. `show_if` hides the field until the condition matches. `case_type` is a valid `show_if.field` even though it is not a report field key.

## Seed fields

| key | label | type | required | extract_from | show_if |
| --- | --- | --- | --- | --- | --- |
| `description` | Description | textarea | yes | both | |
| `immediate_action` | Immediate action | text | no | both | |
| `site` | Site | text | no | both | |
| `area` | Area | text | no | both | |
| `activity` | Activity | text | no | both | |
| `hazard` | Hazard | enum | no | both | |
| `who` | Who | enum | no | both | |
| `company` | Company | text | no | speech | `who` eq `Subcontractor` |
| `incident_datetime` | When | datetime | no | none | default `now` |
| `what_happened` | What happened | textarea | no | both | `case_type` eq `near_miss` |
| `what_could_have_happened` | What could have happened | textarea | no | both | `case_type` eq `near_miss` |
| `potential_severity` | Potential severity | enum | no | both | `case_type` eq `near_miss` |
| `injured_role` | Injured person | text | no | both | `case_type` eq `injury` |
| `severity` | Severity | enum | no | both | `case_type` eq `injury` |
| `body_parts` | Body parts | text | no | both | `case_type` eq `injury` |
| `nature_of_injury` | Nature of injury | text | no | both | `case_type` eq `injury` |
| `what_was_done_well` | What was done well | textarea | no | both | `case_type` eq `good_practice` |
| `current_pain` | Current pain | textarea | no | speech | `case_type` eq `improvement_idea` |
| `proposed_change` | Proposed change | textarea | no | speech | `case_type` eq `improvement_idea` |
| `expected_benefit` | Expected benefit | textarea | no | speech | `case_type` eq `improvement_idea` |

`hazard` enums: Fall from height, Falling object, Collapse, Excavation, Electrical, Fire, Chemical, Slip or trip, Struck by, Caught in, Housekeeping, Other.

`who` enums: Worker, Subcontractor, Visitor, Public.

`potential_severity` enums: `minor`, `moderate`, `serious`, `fatal`.

`severity` enums: `first_aid`, `medical_treatment`, `restricted_work`, `lost_time`, `fatality`.

UI packs still have labels for older keys such as equipment, precise location, and business unit. Those keys are not in `defaultLogic()`. Do not document them as seed fields.

## Report row

`GET /api/reports` returns `reportToRow()`. Fixed columns, then one column per current field:

`id`, `created_at`, `case_type`, `case_label`, `confidence`, `language`, `source`, `transcript`, `first_line`, `photo_count`, `org_id`, `org_name`, `org_path`, `reporter_email`, `reporter_name`.

`source` is `grok` or `demo`. Photos are not in the row. `photo_count` is the number of photos.

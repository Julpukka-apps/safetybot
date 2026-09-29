# Schema

Source: `src/schema.ts`. `defaultLogic()` is the seed. `normalizeLogic()` fills anything a saved logic object omits.

`schema_version` is `1.0.0`. `app_name` is `SafetyBot`.

## Case types

Priority order in the seed:

| id | Label | Priority |
| --- | --- | --- |
| `injury` | Injury | 1 |
| `near_miss` | Near miss | 2 |
| `good_practice` | Good practice | 3 |
| `improvement_idea` | Idea | 4 |
| `safety_observation` | Observation | 5 |

## Logic fields the admin can edit

- `classification_rules`
- `description_template`
- `extract_system_prompt`
- `photo_prompt` — sent with every attached photo
- `stt_keyterms`
- `case_types`
- `fields`

## Report field keys

The seed is a construction-site set. Only `description` is required.

`description`, `immediate_action`, `site`, `area`, `activity`, `hazard`, `who`, `company`, `incident_datetime`, `what_happened`, `what_could_have_happened`, `potential_severity`, `injured_role`, `severity`, `body_parts`, `nature_of_injury`, `what_was_done_well`, `current_pain`, `proposed_change`, `expected_benefit`.

There is no elevator, escalator, door, end-user, or precise-location field. `company` shows only when `who` is Subcontractor. Case-specific fields show only for that case.

A stored report also carries `id`, `case_type`, `created_at`, `photos`, `transcript`, `language`, `org_id`, `org_name`, and `org_path`. `reportToRow()` in `src/schema.ts` is what `GET /api/reports` returns.

`extract_from` on a field is `speech`, `photo`, `both`, or `none`.

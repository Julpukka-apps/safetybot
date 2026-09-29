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

The seed defines these field keys:

`incident_datetime`, `description`, `immediate_action`, `business_unit`, `party_involved`, `equipment`, `precise_location`, `equipment_number`, `job_site_name`, `major_project`, `subcontractor_company`, `stop_and_go`, `why_work_stopped`, `classifier`, `confidential`, `what_happened`, `what_could_have_happened`, `potential_severity`, `injured_role`, `severity`, `body_parts`, `nature_of_injury`, `what_was_done_well`, `current_pain`, `proposed_change`, `expected_benefit`.

A stored report also carries `id`, `case_type`, `created_at`, `photos`, `transcript`, `language`, `org_id`, `org_name`, and `org_path`. `reportToRow()` in `src/schema.ts` is what `GET /api/reports` returns.

`extract_from` on a field is `speech`, `photo`, `both`, or `none`.

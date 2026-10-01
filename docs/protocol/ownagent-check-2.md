# ownagent-check/2

`ownagent-check/2` is the portable result contract for OwnAgent CLI, HTTP API,
GitHub checks and embedded/OEM runtimes.

Required semantics:

- `deltaSuccess` is candidate success rate minus baseline success rate.
- `pivotal` is present only when replacing one observation and propagating
  downstream flips the evaluated outcome.
- `coverage.incomplete` is true when no cases ran or deterministic coverage is
  below complete coverage. Consumers must not present an incomplete report as
  “fully checked”.
- `gate` is the decision after applying `.ownagent/policy.yml`, not a UI label.
- A BLOCK override must retain actor, reason, version and environment in audit.

The normative JSON Schema is
[`ownagent-check-2.schema.json`](./ownagent-check-2.schema.json).

## Compatibility

Readers should accept `ownagent-check/1` during migration. Writers emit v2.
Legacy fields `pivotalStepId` and `pivotalTool` may be included as aliases, but
the canonical representation is `pivotal`.

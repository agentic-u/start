# Adopted local semantics

Spellbook `20d2cfd0b09d49be59a757a5feb84829f08fd947`, packages/stack/src/Lock.ts, BindingChoice.ts and Connection.ts: binding alternatives, explicit leave transition and passed/not-future/max-age health. Page serialization and inference were excluded.

AgenticUdotsurf `2916b54bbf46c7e2a4bfbd2ebe6783ad6b9cefc8`, packages/graph/src/reads/readiness.ts and lock-freshness.ts: dependency-first manifest, exact sorted dependency basis, SHA-256 JSON manifest and exact-basis freshness. The public catalog generation pins all authored requirement/link/shape bytes; per-Need hashes additionally preserve exact source basis. No donor graph lock/store is persisted.

Grant lifecycle adopts Spellbook active/time/revoked/ended semantics, refined to exact binding revision/account/action/resource/budget. Historical grants cannot poison another grant. No outward adapter is included.

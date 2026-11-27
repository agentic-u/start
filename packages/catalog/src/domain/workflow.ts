import { Schema } from "effect";

const Text = Schema.NonEmptyString;

const Id = Schema.NonEmptyString;

const Ids = Schema.Array(Id);

const opt = Schema.optionalKey;

export const NotSaid = Schema.Struct({ not_said: Text });

const said = <S extends Schema.Top>(schema: S) =>
  Schema.Union([schema, NotSaid]);

export const Judgment = Schema.Literals([
  "fixed",
  "model",
  "person",
  "outside",
]);

export const Harm = Schema.Literals([
  "reads",
  "repeatable-write",
  "unrepeatable-write",
  "outward",
]);

export const Sight = Schema.Literals(["public", "private"]);

export const Kind = Schema.Struct({
  id: Id,
  says: Text,
  states: opt(Ids),
  sort_of: opt(Id),
});

export const Condition = Schema.Union([
  Text,
  Schema.TaggedStruct("state", { thing: Id, state: Id }),
  Schema.TaggedStruct("exists", { thing: Id }),
  Schema.TaggedStruct("measure", {
    measure: Id,
    at_least: opt(Schema.Number),
    at_most: opt(Schema.Number),
  }),
  Schema.TaggedStruct("claim", { claim: Id }),
]);

export const Amount = Schema.Struct({
  amount: Schema.Number,
  of: Text,
  per: opt(Text),
});

export const Grant = Schema.Struct({
  id: Id,
  to: Id,
  from: opt(Id),
  given_by: Text,
  harm: Harm,
  touch: Schema.Array(Text),
  never: opt(Schema.Array(Text)),
  budget: Schema.Array(Amount),
  state: Schema.Literals(["active", "suspended", "revoked", "expired"]),
  until: opt(Text),
});

export const Failure = Schema.Struct({
  when: Schema.Literals([
    "fails",
    "crashes",
    "interrupted",
    "times-out",
    "cancelled",
  ]),
  level: Schema.Literals(["passing", "retryable", "undoable", "raise", "stop"]),
  do: Schema.Union([
    Schema.TaggedStruct("retry", {
      at_most: Schema.Int,
      wait_seconds: opt(Schema.Number),
    }),
    Schema.TaggedStruct("undo", { by: Id }),
    Schema.TaggedStruct("raise", { to: Id }),
    Schema.TaggedStruct("go-on", {}),
    Schema.TaggedStruct("stop", {}),
  ]),
});

export const Family = Schema.Literals([
  "capture",
  "segment",
  "extract",
  "normalize",
  "model",
  "diagnose",
  "decide",
  "hydrate-authority",
  "compile-work",
  "delegate",
  "join",
  "run-tool",
  "run-command",
  "call-api",
  "build-data-plane",
  "materialize",
  "measure",
  "write-graph",
  "make-artifact",
  "open-gate",
  "resolve-gate",
  "compact",
  "resume",
  "verify",
  "admit",
  "reconcile",
  "project",
  "adapt",
  "quote",
  "interpret",
]);

export const Actor = Schema.Struct({
  id: Id,
  name: Text,
  sort: Schema.Literals(["person", "agent", "script", "service"]),
  role: Text,
  model: opt(Text),
  decides: opt(Schema.Array(Text)),
  autonomy: opt(Schema.Int),
});

export const Thing = Schema.Struct({
  id: Id,
  name: Text,
  is: said(Text),
  form: opt(Text),
  comes_from: Schema.Literals(["step", "brought", "run"]),
  brought_by: opt(Id),
  needed_when: opt(Text),
  expect: opt(Schema.Struct({ count: Schema.Number, unit: opt(Text) })),
  for: opt(Text),
  stays_open: opt(Schema.Boolean),
  kept: opt(Schema.Boolean),
  starts_as: opt(Id),
  view_of: opt(Ids),
  quotes: opt(Id),
});

export const Need = Schema.Struct({
  id: Id,
  name: Text,
  sort: Text,
  otherwise: opt(Text),
});

export const Gate = Schema.Struct({
  id: Id,
  before: Id,
  owner: Id,
  asks: Text,
  crossing: opt(Id),
  can_be_undone: Schema.Boolean,
  cost: opt(Text),
  options: opt(Schema.Array(Text)),
  recommends: opt(Text),
  evidence: opt(Ids),
  while_waiting: opt(
    said(
      Schema.Struct({
        until: Text,
        on_timeout: Schema.Union([
          Schema.Literals(["stop", "leave", "no"]),
          Schema.Struct({ go_to: Id }),
        ]),
        if_late: Schema.Literals(["drop", "take", "undo"]),
      })
    )
  ),
});

export const Step = Schema.Struct({
  id: Id,
  name: Text,
  stage: opt(Id),
  lane: opt(Id),
  by: said(Id),
  with: opt(Ids),
  takes: Ids,
  may_take: opt(Ids),
  makes: Ids,
  changes: opt(Ids),
  needs: Ids,
  family: opt(Family),
  under: opt(Id),
  before: said(Schema.Array(Condition)),
  after: said(Schema.Array(Condition)),
  satisfies: opt(Ids),
  advances: opt(Ids),
  blocks: opt(Ids),
  unblocks: opt(Ids),
  evidence_owed: opt(Schema.Array(Text)),
  receipts_owed: opt(Schema.Array(Text)),
  budget: opt(Schema.Array(Amount)),
  timeout_minutes: opt(Schema.Number),
  window: opt(Schema.Struct({ from: opt(Text), to: opt(Text) })),
  repeat_key: opt(Text),
  fence: opt(Schema.Literals(["before", "after", "none"])),
  judgment: said(Judgment),
  harm: said(Harm),
  may_touch: said(Schema.Array(Text)),
  settles: Ids,
  keeps: opt(Ids),
  how: opt(Text),
  minutes: opt(Schema.Number),
  minutes_from: opt(Text),
  on_failure: opt(said(Schema.Union([Text, Schema.Array(Failure)]))),
});

const Arm = Schema.Struct({
  if: Text,
  to: Schema.Union([Id, Schema.Struct({ outside: Text })]),
});

export const Join = Schema.Union([
  Schema.TaggedStruct("then", { from: Id, to: Id }),
  Schema.TaggedStruct("beside", {
    step: Id,
    while: said(Ids),
    merge: opt(Text),
  }),
  Schema.TaggedStruct("meet", {
    into: Id,
    of: Ids,
    rule: Schema.Union([
      Schema.Literals(["all", "any"]),
      Schema.Struct({ some: Schema.Int }),
      Schema.Struct({
        agree: Schema.Int,
        weights: opt(Schema.Record(Id, Schema.Number)),
      }),
      Schema.Struct({ failures_at_most: Schema.Int }),
    ]),
    cancel_rest: opt(Schema.Boolean),
    same_if: opt(Text),
    settled_by: opt(Id),
  }),
  Schema.TaggedStruct("wait", {
    id: Id,
    before: Id,
    for: Schema.Union([
      Schema.Struct({ minutes: Schema.Number }),
      Schema.Struct({ time: Text }),
      Schema.Struct({
        event: Text,
        deadline: Text,
        if_late: Schema.Literals(["drop", "take", "undo"]),
      }),
    ]),
  }),
  Schema.TaggedStruct("trigger", { event: Text, starts: Id }),
  Schema.TaggedStruct("route", {
    id: Id,
    at: Id,
    cases: Schema.Array(Schema.Struct({ if: Text, to: Id })),
    otherwise: opt(Id),
    delivery: Schema.Literals(["once", "at-least-once", "best-effort"]),
    partition: opt(Text),
    same_if: opt(Text),
  }),
  Schema.TaggedStruct("cancel", { step: Id, also: Ids }),
  Schema.TaggedStruct("link", {
    from: Id,
    to: Id,
    sort: Schema.Literals([
      "causes",
      "blocks",
      "informs",
      "retry-of",
      "requires",
    ]),
  }),
  Schema.TaggedStruct("interpret", { step: Id, thing: Id }),
  Schema.TaggedStruct("resume", { step: Id, from: Id }),
  Schema.TaggedStruct("only-if", { step: Id, when: Text }),
  Schema.TaggedStruct("branch", {
    id: Id,
    at: Id,
    asks: Text,
    settled_by: opt(Id),
    arms: Schema.Array(Arm),
  }),
  Schema.TaggedStruct("loop", {
    id: Id,
    name: Text,
    from: Id,
    to: Id,
    when: Text,
    at_most: said(Schema.Int),
    progress: opt(Text),
  }),
  Schema.TaggedStruct("retry", { step: Id, at_most: Schema.Int }),
  Schema.TaggedStruct("undo", { step: Id, by: Id }),
  Schema.TaggedStruct("hand-off", {
    from: Id,
    to: Id,
    gives: Ids,
    no_longer_true: opt(Schema.Array(Text)),
  }),
  Schema.TaggedStruct("call", {
    step: Id,
    workflow: Id,
    version: said(Text),
    pin: opt(Text),
    mode: opt(Schema.Literals(["inline", "nested"])),
    gives: opt(Schema.Record(Id, Id)),
    returns: opt(Schema.Record(Id, Id)),
    grant: opt(Id),
    bound: opt(
      Schema.Struct({ depth: Schema.Int, calls: Schema.Int, progress: Text })
    ),
    on_failure: opt(Schema.Literals(["fail", "retry", "undo", "go-on"])),
  }),
  Schema.TaggedStruct("ways", {
    step: Id,
    ways: Schema.Array(Schema.Struct({ id: opt(Id), name: Text })),
  }),
]);

export const Unknown = Schema.Struct({
  id: Id,
  sort: Schema.Literals(["question", "assumption", "open"]),
  text: Text,
  why: Text,
  stage: opt(Id),
  lane: opt(Id),
  guess: Text,
  chance: Schema.Number,
  stakes: Text,
  if_wrong: opt(Text),
  blocks: opt(Ids),
  bears_on: Ids,
  probe: Text,
  probe_minutes: Schema.Number,
  who: Text,
  known_by: Text,
  meanwhile: opt(Text),
});

export const Source = Schema.Struct({
  id: Id,
  what: Text,
  where: Text,
  covers: Text,
  hash: opt(Text),
  receipt: opt(Text),
  view_of: opt(Ids),
});

export const Segment = Schema.Struct({
  id: Id,
  source: Id,
  from: Schema.Number,
  to: Schema.Number,
});

export const Claim = Schema.Struct({
  id: Id,
  text: Text,
  state: Schema.Literals(["supported", "unknown", "conflicted"]),
  evidence: Ids,
  against: opt(Ids),
});

export const Objective = Schema.Struct({
  id: Id,
  says: Text,
  measure: opt(Id),
  met_when: Text,
});

export const Assessment = Schema.Struct({
  id: Id,
  claim: Id,
  objective: Id,
  reads: Schema.Literals([
    "constrains",
    "risks",
    "leaves-a-gap",
    "supports",
    "violates",
    "meets",
  ]),
  evidence: Ids,
});

export const Known = Schema.Struct({
  sources: opt(Schema.Array(Source)),
  segments: opt(Schema.Array(Segment)),
  claims: opt(Schema.Array(Claim)),
  assessments: opt(Schema.Array(Assessment)),
  facts: Schema.Array(Schema.Struct({ id: Id, text: Text, source: Text })),
  unknowns: Schema.Array(Unknown),
  tacit: Schema.Array(
    Schema.Struct({
      id: Id,
      text: Text,
      holder: Text,
      capture: Text,
      unknown: opt(Id),
    })
  ),
  blind_spots: Schema.Array(
    Schema.Struct({ id: Id, where: Text, earliest: Text, watch_for: Text })
  ),
});

export const Standing = Schema.Struct({
  every: Schema.Union([
    Schema.Struct({ minutes: Schema.Number }),
    Schema.Struct({ event: Text }),
  ]),
  feedback: Schema.Array(
    Schema.Struct({
      measure: Id,
      changes: Id,
      how: Text,
      after_minutes: opt(Schema.Number),
    })
  ),
  constraint: said(Id),
  state: Schema.Literals(["ramping", "stable", "declining", "stopped"]),
});

export const Monitor = Schema.Struct({
  id: Id,
  watches: Id,
  when: Text,
  every_seconds: opt(Schema.Number),
  do: Schema.Literals(["slow", "raise", "cancel", "reroute", "note"]),
  to: opt(Id),
});

export const Capability = Schema.Struct({ id: Id, says: Text, sight: Sight });

export const Way = Schema.Struct({
  id: Id,
  capability: Id,
  name: Text,
  workflow: opt(Id),
  sight: Sight,
});

export const Link = Schema.Struct({
  id: Id,
  sort: Text,
  roles: Schema.Record(Text, Ids),
  evidence: Ids,
  since: opt(Text),
  sight: Sight,
});

// oxlint-disable-next-line eslint/no-redeclare -- The stable public schema API exposes both its value and inferred type by this name.
export const Workflow = Schema.Struct({
  id: Id,
  sight: opt(Sight),
  capability: opt(Id),
  owner: opt(Id),
  kinds: opt(Schema.Array(Kind)),
  grants: opt(Schema.Array(Grant)),
  objectives: opt(Schema.Array(Objective)),
  monitors: opt(Schema.Array(Monitor)),
  parameters: opt(
    Schema.Array(Schema.Struct({ id: Id, name: Text, is: Text }))
  ),
  version: Text,
  title: Text,
  goal: Text,
  why: opt(Text),
  for: opt(Text),
  standing: Schema.Union([Schema.Literal(false), Standing]),
  history: Schema.Array(
    Schema.Struct({ version: Text, date: Text, changed: Text, why: opt(Text) })
  ),
  stages: Schema.Array(Schema.Struct({ id: Id, name: Text, done_when: Text })),
  lanes: Schema.Array(
    Schema.Struct({ id: Id, name: Text, level: Text, for: Text })
  ),
  actors: Schema.Array(Actor),
  things: Schema.Array(Thing),
  needs: Schema.Array(Need),
  gates: Schema.Array(Gate),
  steps: Schema.Array(Step),
  joins: Schema.Array(Join),
  known: Known,
  rules: Schema.Array(
    Schema.Struct({ id: Id, text: Text, by: Text, date: opt(Text) })
  ),
  measures: Schema.Array(
    Schema.Struct({
      id: Id,
      name: Text,
      at: Id,
      of: opt(Id),
      expect: said(Schema.Number),
      unit: opt(Text),
    })
  ),
});

export type Workflow = typeof Workflow.Type;

export const Receipt = Schema.Struct({
  id: opt(Id),
  step: Id,
  changed: Text,
  where: Text,
  ok: opt(Schema.Boolean),
  at: opt(Text),
  by: opt(Id),
  under: opt(Id),
  gate: opt(Id),
  hash: opt(Text),
  key: opt(Text),
  spent: opt(Schema.Array(Amount)),
  admitted_on: opt(Text),
});

export const State = Schema.Literals([
  "pending",
  "ready",
  "running",
  "done",
  "failed",
  "blocked",
  "at-gate",
  "skipped",
  "cancelled",
]);

export const Choice = Schema.Struct({
  chose: Id,
  over: Ids,
  because: Text,
  held_back_by: opt(Schema.Array(Text)),
  from: Text,
  by: Text,
});

export const Left = Schema.Struct({
  id: Id,
  sort: Schema.Literals([
    "blocked-source",
    "blocked-gate",
    "unknown",
    "deferred",
  ]),
  why: Text,
  blocked_by: Ids,
  steps: Ids,
});

// oxlint-disable-next-line eslint/no-redeclare -- The stable public schema API exposes both its value and inferred type by this name.
export const Run = Schema.Struct({
  workflow: Id,
  version: Text,
  context: Text,
  made: opt(Text),
  sight: opt(Sight),
  values: opt(Schema.Record(Id, Text)),
  steps: Schema.Array(
    Schema.Struct({
      step: Id,
      state: said(State),
      why: opt(Text),
      note: opt(Text),
    })
  ),
  receipts: Schema.Array(Receipt),
  events: opt(
    Schema.Array(
      Schema.Struct({ key: Text, step: Id, from: State, to: State, at: Text })
    )
  ),
  gates: opt(
    Schema.Array(
      Schema.Struct({
        gate: Id,
        state: Schema.Literals(["open", "yes", "no", "timed-out"]),
        answer: opt(Text),
        by: opt(Id),
        at: opt(Text),
      })
    )
  ),
  assignments: opt(
    Schema.Array(Schema.Struct({ step: Id, to: Id, until: opt(Text) }))
  ),
  calls: opt(
    Schema.Array(
      Schema.Struct({
        step: Id,
        run: Id,
        pin: Text,
        depth: Schema.Int,
        outcome: State,
      })
    )
  ),
  undone: opt(
    Schema.Array(
      Schema.Struct({
        step: Id,
        receipt: Id,
        outcome: Schema.Literals(["undone", "failed", "not-needed"]),
        compared: Schema.Literals([
          "same-as-before",
          "different",
          "cannot-see",
        ]),
      })
    )
  ),
  failures: opt(
    Schema.Array(
      Schema.Struct({ step: Id, try: Schema.Int, level: Text, cause: Text })
    )
  ),
  checks: opt(
    Schema.Array(
      Schema.Struct({
        of: Id,
        passed: Schema.Boolean,
        found: Schema.Array(Text),
      })
    )
  ),
  choices: opt(Schema.Array(Choice)),
  compacts: opt(
    Schema.Array(
      Schema.Struct({ id: Id, of: Text, keeps: Ids, sources: Ids, left: Ids })
    )
  ),
  differences: opt(
    Schema.Array(Schema.Struct({ field: Text, expected: Text, actual: Text }))
  ),
  left: opt(Schema.Array(Left)),
  heartbeat: opt(
    Schema.Struct({
      last: Text,
      waiting: Schema.Record(Id, Schema.Int),
      through: opt(Amount),
    })
  ),
  misses: Schema.Array(
    Schema.Struct({
      id: Id,
      name: Text,
      at: Id,
      stage: opt(Id),
      lane: opt(Id),
      by: Id,
      takes: Ids,
      gave: Ids,
      assumed: Text,
      true: Text,
      changed: Text,
      minutes: opt(Schema.Number),
    })
  ),
  corrections: Schema.Array(
    Schema.Struct({ thing: Id, from: Text, at_second: Schema.Number })
  ),
  things: Schema.Array(
    Schema.Struct({
      thing: Id,
      at: opt(Text),
      note: opt(Text),
      counted: opt(Schema.Number),
      counted_note: opt(Text),
      counted_parts: opt(Schema.Record(Text, Schema.Number)),
    })
  ),
  needs: Schema.Array(
    Schema.Struct({ need: Id, state: Text, note: opt(Text) })
  ),
  answers: Schema.Array(
    Schema.Struct({
      unknown: Id,
      state: Schema.Literals(["open", "answered", "moot"]),
      answer: opt(Text),
      at: opt(Text),
      guess_held: opt(Schema.Boolean),
      why_moot: opt(Text),
      evidence: opt(Schema.Array(Text)),
    })
  ),
  moves: Schema.Array(
    Schema.Struct({
      at_second: Schema.Number,
      steps: Ids,
      done: opt(Ids),
      doing: opt(Ids),
      blocked: opt(Ids),
    })
  ),
  working: Schema.Array(
    Schema.Struct({
      actor: Id,
      steps: Ids,
      model: Text,
      doing: Text,
      as: Text,
      told_by: Text,
    })
  ),
  learned: Schema.Array(Schema.Struct({ level: Text, text: Text })),
  measures: Schema.Array(
    Schema.Struct({ measure: Id, read: opt(Schema.Number), note: opt(Text) })
  ),
});

export type Run = typeof Run.Type;

const strict = { errors: "all", onExcessProperty: "error" } as const;

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This public parser admits untrusted source bytes once; callers cannot override strict excess-property admission.
export const readWorkflow = (input: unknown) =>
  Schema.decodeUnknownSync(Workflow)(input, strict);

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This public parser admits untrusted run bytes once; callers cannot override strict excess-property admission.
export const readRun = (input: unknown) =>
  Schema.decodeUnknownSync(Run)(input, strict);

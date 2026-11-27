// @effect-diagnostics-next-line nodeBuiltinImport:off
import { execFile } from "node:child_process";
// @effect-diagnostics asyncFunction:off globalDate:off -- This Node host adapter encloses transaction lifetime and subprocess Promises in boundary(); time is injected by callers or sampled at the host entry point.
// @effect-diagnostics-next-line nodeBuiltinImport:off -- This package is the Node host adapter: SQLite and fixed git subprocess calls are translated once by boundary() into the public typed Effect error channel.
import { createHash, randomUUID } from "node:crypto";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { mkdir, chmod, realpath } from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import type { Catalog } from "@agentic-u/catalog";
import { Effect, Schema } from "effect";

const Text = Schema.NonEmptyString;

const { resolve, join } = path;

const hash = (value: Schema.Json): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const run = promisify(execFile);

export class LocalError extends Schema.TaggedError<
  LocalError,
  { readonly brand: unique symbol }
>()("LocalError", {
  reason: Schema.Literals([
    "io",
    "invalid",
    "busy",
    "not-found",
    "stale",
    "unsupported-adapter",
    "missing-binding",
    "denied",
  ]),
  message: Schema.String,
  next: Schema.String,
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

const failure = (
  reason: LocalError["reason"],
  message: string,
  next: string,
  cause?: unknown
) =>
  cause === undefined
    ? new LocalError({ reason, message, next })
    : new LocalError({ reason, message, next, cause });

const boundary = <A>(body: () => Promise<A>) =>
  Effect.tryPromise({
    try: body,
    catch: (cause) =>
      Schema.is(LocalError)(cause)
        ? cause
        : failure(
            "io",
            "Local state operation failed.",
            "Check local directory permissions and retry.",
            cause
          ),
  });

export const Endpoint = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("git"), repository: Text }),
  Schema.Struct({
    kind: Schema.Literal("browse"),
    url: Text,
    mcpServer: Text,
    executable: Text,
    version: Text,
    browser: Text,
    profile: Text,
    port: Schema.Finite,
  }),
]);

export const Account = Schema.Struct({ provider: Text, id: Text, alias: Text });

export const Selection = Schema.Struct({
  adapter: Text,
  endpoint: Endpoint,
  account: Schema.NullOr(Account),
});

const Choice = Schema.Struct({ id: Text, name: Text, means: Text });

const identity = {
  key: Text,
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Adopted binding wire contract names its requirement interface shape.
  shape: Text,
  purpose: Schema.NullOr(Text),
  revision: Text,
};

export const Binding = Schema.Union([
  Schema.Struct({
    ...identity,
    state: Schema.Literal("bound"),
    tool: Text,
    access: Text,
    ...Selection.fields,
    endpoint: Endpoint.check(
      Schema.makeFilter(
        (endpoint) =>
          endpoint.kind !== "git" || path.isAbsolute(endpoint.repository)
      )
    ),
  }),
  Schema.Struct({
    ...identity,
    state: Schema.Literal("two"),
    choices: Schema.NonEmptyArray(Choice),
    meanwhile: Text,
  }),
  Schema.Struct({
    ...identity,
    state: Schema.Literal("none"),
    choices: Schema.NonEmptyArray(Choice),
  }),
  Schema.Struct({
    ...identity,
    state: Schema.Literal("waiting"),
    tool: Text,
    adapter: Text,
    needed: Text,
  }),
  Schema.Struct({
    ...identity,
    state: Schema.Literal("keptOut"),
    tool: Text,
    adapter: Text,
    on: Text,
  }),
]);

export type BindingValue = typeof Binding.Type;

export const Fit = Schema.Struct({
  way: Text,
  generation: Text,
  manifest: Text,
  restsOn: Schema.Record(Text, Text),
  requirements: Schema.Array(Text),
});

export const Receipt = Schema.Struct({
  id: Text,
  way: Text,
  generation: Text,
  requirement: Text,
  checkId: Text,
  checkVersion: Text,
  binding: Text,
  revision: Text,
  digest: Text,
  result: Schema.Literals(["passed", "failed", "inconclusive"]),
  at: Schema.Finite,
  validForMs: Schema.Finite,
  evidence: Schema.Array(Text),
  outputHash: Text,
});

export const RequirementStanding = Schema.Struct({
  id: Text,
  state: Schema.Literals([
    "missing",
    "stale",
    "bound",
    "two",
    "none",
    "waiting",
    "keptOut",
    "unsupported",
    "unchecked",
    "passed",
    "failed",
    "inconclusive",
  ]),
  next: Text,
  receipt: Schema.optionalKey(Text),
});

export const PlanOutput = Schema.Struct({
  ...Fit.fields,
  selected: Schema.Boolean,
  fresh: Schema.Boolean,
  requirements: Schema.Array(RequirementStanding),
});

export const GetOutput = Fit;

export const CheckOutput = Schema.Array(Receipt);

export const StatusOutput = Schema.Struct({
  generation: Text,
  ways: Schema.Array(PlanOutput),
  authority: Text,
});

export const Grant = Schema.Struct({
  id: Text,
  binding: Text,
  revision: Text,
  account: Account,
  action: Text,
  resource: Text,
  budget: Schema.Finite,
  state: Schema.Literals(["active", "revoked", "ended"]),
  given: Schema.Finite,
  ends: Schema.Finite,
  secretRef: Text,
});

const State = Schema.Struct({
  format: Schema.Literal("agenticu-local/1"),
  fits: Schema.Array(Fit),
  bindings: Schema.Array(Binding),
  checks: Schema.Array(Receipt),
  grants: Schema.Array(Grant),
});

type LocalState = typeof State.Type;

const empty = (): LocalState => ({
  format: "agenticu-local/1",
  fits: [],
  bindings: [],
  checks: [],
  grants: [],
});

const pathOf = (house: string) => join(resolve(house), ".agenticu");

const database = async (house: string) => {
  const directory = pathOf(house);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = join(directory, "capability.sqlite");
  const db = new DatabaseSync(filename);
  await chmod(filename, 0o600);
  db.exec(
    "PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS capability (id INTEGER PRIMARY KEY CHECK (id=1), value TEXT NOT NULL)"
  );

  return db;
};

const readState = (db: DatabaseSync): LocalState => {
  const row = db.prepare("SELECT value FROM capability WHERE id=1").get();

  if (row === undefined) {
    return empty();
  }

  try {
    return Schema.decodeUnknownSync(Schema.fromJsonString(State))(row.value);
  } catch (error) {
    throw failure(
      "invalid",
      "Invalid local capability record.",
      "Repair the private capability record from its source; it was not replaced.",
      error
    );
  }
};

const load = async (house: string): Promise<LocalState> => {
  const db = await database(house);

  try {
    return readState(db);
  } finally {
    db.close();
  }
};

const mutate = async <A>(
  house: string,
  f: (state: LocalState) => readonly [LocalState, A]
): Promise<A> => {
  const db = await database(house);
  let begun = false;

  try {
    db.exec("BEGIN IMMEDIATE");
    begun = true;
    const [state, result] = f(readState(db));
    db.prepare(
      "INSERT INTO capability(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(state));
    db.exec("COMMIT");
    begun = false;

    return result;
  } catch (error) {
    if (begun) {
      db.exec("ROLLBACK");
    }

    throw error;
  } finally {
    db.close();
  }
};

const basis = (catalog: Catalog, way: string) => {
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Preserve adopted manifest wire key.
  if (way === "runtime:git") {
    return {
      way,
      requirements: ["runtime:git"],
      restsOn: { "runtime:git": "git-repository/1" },
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Exact adopted manifest wire field.
      manifest: hash([{ id: "runtime:git@1", shape: "git-repository@1" }]),
      generation: catalog.generation,
    };
  }

  const id = way.startsWith("workflow:") ? way : `workflow:${way}`;
  const needs = catalog.workflowNeeds.get(id);

  if (needs === undefined) {
    throw failure(
      "not-found",
      `No workflow requirements for ${way}.`,
      "Choose a workflow from au find."
    );
  }

  const entries: readonly (readonly [string, string])[] = [
    [id, catalog.generation],
    ...needs.map((n) => [n.id, hash(n)] as const),
  ];

  const restsOn = Object.fromEntries(
    entries.toSorted(([a], [b]) => a.localeCompare(b))
  );

  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Preserve adopted manifest wire key.
  return {
    way: id,
    requirements: needs.map((n) => n.id),
    restsOn,
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Exact adopted manifest wire field.
    manifest: hash(needs.map((n) => ({ id: n.id, shape: hash(n) }))),
    generation: catalog.generation,
  };
};

const current = (fit: typeof Fit.Type, wanted: ReturnType<typeof basis>) =>
  fit.generation === wanted.generation &&
  fit.manifest === wanted.manifest &&
  JSON.stringify(fit.restsOn) === JSON.stringify(wanted.restsOn);

const standing = (
  state: LocalState,
  wanted: ReturnType<typeof basis>,
  now: number
): typeof PlanOutput.Type => {
  const fit = state.fits.find((f) => f.way === wanted.way);
  const fresh = fit !== undefined && current(fit, wanted);

  return {
    ...wanted,
    selected: fit !== undefined,
    fresh,
    requirements: wanted.requirements.map(
      (id): typeof RequirementStanding.Type => {
        const binding = state.bindings.find((b) => b.key === id);

        if (!fresh) {
          return {
            id,
            state: fit === undefined ? "missing" : "stale",
            next: "Run get for this exact catalog generation.",
          };
        }

        if (binding === undefined || binding.state !== "bound") {
          return {
            id,
            state: binding?.state ?? "missing",
            next: "Select an exact local binding; authored Need text is not a check.",
          };
        }

        if (id !== "runtime:git" || binding.adapter !== "git") {
          return {
            id,
            state: "unsupported",
            next: `No fixed check adapter is registered for ${id} / ${binding.adapter}.`,
          };
        }

        const receipt = state.checks.findLast(
          (r) =>
            r.way === wanted.way &&
            r.requirement === id &&
            r.generation === wanted.generation &&
            r.binding === binding.key &&
            r.revision === binding.revision &&
            r.digest === hash(binding) &&
            r.checkId === "git-repository" &&
            r.checkVersion === "1"
        );

        if (receipt === undefined) {
          return {
            id,
            state: "unchecked",
            next: "Run check for this binding revision.",
          };
        }

        const healthy =
          receipt.result === "passed" &&
          receipt.at <= now &&
          now - receipt.at <= receipt.validForMs;

        const outcome = receipt.result === "passed" ? "stale" : receipt.result;

        return {
          id,
          state: healthy ? "passed" : outcome,
          receipt: receipt.id,
          next: healthy
            ? "Read-only git observation is current; outward actions still require authority."
            : "Run check again and inspect its evidence.",
        };
      }
    ),
  };
};

export const plan = (
  catalog: Catalog,
  way: string,
  house: string,
  now = Date.now()
) =>
  boundary(async () => standing(await load(house), basis(catalog, way), now));

export const get = (catalog: Catalog, way: string, house: string) =>
  boundary(() =>
    mutate(house, (state) => {
      const wanted = basis(catalog, way);

      return [
        {
          ...state,
          fits: [...state.fits.filter((f) => f.way !== wanted.way), wanted],
        },
        wanted,
      ] as const;
    })
  );

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This is the explicit selection admission boundary; the schema consumes the unknown immediately.
export const admitSelection = (input: unknown) =>
  Schema.decodeUnknownEffect(Selection)(input).pipe(
    Effect.mapError((cause) =>
      failure(
        "invalid",
        "Invalid exact binding.",
        "Supply an endpoint and explicit account or null.",
        cause
      )
    )
  );

export const bind = (
  house: string,
  requirement: string,
  selection: typeof Selection.Type
) =>
  boundary(async () => {
    const houseRoot = resolve(house);
    let { endpoint } = selection;

    if (endpoint.kind === "git") {
      const absolute = resolve(houseRoot, endpoint.repository);
      let repository: string;

      try {
        repository = await realpath(absolute);
      } catch (error) {
        if (
          !Schema.is(Schema.Struct({ code: Schema.Literal("ENOENT") }))(error)
        ) {
          throw error;
        }

        repository = absolute;
      }

      endpoint = { kind: "git", repository };
    }

    return mutate(houseRoot, (state) => {
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Preserve adopted binding wire key.
      const binding: BindingValue = {
        key: requirement,
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Exact adopted binding wire field.
        shape: requirement,
        purpose: null,
        revision: randomUUID(),
        state: "bound",
        tool: selection.adapter,
        access: "Read only.",
        ...selection,
        endpoint,
      };

      return [
        {
          ...state,
          bindings: [
            ...state.bindings.filter((b) => b.key !== requirement),
            binding,
          ],
        },
        binding,
      ] as const;
    });
  });

export const chooseBinding = (
  binding: BindingValue,
  choice: string
): Effect.Effect<BindingValue, LocalError> => {
  if (binding.state !== "two" && binding.state !== "none") {
    return Effect.fail(
      failure(
        "invalid",
        "Binding choice is not open.",
        "Choose an open binding."
      )
    );
  }

  const selected = binding.choices.find((c) => c.id === choice);

  if (selected === undefined) {
    return Effect.fail(
      failure(
        "invalid",
        "Unknown binding choice.",
        "Choose one of the offered IDs."
      )
    );
  }

  if (choice === "leave") {
    return Effect.succeed(binding);
  }

  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Preserve adopted binding wire key; exact endpoint admission follows the choice.
  return Effect.succeed({
    key: binding.key,
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Exact adopted binding wire field.
    shape: binding.shape,
    purpose: binding.purpose,
    revision: randomUUID(),
    state: "waiting",
    tool: selected.name,
    adapter: selected.id,
    needed: selected.means,
  });
};

export const check = (
  catalog: Catalog,
  way: string,
  house: string,
  now = Date.now()
) =>
  boundary(async () => {
    const state = await load(house);
    const wanted = basis(catalog, way);
    const fit = state.fits.find((f) => f.way === wanted.way);

    if (fit === undefined || !current(fit, wanted)) {
      throw failure(
        "stale",
        "Selection does not match the exact current catalog basis.",
        "Run get, then check."
      );
    }

    const receipts: (typeof Receipt.Type)[] = [];

    for (const id of wanted.requirements) {
      const binding = state.bindings.find((b) => b.key === id);

      if (binding === undefined || binding.state !== "bound") {
        throw failure(
          "missing-binding",
          `No selected binding for ${id}.`,
          "Bind an exact endpoint; do not assert have=ready."
        );
      }

      if (
        id !== "runtime:git" ||
        binding.adapter !== "git" ||
        binding.endpoint.kind !== "git"
      ) {
        throw failure(
          "unsupported-adapter",
          `No fixed check contract for ${id} / ${binding.adapter}.`,
          "Keep this requirement unresolved until its runtime adapter exists."
        );
      }

      let result: "passed" | "failed" = "passed";
      let evidence: string[];

      try {
        const { repository } = binding.endpoint;

        // oxlint-disable-next-line eslint/no-await-in-loop -- Each registered requirement gets an isolated observation; git is the sole current contract.
        const [root, branch, version] = await Promise.all([
          run("git", ["-C", repository, "rev-parse", "--show-toplevel"], {
            timeout: 10_000,
          }),
          run("git", ["-C", repository, "branch", "--show-current"], {
            timeout: 10_000,
          }),
          run("git", ["--version"], { timeout: 10_000 }),
        ]);

        evidence = [
          `repository:${repository}`,
          `root:${root.stdout.trim()}`,
          `branch:${branch.stdout.trim() || "(detached)"}`,
          `version:${version.stdout.trim()}`,
        ];
      } catch (error) {
        result = "failed";
        evidence = [`git observation failed: ${String(error)}`];
      }

      receipts.push({
        id: randomUUID(),
        way: wanted.way,
        generation: wanted.generation,
        requirement: id,
        checkId: "git-repository",
        checkVersion: "1",
        binding: binding.key,
        revision: binding.revision,
        digest: hash(binding),
        result,
        at: now,
        validForMs: 300_000,
        evidence,
        outputHash: hash(evidence),
      });
    }

    return mutate(house, (latest) => {
      const latestFit = latest.fits.find((f) => f.way === wanted.way);

      if (
        latestFit === undefined ||
        !current(latestFit, wanted) ||
        receipts.some((r) => {
          const b = latest.bindings.find(
            (candidate) => candidate.key === r.binding
          );

          return (
            b === undefined || b.revision !== r.revision || hash(b) !== r.digest
          );
        })
      ) {
        throw failure(
          "stale",
          "Binding changed while the check was running.",
          "Run check against the newly selected binding."
        );
      }

      return [
        { ...latest, checks: [...latest.checks, ...receipts] },
        receipts,
      ] as const;
    });
  });

export const status = (catalog: Catalog, house: string, now = Date.now()) =>
  boundary(async () => {
    const state = await load(house);

    return {
      generation: catalog.generation,
      ways: state.fits.map((f) => standing(state, basis(catalog, f.way), now)),
      authority:
        "No outward adapter is exposed; passing checks confer no permission.",
    };
  });

export const giveGrant = (house: string, input: typeof Grant.Type) =>
  Schema.decodeUnknownEffect(Grant)(input).pipe(
    Effect.mapError((cause) =>
      failure(
        "invalid",
        "Invalid scoped principal grant.",
        "Supply an exact binding/account, action, resource, budget and time interval.",
        cause
      )
    ),
    Effect.flatMap((grant) =>
      boundary(() =>
        mutate(house, (state) => {
          const binding = state.bindings.find((b) => b.key === grant.binding);

          if (
            binding === undefined ||
            binding.state !== "bound" ||
            binding.revision !== grant.revision ||
            JSON.stringify(binding.account) !== JSON.stringify(grant.account) ||
            grant.ends <= grant.given ||
            grant.budget < 0 ||
            state.grants.some((g) => g.id === grant.id)
          ) {
            throw failure(
              "invalid",
              "Grant does not identify a current exact binding or valid unique scope.",
              "Use the selected binding revision and a new grant ID."
            );
          }

          return [
            { ...state, grants: [...state.grants, grant] },
            grant,
          ] as const;
        })
      )
    )
  );

export const revokeGrant = (house: string, id: string) =>
  boundary(() =>
    mutate(house, (state) => {
      if (!state.grants.some((g) => g.id === id)) {
        throw failure(
          "not-found",
          "No grant with this ID.",
          "Inspect local grants before revocation."
        );
      }

      return [
        {
          ...state,
          grants: state.grants.map((g) =>
            g.id === id ? { ...g, state: "revoked" as const } : g
          ),
        },
        { id, state: "revoked" as const },
      ] as const;
    })
  );

export const authorize = (
  house: string,
  request: {
    binding: string;
    account: typeof Account.Type;
    action: string;
    resource: string;
    budget: number;
  },
  now = Date.now()
) =>
  boundary(async () => {
    const state = await load(house);
    const binding = state.bindings.find((b) => b.key === request.binding);

    if (
      binding === undefined ||
      binding.state !== "bound" ||
      JSON.stringify(binding.account) !== JSON.stringify(request.account)
    ) {
      throw failure(
        "denied",
        "Exact bound account is absent.",
        "Select and independently verify the intended account."
      );
    }

    const grant = state.grants.find(
      (g) =>
        g.binding === binding.key &&
        g.revision === binding.revision &&
        JSON.stringify(g.account) === JSON.stringify(request.account) &&
        g.action === request.action &&
        g.resource === request.resource &&
        g.budget >= request.budget &&
        g.state === "active" &&
        g.secretRef.length > 0 &&
        g.given <= now &&
        now < g.ends
    );

    if (grant === undefined) {
      throw failure(
        "denied",
        "No current exact scoped grant.",
        "Obtain the principal's explicit scoped decision before the outward call."
      );
    }

    return grant;
  });

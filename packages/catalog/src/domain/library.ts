import { Array as Arr, Predicate, Schema } from "effect";

import { checkCall, checkWorkflow } from "./laws.js";
import type { Plan, Row } from "./ready.js";
import type { Workflow } from "./workflow.js";

const Text = Schema.String;

const opt = Schema.optionalKey;

// oxlint-disable-next-line eslint/no-redeclare -- The public API pairs the schema value with its inferred type under one stable name.
export const Supply = Schema.Struct({
  id: Text,
  name: Text,
  sort: Text,
  otherwise: opt(Text),
  why: Text,
  have_it_when: Text,
  tells: Schema.Literals(["agent", "person"]),
  ways: Schema.Array(
    Schema.Struct({ says: Text, tried: Schema.Boolean, at: opt(Text) })
  ),
  asks: opt(Schema.Array(Text)),
  supplied_by: opt(Text),
});

export type Supply = typeof Supply.Type;

export interface Library {
  workflows: ReadonlyMap<string, Workflow>;
  needs: ReadonlyMap<string, Supply>;
}

export interface Port {
  id: string;
  name: string;
  is: string;
  needed_when?: string;
}

export interface Outline {
  id: string;
  title: string;
  goal: string;
  takes: Port[];
  makes: Port[];
  parts: {
    id: string;
    name: string;
    place: string;
    takes: readonly string[];
    may_take: readonly string[];
    makes: readonly string[];
  }[];
}

export const callsOf = (w: Workflow): string[] =>
  w.joins.flatMap((j) => (Predicate.isTagged("call")(j) ? [j.workflow] : []));

export const outlineOf = (w: Workflow): Outline => {
  const port = (t: Workflow["things"][number]): Port => {
    if (!Predicate.isString(t.is)) {
      throw new TypeError(`${w.id}: ${t.id} has no kind`);
    }

    const base = {
      id: t.id,
      name: t.name,
      is: t.is,
    };

    return t.needed_when ? { ...base, needed_when: t.needed_when } : base;
  };

  return {
    id: w.id,
    title: w.title,
    goal: w.goal,
    takes: w.things.filter((t) => t.comes_from === "brought").map(port),
    makes: w.things.filter((t) => t.comes_from === "step").map(port),
    parts: w.joins.flatMap((j) => {
      if (!Predicate.isTagged("call")(j)) {
        return [];
      }

      const s = w.steps.find((x) => x.id === j.step);

      if (!s) {
        return [];
      }

      const only = w.joins.find(
        (x) => Predicate.isTagged("only-if")(x) && x.step === s.id
      );

      return [
        {
          id: j.workflow,
          name: s.name,
          place: Predicate.isTagged("only-if")(only)
            ? `when ${only.when}`
            : "always",
          takes: s.takes,
          may_take: s.may_take ?? [],
          makes: s.makes,
        },
      ];
    }),
  };
};

export const libraryFindings = (library: Library): string[] => {
  const { workflows, needs } = library;
  const list = [...needs.values()];
  const wrong: string[] = [];

  const checkPublicWorkflows = () => {
    for (const workflow of workflows.values()) {
      if (workflow.sight !== "public") {
        wrong.push(`${workflow.id} is not marked public`);
      }

      for (const finding of checkWorkflow(workflow)) {
        if (finding.level === "broken") {
          wrong.push(`${workflow.id}, ${finding.at}: ${finding.says}`);
        }
      }
    }
  };

  checkPublicWorkflows();

  const checkWorkflowDependencies = () => {
    for (const w of workflows.values()) {
      for (const id of callsOf(w)) {
        const child = workflows.get(id);

        if (child) {
          for (const f of checkCall(w, child)) {
            if (f.level === "broken") {
              wrong.push(`${w.id}, ${f.at}: ${f.says}`);
            }
          }
        } else {
          wrong.push(`${w.id} calls ${id}, which is not here`);
        }
      }

      for (const n of [...w.needs, ...broughtTo(w)]) {
        const s = needs.get(n.id);

        if (!s) {
          wrong.push(`${w.id} needs ${n.id}, which nobody says how to get`);
        } else if (s.name !== n.name || ("sort" in n && s.sort !== n.sort)) {
          wrong.push(`${w.id}: ${n.id} is said two ways`);
        }
      }

      for (const n of w.needs) {
        if (w.things.some((t) => t.id === n.id)) {
          wrong.push(`${w.id}: ${n.id} is a thing and a need`);
        }
      }

      for (const t of broughtTo(w)) {
        const maker = workflows.get(needs.get(t.id)?.supplied_by ?? "");

        if (maker && !supplies(maker, t)) {
          wrong.push(
            `${maker.id} does not make the ${t.id} that ${w.id} takes`
          );
        }
      }
    }
  };

  checkWorkflowDependencies();

  const checkSupplyDependencies = () => {
    for (const n of list) {
      for (const id of n.asks ?? []) {
        if (!needs.has(id)) {
          wrong.push(`${n.id} asks for ${id}`);
        }
      }

      if (n.supplied_by && !workflows.has(n.supplied_by)) {
        wrong.push(`${n.id}: no ${n.supplied_by}`);
      }
    }
  };

  checkSupplyDependencies();

  const checkSupplyCycles = () => {
    for (const id of needs.keys()) {
      if (comesFirst(library, id).has(id)) {
        wrong.push(`${id} waits for itself`);
      }
    }
  };

  checkSupplyCycles();

  return wrong;
};

export const broughtTo = (w: Workflow) =>
  w.things.filter((t) => t.comes_from === "brought");

const supplies = (maker: Workflow, t: Workflow["things"][number]): boolean => {
  const made = maker.things.find((x) => x.id === t.id);

  if (!made || made.is !== t.is || made.comes_from !== "step") {
    return false;
  }

  const { starts_as: state } = t;

  return (
    state === undefined ||
    maker.steps.some(
      (s) =>
        Arr.isArray<typeof s.after>(s.after) &&
        s.after.some(
          (c) =>
            Predicate.isObjectOrArray(c) &&
            Predicate.isTagged("state")(c) &&
            c.thing === t.id &&
            c.state === state
        )
    )
  );
};

export const comesFirst = (
  library: Library,
  id: string,
  seen = new Set<string>()
): Set<string> => {
  const n = library.needs.get(id);
  const maker = library.workflows.get(n?.supplied_by ?? "");

  const before = [
    ...(n?.asks ?? []),
    ...(maker ? broughtTo(maker).filter((t) => !t.needed_when) : []).map(
      (t) => t.id
    ),
    ...(maker?.needs ?? []).map((x) => x.id),
  ];

  for (const next of before) {
    if (!seen.has(next)) {
      seen.add(next);
      comesFirst(library, next, seen);
    }
  }

  return seen;
};

export const inside = (library: Library, w: Workflow): Workflow[] => {
  const calls = callsOf(w);
  const called = calls.flatMap((id) => library.workflows.get(id) ?? []);

  if (called.length === 0) {
    return [w];
  }

  const own = w.steps.filter((s) => !calls.includes(s.id));

  return [
    ...called.flatMap((c) => inside(library, c)),
    ...(own.length > 0 ? [{ ...w, steps: own, joins: [] }] : []),
  ];
};

export const usesOf = (library: Library, id: string) =>
  [...library.workflows.values()].flatMap((w) => {
    if (callsOf(w).length > 0) {
      return [];
    }

    const brought = broughtTo(w).some((t) => t.id === id);

    return w.steps
      .filter(
        (s) =>
          s.needs.includes(id) ||
          (brought && [...s.takes, ...(s.may_take ?? [])].includes(id))
      )
      .map((s) => ({
        workflow: w.id,
        title: w.title,
        step: s.id,
        name: s.name,
      }));
  });

const workflowLink = (x: Workflow, things: { name: string }[]) => ({
  id: x.id,
  title: x.title,
  things: things.map((t) => t.name),
});

export const besides = (library: Library, w: Workflow) => {
  const own = new Set([w.id, ...callsOf(w)]);
  const others = [...library.workflows.values()].filter((x) => !own.has(x.id));

  const from = (t: { id: string }) => library.needs.get(t.id)?.supplied_by;

  const once = <A extends { id: string }>(found: A[]) =>
    found.filter(
      (x) =>
        !found.some((y) =>
          callsOf(library.workflows.get(y.id) ?? w).includes(x.id)
        )
    );

  return {
    before: others.flatMap((x) => {
      const linked = workflowLink(
        x,
        broughtTo(w).filter((t) => from(t) === x.id)
      );

      return linked.things.length > 0 ? [linked] : [];
    }),
    after: once(
      others.flatMap((x) => {
        if (!(callsOf(x).length === 0 || !callsOf(x).includes(w.id))) {
          return [];
        }

        const linked = workflowLink(
          x,
          broughtTo(x).filter((t) => own.has(from(t) ?? ""))
        );

        return linked.things.length > 0 ? [linked] : [];
      })
    ),
  };
};

const onlyWhen = (
  w: Workflow,
  steps: readonly string[]
): string | undefined => {
  for (const j of w.joins) {
    if (!Predicate.isTagged("branch")(j)) {
      continue;
    }

    const arms = j.arms.filter(
      (x) => Predicate.isString(x.to) && steps.includes(x.to)
    );

    if (arms.length === 0 || arms.length === j.arms.length) {
      continue;
    }

    if (steps.every((s) => arms.some((x) => x.to === s))) {
      return `When the answer is ${arms.map((x) => `"${x.if}"`).join(" or ")} to: ${j.asks}`;
    }
  }

  return undefined;
};

const usedIn = (w: Workflow, id: string) =>
  w.steps
    .filter((s) => s.needs.includes(id) || s.takes.includes(id))
    .map((s) => s.id);

const rowsOf = (w: Workflow): { id: string; only?: string }[] =>
  [...broughtTo(w), ...w.needs].map((x) => {
    const when = "needed_when" in x ? x.needed_when : undefined;
    const only = when ?? onlyWhen(w, usedIn(w, x.id));

    return only === undefined ? { id: x.id } : { id: x.id, only };
  });

export const planOf = (library: Library, w: Workflow): Plan => {
  const calls = w.joins.filter((j) => Predicate.isTagged("call")(j));

  const arrives = new Set(
    w.things.filter((t) => t.comes_from === "run").map((t) => t.id)
  );

  const rows = new Map<string, { id: string; only?: string }>();

  const add = (row: { id: string; only?: string }) => {
    const was = rows.get(row.id);

    if (!was || row.only === undefined) {
      rows.set(row.id, row);
    } else if (was.only !== undefined && !was.only.includes(row.only)) {
      rows.set(row.id, { id: row.id, only: `${was.only} ${row.only}` });
    }
  };

  for (const row of rowsOf(w)) {
    add(row);
  }

  const units = calls.length
    ? calls.flatMap((j) => {
        const child = library.workflows.get(j.workflow);
        const step = w.steps.find((s) => s.id === j.step);

        if (!child || !step) {
          throw new Error(`${w.id}: no ${j.workflow}`);
        }

        const given = new Set(Object.keys(j.gives ?? {}));
        const own = rowsOf(child).filter((r) => !given.has(r.id));

        const only = w.joins.find(
          (x) => Predicate.isTagged("only-if")(x) && x.step === step.id
        );

        for (const r of own) {
          add(
            r.only === undefined && Predicate.isTagged("only-if")(only)
              ? { id: r.id, only: `Only when ${only.when}.` }
              : r
          );
        }

        const always = own.filter((r) => r.only === undefined).map((r) => r.id);

        return [
          {
            id: child.id,
            takes: [...step.takes, ...always],
            makes: step.makes,
          },
        ];
      })
    : w.steps.map((s) => ({
        id: s.id,
        takes: [...s.takes.filter((t) => !arrives.has(t)), ...s.needs],
        makes: s.makes,
      }));

  return {
    rows: [...rows.values()].map((r): Row => {
      const first = comesFirst(library, r.id);

      return {
        ...r,
        after: [...rows.keys()].filter((id) => id !== r.id && first.has(id)),
      };
    }),
    units,
  };
};

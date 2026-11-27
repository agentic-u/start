import { Array as Arr, Effect, Predicate, Schema } from "effect";

import { checkWorkflow } from "./laws.js";
import { callsOf, inside, planOf, Supply, usesOf } from "./library.js";
import type { Library } from "./library.js";
import { ready } from "./ready.js";
import { Gate, Harm, Need, Step, Thing, Workflow } from "./workflow.js";

const Text = Schema.String;

const opt = Schema.optionalKey;

const list = <S extends Schema.Top>(schema: S) => Schema.Array(schema);

// oxlint-disable-next-line eslint/no-redeclare -- The public schema and its inferred error type intentionally share their API name.
export const NotHere = Schema.Struct({ not_here: list(Text), try: Text });

type NotHere = typeof NotHere.Type;

const Found = Schema.Struct({
  id: Text,
  title: Text,
  goal: opt(Text),
  made_of: list(Text),
  takes: list(Text),
  makes: list(Text),
});

const Part = Schema.Struct({ id: Text, name: Text, place: Text });

export const calls = {
  find: {
    name: "find",
    description:
      "Find workflows by plain words. Leave the words out to list them all. Each answer says what goes in and what comes out.",
    input: Schema.Struct({ words: opt(Text) }),
    output: Schema.Struct({ found: list(Found) }),
  },
  read: {
    name: "read",
    description:
      "Read one workflow whole: its kinds, steps, gates, rules and known blind spots. A blank is given as not_said. Name a step to get only that step and what it uses.",
    input: Schema.Struct({ id: Text, step: opt(Text) }),
    output: Schema.Struct({
      workflow: opt(Workflow),
      step: opt(Step),
      things: opt(list(Thing)),
      needs: opt(list(Need)),
      gates: opt(list(Gate)),
    }),
  },
  needs: {
    name: "needs",
    description:
      "Everything a workflow takes from outside, how to tell you have each and how to get it, what only a person may decide, what leaves the machine, and what the record does not say. For a workflow made of others, everything in all of them. Compare it with what your person has on your own side; nothing about them is asked for.",
    input: Schema.Struct({ id: Text }),
    output: Schema.Struct({
      id: Text,
      version: opt(Text),
      have: list(
        Schema.Struct({
          ...Supply.fields,
          only: opt(Text),
          used_by: list(Text),
        })
      ),
      settle: list(Schema.Struct({ id: Text, name: Text })),
      decide: list(
        Schema.Struct({ step: Text, asks: Text, options: list(Text) })
      ),
      person_does: list(Schema.Struct({ step: Text, name: Text, by: Text })),
      leaves: list(
        Schema.Struct({ step: Text, by: Text, touches: list(Text) })
      ),
      writes: list(
        Schema.Struct({ step: Text, by: Text, harm: Harm, touches: list(Text) })
      ),
      never: list(Schema.Struct({ in: Text, never: list(Text) })),
      not_said: list(Schema.Struct({ what: Text, at: list(Text) })),
      parts: list(Part),
    }),
  },
  ready: {
    name: "ready",
    description:
      "Say which things your person has, by id, and get what is missing, what to get first, and what can start now. Check each on your own side first, by the have_it_when that needs gives; ask your person about the ones only a person can tell. Send ids only. Nothing is stored.",
    input: Schema.Struct({ id: Text, have: list(Text) }),
    output: Schema.Struct({
      id: Text,
      ready: Schema.Boolean,
      first: list(Supply),
      later: list(Schema.Struct({ id: Text, name: Text, after: list(Text) })),
      sometimes: list(Schema.Struct({ id: Text, name: Text, only: Text })),
      can_start: list(Text),
    }),
  },
} as const;

type Input<K extends keyof typeof calls> = (typeof calls)[K]["input"]["Type"];

type Output<K extends keyof typeof calls> = (typeof calls)[K]["output"]["Type"];

type Handlers = {
  [K in keyof typeof calls]: (
    input: Input<K>
  ) => Effect.Effect<Output<K>, NotHere>;
};

const notHere = (ids: string[], hint = "find, with no words, lists every id") =>
  Effect.fail({ not_here: ids, try: hint });

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/gu) ?? [];

const said = (is: string | { not_said: string }) =>
  Predicate.isString(is) ? is : "not said";

export const handlers = (library: Library): Handlers => {
  const all = (): Output<"find">["found"] =>
    [...library.workflows.values()].map((w) => ({
      id: w.id,
      title: w.title,
      goal: w.goal,
      made_of: callsOf(w),
      takes: w.things
        .filter((t) => t.comes_from === "brought")
        .map((t) => t.name),
      makes: w.things.filter((t) => t.comes_from === "step").map((t) => t.name),
    }));

  return {
    find: ({ words: asked = "" }) => {
      const want = words(asked);

      const scored = all().map((item) => {
        const has = new Set(words(JSON.stringify(item)));

        return { item, score: want.filter((word) => has.has(word)).length };
      });

      return Effect.succeed({
        found: scored
          .filter(({ score }) => want.length === 0 || score > 0)
          .toSorted((a, b) => b.score - a.score)
          .map(({ item }) => item),
      });
    },

    read: ({ id, step: stepId }) => {
      const workflow = library.workflows.get(id);

      if (stepId !== undefined) {
        const step = workflow?.steps.find((s) => s.id === stepId);

        if (!workflow || !step) {
          return notHere([id, stepId], "needs lists the steps of a workflow");
        }

        const used = new Set([
          ...step.takes,
          ...step.makes,
          ...(step.may_take ?? []),
          ...(step.changes ?? []),
        ]);

        return Effect.succeed({
          step,
          things: workflow.things.filter((t) => used.has(t.id)),
          needs: workflow.needs.filter((n) => step.needs.includes(n.id)),
          gates: workflow.gates.filter((g) => g.before === step.id),
        });
      }

      return workflow ? Effect.succeed({ workflow }) : notHere([id]);
    },

    needs: ({ id }) => {
      const w = library.workflows.get(id);

      if (!w) {
        return notHere([id]);
      }

      const leaves = inside(library, w);

      const at = (l: Workflow, step: string) =>
        l === w ? step : `${l.id}/${step}`;

      const each = <A>(f: (l: Workflow) => A[]) => leaves.flatMap(f);
      const ids = new Set(leaves.map((l) => l.id));

      return Effect.succeed({
        id,
        version: w.version,
        have: planOf(library, w).rows.flatMap(({ id: row, only }) => {
          const n = library.needs.get(row);

          if (!n) {
            return [];
          }

          const supplied = {
            ...n,
            used_by: usesOf(library, n.id)
              .filter((u) => ids.has(u.workflow))
              .map((u) =>
                u.workflow === w.id ? u.step : `${u.workflow}/${u.step}`
              ),
          };

          return only === undefined ? supplied : { ...supplied, only };
        }),
        settle: each((l) =>
          (l.parameters ?? []).map((p) => ({ id: p.id, name: p.name }))
        ),
        decide: each((l) =>
          l.gates.map((g) => ({
            step: at(l, g.before),
            asks: g.asks,
            options: g.options ?? [],
          }))
        ),
        person_does: each((l) =>
          l.steps
            .filter((s) => s.judgment === "person")
            .map((s) => ({ step: at(l, s.id), name: s.name, by: said(s.by) }))
        ),
        leaves: each((l) =>
          l.steps
            .filter((s) => s.harm === "outward")
            .map((s) => ({
              step: at(l, s.id),
              by: said(s.by),
              touches: Arr.isArray<typeof s.may_touch>(s.may_touch)
                ? s.may_touch
                : [],
            }))
        ),
        writes: each((l) =>
          l.steps.flatMap((s) =>
            Predicate.isString(s.harm) &&
            s.harm !== "reads" &&
            s.harm !== "outward"
              ? [
                  {
                    step: at(l, s.id),
                    by: said(s.by),
                    harm: s.harm,
                    touches: Arr.isArray<typeof s.may_touch>(s.may_touch)
                      ? s.may_touch
                      : [],
                  },
                ]
              : []
          )
        ),
        never: leaves.flatMap((l) => {
          const never = [
            ...new Set((l.grants ?? []).flatMap((g) => g.never ?? [])),
          ];

          return never.length > 0 ? [{ in: l.id, never }] : [];
        }),
        not_said: [
          ...Map.groupBy(
            [...new Set([w, ...leaves])].flatMap((l) =>
              checkWorkflow(l)
                .filter((f) => f.level === "unsaid")
                .map((f) => ({ at: at(l, f.at), what: f.says }))
            ),
            (f) => f.what
          ),
        ].map(([what, found]) => ({ what, at: found.map((f) => f.at) })),
        parts: w.joins.flatMap((j) => {
          if (!Predicate.isTagged("call")(j)) {
            return [];
          }

          const only = w.joins.find(
            (x) => Predicate.isTagged("only-if")(x) && x.step === j.step
          );

          return [
            {
              id: j.workflow,
              name: w.steps.find((s) => s.id === j.step)?.name ?? j.workflow,
              place: Predicate.isTagged("only-if")(only)
                ? `when ${only.when}`
                : "always",
            },
          ];
        }),
      });
    },

    ready: ({ id, have }) => {
      const w = library.workflows.get(id);

      if (!w) {
        return notHere([id]);
      }

      const plan = planOf(library, w);
      const strange = have.filter((h) => !library.needs.has(h));

      if (strange.length > 0) {
        return notHere(
          [],
          `${strange.length} of the ids are not ours; needs lists them`
        );
      }

      const r = ready(plan, have);

      const supply = (n: string): Supply => {
        const found = library.needs.get(n);

        if (found === undefined) {
          throw new Error(`Ready plan references undeclared supply ${n}`);
        }

        return found;
      };

      const named = <A extends { id: string }>(x: A) => ({
        ...x,
        name: supply(x.id).name,
      });

      return Effect.succeed({
        id,
        ready: r.ready,
        first: r.first.map(supply),
        later: r.later.map(named),
        sometimes: r.sometimes.map(named),
        can_start: r.can_start,
      });
    },
  };
};

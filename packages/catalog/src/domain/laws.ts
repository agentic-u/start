import { Array as Arr, Match, Predicate } from "effect";

import type { Run, Workflow } from "./workflow.js";

const harms = ["reads", "repeatable-write", "unrepeatable-write", "outward"];

const more = (a: string, b: string) => harms.indexOf(a) > harms.indexOf(b);

export interface Finding {
  law: string;
  level: "broken" | "unsaid";
  at: string;
  says: string;
}

const blank = Predicate.hasProperty("not_said");

export const checkWorkflow = (workflow: Workflow): Finding[] => {
  const out: Finding[] = [];

  const add = (
    law: string,
    level: Finding["level"],
    at: string,
    says: string
  ) => out.push({ law, level, at, says });

  const steps = new Set(workflow.steps.map((s) => s.id));
  const things = new Map(workflow.things.map((t) => [t.id, t]));
  const actors = new Set(workflow.actors.map((a) => a.id));
  const needs = new Set(workflow.needs.map((n) => n.id));
  const unknowns = new Set(workflow.known.unknowns.map((u) => u.id));
  const rules = new Set(workflow.rules.map((r) => r.id));

  const ref = (
    at: string,
    id: string,
    set: { has: (id: string) => boolean },
    sort: string
  ) => {
    if (!set.has(id)) {
      add("names-resolve", "broken", at, `no ${sort} ${id}`);
    }
  };

  const checkOneOfEach = () => {
    for (const [sort, list] of Object.entries({
      step: workflow.steps,
      thing: workflow.things,
      actor: workflow.actors,
      need: workflow.needs,
      gate: workflow.gates,
      unknown: workflow.known.unknowns,
    })) {
      const seen = new Set<string>();

      for (const { id } of list) {
        if (seen.has(id)) {
          add("one-of-each", "broken", id, `two ${sort}s share this id`);
        }

        seen.add(id);
      }
    }
  };

  checkOneOfEach();

  const makers = new Map<string, string[]>();

  const checkStepIsTyped = () => {
    for (const s of workflow.steps) {
      for (const id of s.makes) {
        makers.set(id, [...(makers.get(id) ?? []), s.id]);
      }

      for (const id of [
        ...s.takes,
        ...(s.may_take ?? []),
        ...s.makes,
        ...(s.changes ?? []),
      ]) {
        ref(s.id, id, things, "thing");
      }

      for (const id of s.needs) {
        ref(s.id, id, needs, "need");
      }

      for (const id of s.settles) {
        ref(s.id, id, unknowns, "unknown");
      }

      for (const id of s.keeps ?? []) {
        ref(s.id, id, rules, "rule");
      }

      if (Predicate.isString(s.by)) {
        ref(s.id, s.by, actors, "actor");
      }

      for (const id of s.with ?? []) {
        ref(s.id, id, actors, "actor");
      }

      for (const field of [
        "judgment",
        "harm",
        "may_touch",
        "before",
        "after",
        "on_failure",
      ] as const) {
        if (s[field] === undefined || blank(s[field])) {
          add("step-is-typed", "unsaid", s.id, field);
        }
      }

      const callsWorkflow = workflow.joins.some(
        (j) => Predicate.isTagged("call")(j) && j.step === s.id
      );

      if (
        s.harm === "outward" &&
        !callsWorkflow &&
        !workflow.gates.some((g) => g.before === s.id)
      ) {
        add(
          "outward-has-a-gate",
          "broken",
          s.id,
          "goes outward with no gate before it"
        );
      }
    }
  };

  checkStepIsTyped();

  const checkNothingFromNowhere = () => {
    for (const thing of workflow.things) {
      if (thing.comes_from === "step" && !makers.has(thing.id)) {
        add(
          "nothing-from-nowhere",
          "broken",
          thing.id,
          "said to be made, and no step makes it"
        );
      }

      if (thing.comes_from === "brought" && makers.has(thing.id)) {
        add(
          "nothing-from-nowhere",
          "broken",
          thing.id,
          "said to be brought, and a step makes it"
        );
      }

      if (blank(thing.is)) {
        add(
          "thing-has-a-kind",
          "unsaid",
          thing.id,
          `only its form: ${thing.form}`
        );
      }
    }
  };

  checkNothingFromNowhere();

  const checkOneMakerOrARule = () => {
    for (const [id, by] of makers) {
      const met = workflow.joins.some(
        (j) =>
          Predicate.isTagged("meet")(j) && by.every((s) => j.of.includes(s))
      );

      if (by.length > 1 && !met) {
        add("one-maker-or-a-rule", "unsaid", id, by.join(", "));
      }
    }
  };

  checkOneMakerOrARule();

  const checkGateCanWait = () => {
    for (const gate of workflow.gates) {
      ref(gate.id, gate.before, steps, "step");
      ref(gate.id, gate.owner, actors, "actor");

      if (!gate.while_waiting || blank(gate.while_waiting)) {
        add("gate-can-wait", "unsaid", gate.id, "while_waiting");
      }
    }
  };

  checkGateCanWait();

  const checkJoins = () => {
    for (const entry of workflow.joins) {
      Match.value(entry).pipe(
        Match.tag("then", "hand-off", "loop", (join) => {
          ref(join._tag, join.from, steps, "step");
          ref(join._tag, join.to, steps, "step");

          if (Predicate.isTagged("hand-off")(join)) {
            for (const id of join.gives) {
              ref("hand-off", id, things, "thing");
            }

            if (join.gives.length === 0) {
              add("hand-off-carries", "broken", join.from, "hands off nothing");
            }
          }

          if (Predicate.isTagged("loop")(join) && blank(join.at_most)) {
            add("loop-ends", "unsaid", join.id, "at_most");
          }

          if (
            Predicate.isTagged("loop")(join) &&
            Predicate.isNumber(join.at_most) &&
            join.at_most < 1
          ) {
            add("loop-ends", "broken", join.id, "a bound below one");
          }
        }),
        Match.tag("beside", (join) => {
          ref("beside", join.step, steps, "step");

          if (Arr.isArray<typeof join.while>(join.while)) {
            const here = workflow.steps.find((s) => s.id === join.step);

            for (const id of join.while) {
              ref("beside", id, steps, "step");
              const there = workflow.steps.find((s) => s.id === id);

              const writes = (s: typeof here) =>
                s &&
                s.harm !== "reads" &&
                Arr.isArray<typeof s.may_touch>(s.may_touch)
                  ? s.may_touch
                  : [];

              const both = writes(here).filter((t) =>
                writes(there).includes(t)
              );

              if (both.length > 0 && !join.merge) {
                add(
                  "beside-does-not-collide",
                  "broken",
                  join.step,
                  `${both.join(", ")} also written by ${id}`
                );
              }
            }
          } else {
            add("beside-what", "unsaid", join.step, "while");
          }
        }),
        Match.tag("meet", (join) => {
          ref("meet", join.into, steps, "step");

          for (const id of join.of) {
            ref("meet", id, steps, "step");
          }

          let wants = 1;

          if (!Predicate.isString(join.rule)) {
            if ("some" in join.rule) {
              wants = join.rule.some;
            } else if ("agree" in join.rule) {
              wants = join.rule.agree;
            } else {
              wants = join.of.length - join.rule.failures_at_most;
            }
          }

          if (wants < 1 || wants > join.of.length) {
            add(
              "meet-can-happen",
              "broken",
              join.into,
              "asks for more or fewer than there are"
            );
          }
        }),
        Match.tag("branch", (join) => {
          ref(join.id, join.at, steps, "step");

          if (join.settled_by) {
            ref(join.id, join.settled_by, unknowns, "unknown");
          }

          if (join.arms.length < 2) {
            add("branch-chooses", "broken", join.id, "fewer than two arms");
          }

          for (const arm of join.arms) {
            if (Predicate.isString(arm.to)) {
              ref(join.id, arm.to, steps, "step");
            }
          }
        }),
        Match.tag("undo", (join) => {
          ref("undo", join.step, steps, "step");
          ref("undo", join.by, steps, "step");
        }),
        Match.tag("retry", (join) => {
          ref("retry", join.step, steps, "step");
          const step = workflow.steps.find((s) => s.id === join.step);

          if (
            !step?.repeat_key &&
            (step?.harm === "unrepeatable-write" || step?.harm === "outward")
          ) {
            add(
              "retry-is-safe",
              "broken",
              join.step,
              `retries a step whose harm is ${step.harm}`
            );
          }
        }),
        Match.tag("wait", (join) => {
          ref(join.id, join.before, steps, "step");
        }),
        Match.tag("trigger", (join) => {
          ref("trigger", join.starts, steps, "step");
        }),
        Match.tag("route", (join) => {
          ref(join.id, join.at, steps, "step");

          for (const c of join.cases) {
            ref(join.id, c.to, steps, "step");
          }

          if (join.otherwise) {
            ref(join.id, join.otherwise, steps, "step");
          } else {
            add("route-has-an-end", "unsaid", join.id, "otherwise");
          }

          if (join.delivery === "once" && !join.same_if) {
            add(
              "once-needs-a-key",
              "broken",
              join.id,
              "delivered once with no way to tell a repeat"
            );
          }
        }),
        Match.tag("cancel", (join) => {
          for (const id of [join.step, ...join.also]) {
            ref("cancel", id, steps, "step");
          }
        }),
        Match.tag("link", (join) => {
          for (const id of [join.from, join.to]) {
            ref("link", id, steps, "step");
          }
        }),
        Match.tag("interpret", (join) => {
          ref("interpret", join.step, steps, "step");

          if (!things.get(join.thing)?.quotes) {
            add(
              "run-only-a-workflow",
              "broken",
              join.step,
              `${join.thing} is not a workflow`
            );
          }
        }),
        Match.tag("resume", (join) => {
          ref("resume", join.step, steps, "step");

          const held = workflow.joins.some(
            (j) => Predicate.isTagged("hand-off")(j) && j.from === join.from
          );

          if (!held) {
            add(
              "resume-needs-a-hand-off",
              "broken",
              join.step,
              `nothing handed off at ${join.from}`
            );
          }
        }),
        Match.tag("only-if", "ways", "call", (join) => {
          ref(join._tag, join.step, steps, "step");

          if (Predicate.isTagged("call")(join) && blank(join.version)) {
            add("call-is-pinned", "unsaid", join.step, join.workflow);
          }
        }),
        Match.exhaustive
      );
    }
  };

  checkJoins();

  const done = new Set<string>();

  const ready = new Set(
    workflow.things.filter((t) => t.comes_from !== "step").map((t) => t.id)
  );

  const propagateAvailableThings = () => {
    for (let moved = true; moved;) {
      moved = false;

      for (const s of workflow.steps) {
        if (done.has(s.id) || !s.takes.every((id) => ready.has(id))) {
          continue;
        }

        done.add(s.id);

        for (const id of s.makes) {
          ready.add(id);
        }

        moved = true;
      }
    }
  };

  propagateAvailableThings();

  const stuck = workflow.steps.filter((s) => !done.has(s.id));

  const waits = (s: Workflow["steps"][number]) =>
    stuck.filter((o) =>
      o.makes.some((id) => s.takes.includes(id) && !ready.has(id))
    );

  const reaches = (from: (typeof stuck)[number], to: string) => {
    const seen = new Set<string>();
    const queue = [...waits(from)];

    for (let s = queue.pop(); s; s = queue.pop()) {
      if (s.id === to) {
        return true;
      }

      if (seen.has(s.id)) {
        continue;
      }

      seen.add(s.id);
      queue.push(...waits(s));
    }

    return false;
  };

  const checkEveryStepCanStart = () => {
    for (const s of stuck) {
      add(
        reaches(s, s.id) ? "no-circles" : "every-step-can-start",
        "broken",
        s.id,
        `waits forever on ${s.takes.filter((id) => !ready.has(id)).join(", ")}`
      );
    }
  };

  checkEveryStepCanStart();

  const kinds = new Map((workflow.kinds ?? []).map((k) => [k.id, k]));

  const statesOf = (id: string): string[] => {
    const is = things.get(id)?.is;
    const kind = Predicate.isString(is) ? kinds.get(is) : undefined;

    return [...(kind?.states ?? [])];
  };

  const reached = new Set<string>();

  const recordInitialThingStates = () => {
    for (const t of workflow.things) {
      if (t.starts_as) {
        reached.add(`${t.id}=${t.starts_as}`);
      }
    }
  };

  recordInitialThingStates();

  const recordStepPostconditions = () => {
    for (const s of workflow.steps) {
      if (Arr.isArray<typeof s.after>(s.after)) {
        for (const c of s.after) {
          if (Predicate.isObjectOrArray(c) && Predicate.isTagged("state")(c)) {
            reached.add(`${c.thing}=${c.state}`);
          }
        }
      }
    }
  };

  recordStepPostconditions();

  const claims = new Map((workflow.known.claims ?? []).map((c) => [c.id, c]));
  const measures = new Set(workflow.measures.map((m) => m.id));

  const checkStatesAreTheKinds = () => {
    for (const s of workflow.steps) {
      for (const side of ["before", "after"] as const) {
        const list = s[side];

        if (!Arr.isArray<typeof list>(list)) {
          continue;
        }

        for (const c of list) {
          if (Predicate.isString(c)) {
            continue;
          }

          if (Predicate.isTagged("measure")(c)) {
            ref(s.id, c.measure, measures, "measure");
          } else if (Predicate.isTagged("claim")(c)) {
            ref(s.id, c.claim, claims, "claim");
          } else {
            ref(s.id, c.thing, things, "thing");

            if (!Predicate.isTagged("state")(c)) {
              continue;
            }

            if (!statesOf(c.thing).includes(c.state)) {
              add(
                "states-are-the-kinds",
                "broken",
                s.id,
                `${c.thing} cannot be ${c.state}`
              );
            }

            if (side === "before" && !reached.has(`${c.thing}=${c.state}`)) {
              add(
                "what-it-needs-can-come-true",
                "broken",
                s.id,
                `nothing makes ${c.thing} ${c.state}`
              );
            }

            if (
              side === "after" &&
              ![...s.makes, ...(s.changes ?? [])].includes(c.thing)
            ) {
              add(
                "only-what-it-makes-changes",
                "broken",
                s.id,
                `leaves ${c.thing} ${c.state}, and neither makes nor changes it`
              );
            }
          }
        }
      }
    }
  };

  checkStatesAreTheKinds();

  const grants = new Map((workflow.grants ?? []).map((g) => [g.id, g]));

  const checkGrantsComeFromSomewhere = () => {
    for (const g of grants.values()) {
      ref(g.id, g.to, actors, "actor");
      const seen = new Set([g.id]);

      for (let up = g.from; up; up = grants.get(up)?.from) {
        if (seen.has(up)) {
          add("grants-come-from-somewhere", "broken", g.id, "a circle");
          break;
        }

        seen.add(up);
        const parent = grants.get(up);

        if (!parent) {
          add("names-resolve", "broken", g.id, `no grant ${up}`);
          break;
        }

        if (
          more(g.harm, parent.harm) ||
          g.touch.some((t) => !parent.touch.includes(t))
        ) {
          add("handed-down-never-more", "broken", g.id, `does more than ${up}`);
        }

        if ((parent.never ?? []).some((n) => !(g.never ?? []).includes(n))) {
          add(
            "handed-down-never-more",
            "broken",
            g.id,
            `drops what ${up} forbids`
          );
        }

        if (parent.state !== "active" && g.state === "active") {
          add(
            "handed-down-never-more",
            "broken",
            g.id,
            `active under ${up}, which is ${parent.state}`
          );
        }

        for (const b of g.budget) {
          const above = parent.budget.find(
            (p) => p.of === b.of && p.per === b.per
          );

          if (!above || b.amount > above.amount) {
            add(
              "handed-down-never-more",
              "broken",
              g.id,
              `${b.amount} ${b.of}, more than ${up} has`
            );
          }
        }
      }

      for (const { of, per = null } of g.budget) {
        const has = g.budget
          .filter((b) => b.of === of && (b.per ?? null) === per)
          .reduce((n, b) => n + b.amount, 0);

        const given = [...grants.values()]
          .filter((c) => c.from === g.id)
          .flatMap((c) => c.budget)
          .filter((b) => b.of === of && (b.per ?? null) === per)
          .reduce((n, b) => n + b.amount, 0);

        if (given > has) {
          add(
            "budget-is-split",
            "broken",
            g.id,
            `hands down ${given} ${of} of ${has}`
          );
        }
      }
    }
  };

  checkGrantsComeFromSomewhere();

  const checkStepGrants = () => {
    for (const s of workflow.steps) {
      const g = s.under ? grants.get(s.under) : undefined;

      if (s.under && !g) {
        add("names-resolve", "broken", s.id, `no grant ${s.under}`);
      }

      if (!g) {
        if (
          Predicate.isString(s.harm) &&
          s.harm !== "reads" &&
          grants.size > 0
        ) {
          add(
            "inside-its-authority",
            "broken",
            s.id,
            "changes something under no grant"
          );
        }

        continue;
      }

      if (g.state !== "active") {
        add("inside-its-authority", "broken", s.id, `${g.id} is ${g.state}`);
      }

      if (Predicate.isString(s.by) && g.to !== s.by) {
        add("inside-its-authority", "broken", s.id, `${g.id} is for ${g.to}`);
      }

      if (Predicate.isString(s.harm) && more(s.harm, g.harm)) {
        add(
          "inside-its-authority",
          "broken",
          s.id,
          `${s.harm} under ${g.harm}`
        );
      }

      const checkTouchAuthority = () => {
        if (Arr.isArray<typeof s.may_touch>(s.may_touch)) {
          for (const t of s.may_touch) {
            if (!g.touch.includes(t)) {
              add("inside-its-authority", "broken", s.id, `touches ${t}`);
            }

            if (g.never?.includes(t)) {
              add(
                "inside-its-authority",
                "broken",
                s.id,
                `touches forbidden ${t}`
              );
            }
          }
        }
      };

      checkTouchAuthority();

      for (const b of s.budget ?? []) {
        const above = g.budget.find((p) => p.of === b.of && p.per === b.per);

        if (!above || b.amount > above.amount) {
          add(
            "inside-its-authority",
            "broken",
            s.id,
            `spends ${b.amount} ${b.of}`
          );
        }
      }
    }
  };

  checkStepGrants();

  const checkCallsEnd = () => {
    for (const join of workflow.joins) {
      if (Predicate.isTagged("call")(join)) {
        if (join.workflow === workflow.id && !join.bound) {
          add("calls-end", "broken", join.step, "calls itself with no bound");
        }

        if (join.bound && (join.bound.depth < 1 || join.bound.calls < 1)) {
          add("calls-end", "broken", join.step, "a bound below one");
        }

        if (join.grant) {
          ref(join.step, join.grant, grants, "grant");
        }
      }
    }
  };

  checkCallsEnd();

  const checkUndoIsSafeToRepeat = () => {
    for (const s of workflow.steps) {
      if (!Arr.isArray<typeof s.on_failure>(s.on_failure)) {
        continue;
      }

      for (const f of s.on_failure) {
        if (Predicate.isTagged("undo")(f.do)) {
          ref(s.id, f.do.by, steps, "step");

          const undo = workflow.steps.find(
            (o) => o.id === (Predicate.isTagged("undo")(f.do) ? f.do.by : "")
          );

          if (
            undo &&
            Predicate.isString(undo.harm) &&
            more(undo.harm, "repeatable-write") &&
            !undo.repeat_key
          ) {
            add(
              "undo-is-safe-to-repeat",
              "broken",
              s.id,
              `${undo.id} is ${undo.harm}`
            );
          }

          if (s.harm === "outward" && undo?.family !== "reconcile") {
            add(
              "outward-is-not-undone",
              "broken",
              s.id,
              "an outward step is put right by a new step, never taken back"
            );
          }
        }

        if (Predicate.isTagged("raise")(f.do)) {
          ref(s.id, f.do.to, actors, "actor");
        }

        if (
          Predicate.isTagged("retry")(f.do) &&
          Predicate.isString(s.harm) &&
          more(s.harm, "repeatable-write") &&
          !s.repeat_key
        ) {
          add(
            "retry-is-safe",
            "broken",
            s.id,
            `retries a step whose harm is ${s.harm}`
          );
        }
      }
    }
  };

  checkUndoIsSafeToRepeat();

  const sources = new Map((workflow.known.sources ?? []).map((x) => [x.id, x]));

  const segments = new Map(
    (workflow.known.segments ?? []).map((x) => [x.id, x])
  );

  const checkASpanGoesForward = () => {
    for (const g of segments.values()) {
      ref(g.id, g.source, sources, "source");

      if (g.to < g.from) {
        add("a-span-goes-forward", "broken", g.id, `${g.from} to ${g.to}`);
      }
    }
  };

  checkASpanGoesForward();

  const checkClaimSources = () => {
    for (const c of claims.values()) {
      for (const id of c.evidence) {
        if (!sources.has(id) && !segments.has(id)) {
          add("names-resolve", "broken", c.id, `no source ${id}`);
        }
      }

      if (c.state === "supported" && c.evidence.length === 0) {
        add("nothing-without-a-source", "broken", c.id, "supported by nothing");
      }

      if (c.state === "conflicted" && (c.against ?? []).length === 0) {
        add(
          "a-conflict-names-the-other",
          "broken",
          c.id,
          "conflicts with nothing named"
        );
      }

      const from = c.evidence.map((id) =>
        sources.get(segments.get(id)?.source ?? id)
      );

      if (
        c.state === "supported" &&
        from.length > 0 &&
        from.every((x) => x?.view_of && !x.receipt)
      ) {
        add(
          "a-view-makes-no-truth",
          "broken",
          c.id,
          "rests only on views nobody admitted"
        );
      }
    }
  };

  checkClaimSources();

  const objectives = new Set((workflow.objectives ?? []).map((o) => o.id));

  const checkNothingWithoutASource = () => {
    for (const a of workflow.known.assessments ?? []) {
      ref(a.id, a.claim, claims, "claim");
      ref(a.id, a.objective, objectives, "objective");

      if (a.evidence.length === 0) {
        add("nothing-without-a-source", "broken", a.id, "judged on nothing");
      }
    }
  };

  checkNothingWithoutASource();

  const checkStepSources = () => {
    for (const s of workflow.steps) {
      for (const id of [...(s.satisfies ?? []), ...(s.advances ?? [])]) {
        ref(s.id, id, objectives, "objective");
      }
    }
  };

  checkStepSources();

  const checkMonitors = () => {
    for (const m of workflow.monitors ?? []) {
      if (!steps.has(m.watches) && !measures.has(m.watches)) {
        add(
          "names-resolve",
          "broken",
          m.id,
          `watches ${m.watches}, which is nothing here`
        );
      }
    }
  };

  checkMonitors();

  if (workflow.standing) {
    if (workflow.standing.feedback.length === 0) {
      add(
        "standing-hears-back",
        "broken",
        workflow.id,
        "nothing it makes changes what it does"
      );
    }

    for (const f of workflow.standing.feedback) {
      ref(workflow.id, f.measure, measures, "measure");
    }

    for (const f of workflow.standing.feedback) {
      ref(workflow.id, f.changes, steps, "step");
    }

    if (blank(workflow.standing.constraint)) {
      add("standing-names-its-limit", "unsaid", workflow.id, "constraint");
    }
  }

  const checkChanceIsAChance = () => {
    for (const u of workflow.known.unknowns) {
      if (u.chance < 0 || u.chance > 1) {
        add("chance-is-a-chance", "broken", u.id, String(u.chance));
      }

      for (const id of u.bears_on) {
        if (!steps.has(id) && !unknowns.has(id) && !things.has(id)) {
          add(
            "names-resolve",
            "broken",
            u.id,
            `bears on ${id}, which is nothing here`
          );
        }
      }
    }
  };

  checkChanceIsAChance();

  return out;
};

const changes = new Set(["repeatable-write", "unrepeatable-write", "outward"]);

export const checkRun = (workflow: Workflow, run: Run): Finding[] => {
  const out: Finding[] = [];
  const steps = new Map(workflow.steps.map((s) => [s.id, s]));

  if (run.workflow !== workflow.id || run.version !== workflow.version) {
    out.push({
      law: "run-of-this",
      level: "broken",
      at: run.workflow,
      says: "another workflow or version",
    });
  }

  const checkReceiptReferences = () => {
    for (const r of run.receipts) {
      if (!steps.has(r.step)) {
        out.push({
          law: "names-resolve",
          level: "broken",
          at: r.step,
          says: "receipt for no step",
        });
      }
    }
  };

  checkReceiptReferences();

  const gateYes = new Set(
    (run.gates ?? []).filter((g) => g.state === "yes").map((g) => g.gate)
  );

  const checkNoStepPastItsGate = () => {
    for (const s of run.steps) {
      if (s.state !== "done") {
        continue;
      }

      for (const g of workflow.gates) {
        if (g.before === s.step && !gateYes.has(g.id)) {
          out.push({
            law: "no-step-past-its-gate",
            level: "broken",
            at: s.step,
            says: `done, and ${g.id} never said yes`,
          });
        }
      }
    }
  };

  checkNoStepPastItsGate();

  const moves = new Map<string, readonly string[]>([
    ["pending", ["ready", "skipped", "cancelled", "blocked"]],
    ["ready", ["running", "blocked", "at-gate", "skipped", "cancelled"]],
    ["running", ["done", "failed", "blocked", "at-gate", "cancelled"]],
    ["blocked", ["ready", "failed", "skipped", "cancelled"]],
    ["at-gate", ["ready", "running", "failed", "skipped", "cancelled"]],
    ["failed", ["ready"]],
  ]);

  const now = new Map<string, string>();
  const keys = new Set<string>();

  const checkRunEvents = () => {
    for (const e of run.events ?? []) {
      if (keys.has(e.key)) {
        continue;
      }

      keys.add(e.key);

      if (!steps.has(e.step)) {
        out.push({
          law: "only-what-was-declared",
          level: "broken",
          at: e.step,
          says: "ran, and is not in the workflow",
        });
      }

      if (
        (now.get(e.step) ?? "pending") !== e.from ||
        !moves.get(e.from)?.includes(e.to)
      ) {
        out.push({
          law: "states-move-in-order",
          level: "broken",
          at: e.step,
          says: `${now.get(e.step) ?? "pending"}, then ${e.from} to ${e.to}`,
        });
      }

      now.set(e.step, e.to);
    }
  };

  checkRunEvents();

  const leftSteps = new Set((run.left ?? []).flatMap((l) => l.steps));

  const checkWhatIsLeftIsWritten = () => {
    for (const s of run.steps) {
      if (
        (s.state === "blocked" ||
          s.state === "failed" ||
          s.state === "at-gate") &&
        !leftSteps.has(s.step)
      ) {
        out.push({
          law: "what-is-left-is-written",
          level: "broken",
          at: s.step,
          says: `${s.state}, and not in what is left`,
        });
      }
    }
  };

  checkWhatIsLeftIsWritten();

  const levels = ["passing", "retryable", "undoable", "raise", "stop"];
  const worst = new Map<string, number>();

  const checkEveryFailureHasALevel = () => {
    for (const f of run.failures ?? []) {
      const level = levels.indexOf(f.level);

      if (level === -1) {
        out.push({
          law: "every-failure-has-a-level",
          level: "broken",
          at: f.step,
          says: f.level,
        });
      }

      if (level < (worst.get(f.step) ?? 0)) {
        out.push({
          law: "a-failure-never-gets-milder",
          level: "broken",
          at: f.step,
          says: f.level,
        });
      }

      worst.set(f.step, Math.max(level, worst.get(f.step) ?? 0));
    }
  };

  checkEveryFailureHasALevel();

  const ids = new Set(run.receipts.flatMap((r) => (r.id ? [r.id] : [])));

  const checkChangeLeavesAReceipt = () => {
    for (const u of run.undone ?? []) {
      if (!ids.has(u.receipt)) {
        out.push({
          law: "change-leaves-a-receipt",
          level: "broken",
          at: u.step,
          says: "undone with no receipt",
        });
      }

      if (u.outcome === "undone" && u.compared !== "same-as-before") {
        out.push({
          law: "undone-means-as-before",
          level: "broken",
          at: u.step,
          says: u.compared,
        });
      }
    }
  };

  checkChangeLeavesAReceipt();

  const spent = new Map<string, number>();
  const grants = new Map((workflow.grants ?? []).map((g) => [g.id, g]));

  const checkInsideItsAuthority = () => {
    for (const r of run.receipts) {
      if (!r.under) {
        continue;
      }

      const g = grants.get(r.under);

      if (!g) {
        out.push({
          law: "inside-its-authority",
          level: "broken",
          at: r.step,
          says: `no grant ${r.under}`,
        });
        continue;
      }

      for (const a of r.spent ?? []) {
        const k = JSON.stringify([g.id, a.of]);
        spent.set(k, (spent.get(k) ?? 0) + a.amount);

        const has = g.budget
          .filter((b) => b.of === a.of)
          .reduce((n, b) => n + b.amount, 0);

        if ((spent.get(k) ?? 0) > has) {
          out.push({
            law: "inside-its-budget",
            level: "broken",
            at: r.step,
            says: `${spent.get(k)} ${a.of} of ${has}`,
          });
        }
      }
    }
  };

  checkInsideItsAuthority();

  const checkRunCalls = () => {
    for (const call of run.calls ?? []) {
      const join = workflow.joins.find(
        (j) => Predicate.isTagged("call")(j) && j.step === call.step
      );

      if (!join || !Predicate.isTagged("call")(join)) {
        out.push({
          law: "only-what-was-declared",
          level: "broken",
          at: call.step,
          says: "a call nobody declared",
        });
        continue;
      }

      if (join.pin && join.pin !== call.pin) {
        out.push({
          law: "call-is-pinned",
          level: "broken",
          at: call.step,
          says: "called a different definition",
        });
      }

      if (join.bound && call.depth > join.bound.depth) {
        out.push({
          law: "calls-end",
          level: "broken",
          at: call.step,
          says: `depth ${call.depth}`,
        });
      }

      if (
        join.bound &&
        (run.calls ?? []).filter((c) => c.step === call.step).length >
          join.bound.calls
      ) {
        out.push({
          law: "calls-end",
          level: "broken",
          at: call.step,
          says: "more calls than its bound",
        });
      }
    }
  };

  checkRunCalls();

  const checkEverySlotIsFilled = () => {
    for (const p of workflow.parameters ?? []) {
      if (!(p.id in (run.values ?? {}))) {
        out.push({
          law: "every-slot-is-filled",
          level: "broken",
          at: p.id,
          says: "no value in this run",
        });
      }
    }
  };

  checkEverySlotIsFilled();

  if (workflow.standing && run.steps.length > 0 && !run.heartbeat) {
    out.push({
      law: "silence-is-failure",
      level: "broken",
      at: workflow.id,
      says: "a standing run with no heartbeat",
    });
  }

  const skipped = new Set(
    run.steps.flatMap((s) => (s.state === "skipped" ? [s.step] : []))
  );

  const checkNotMadeByTheSkipped = () => {
    for (const s of workflow.steps) {
      if (skipped.has(s.id)) {
        continue;
      }

      for (const id of s.takes) {
        const by = workflow.steps.filter((o) => o.makes.includes(id));

        if (by.length > 0 && by.every((o) => skipped.has(o.id))) {
          out.push({
            law: "not-made-by-the-skipped",
            level: "broken",
            at: s.id,
            says: `takes ${id}, made only by ${by.map((o) => o.id).join(", ")}, skipped`,
          });
        }
      }
    }
  };

  checkNotMadeByTheSkipped();

  const checkRunStepReferences = () => {
    for (const s of run.steps) {
      const step = steps.get(s.step);

      if (!step) {
        out.push({
          law: "names-resolve",
          level: "broken",
          at: s.step,
          says: "no such step",
        });
      } else if (
        s.state === "done" &&
        Predicate.isString(step.harm) &&
        changes.has(step.harm) &&
        !run.receipts.some((r) => r.step === s.step)
      ) {
        out.push({
          law: "change-leaves-a-receipt",
          level: "broken",
          at: s.step,
          says: "done, changed something, no receipt",
        });
      }
    }
  };

  checkRunStepReferences();

  return out;
};

const sortsOf = (workflow: Workflow, kind: string): Set<string> => {
  const seen = new Set<string>();

  for (let at: string | undefined = kind; at !== undefined && !seen.has(at);) {
    seen.add(at);
    const id: string = at;
    at = workflow.kinds?.find((k) => k.id === id)?.sort_of;
  }

  return seen;
};

export const checkCall = (parent: Workflow, child: Workflow): Finding[] => {
  const out: Finding[] = [];

  const checkCallIsPinned = () => {
    for (const join of parent.joins) {
      if (!Predicate.isTagged("call")(join) || join.workflow !== child.id) {
        continue;
      }

      if (join.version !== child.version) {
        out.push({
          law: "call-is-pinned",
          level: "broken",
          at: join.step,
          says: `calls ${join.version}, given ${child.version}`,
        });
      }

      const caller = parent.steps.find((s) => s.id === join.step);

      const meet = (level: Finding["level"], says: string) =>
        out.push({ law: "call-types-meet", level, at: join.step, says });

      const pair = (
        from: Workflow,
        fromId: string,
        to: Workflow,
        toId: string
      ) => {
        const a = from.things.find((t) => t.id === fromId);
        const b = to.things.find((t) => t.id === toId);

        if (!a || !b) {
          meet("broken", `no thing called ${a ? toId : fromId}`);
        } else if (!Predicate.isString(a.is) || !Predicate.isString(b.is)) {
          meet("unsaid", `kind of ${fromId} or ${toId}`);
        } else if (a.is !== b.is && !sortsOf(from, a.is).has(b.is)) {
          meet("broken", `${fromId} is ${a.is}; ${toId} is ${b.is}`);
        }
      };

      const checkGiven = () => {
        if (join.gives) {
          for (const t of child.things) {
            if (
              t.comes_from === "brought" &&
              !t.needed_when &&
              !(t.id in join.gives)
            ) {
              meet("broken", `${t.id} is not given`);
            }
          }

          for (const [theirs, ours] of Object.entries(join.gives)) {
            pair(parent, ours, child, theirs);

            if (
              caller &&
              ![...caller.takes, ...(caller.may_take ?? [])].includes(ours)
            ) {
              meet("broken", `${ours} is given and not taken`);
            }

            const wants = child.things.find((t) => t.id === theirs)?.starts_as;

            const before = Arr.isArray<
              Workflow["steps"][number]["before"] | undefined
            >(caller?.before)
              ? caller.before
              : [];

            for (const c of before) {
              if (
                Predicate.isTagged("state")(c) &&
                c.thing === ours &&
                wants &&
                c.state !== wants
              ) {
                meet(
                  "broken",
                  `${ours} is ${c.state}; ${theirs} starts as ${wants}`
                );
              }
            }
          }
        } else {
          meet("unsaid", "gives");
        }
      };

      checkGiven();

      if (join.returns) {
        for (const [ours, theirs] of Object.entries(join.returns)) {
          pair(child, theirs, parent, ours);
        }

        for (const ours of caller?.makes ?? []) {
          if (!(ours in join.returns)) {
            meet("broken", `${ours} is made and not returned`);
          }
        }
      } else {
        meet("unsaid", "returns");
      }

      const limit = caller?.harm;

      for (const s of child.steps) {
        if (!Predicate.isString(limit) || !Predicate.isString(s.harm)) {
          out.push({
            law: "handed-down-never-more",
            level: "unsaid",
            at: s.id,
            says: "harm",
          });
        } else if (more(s.harm, limit)) {
          out.push({
            law: "handed-down-never-more",
            level: "broken",
            at: s.id,
            says: `${s.harm} under ${limit}`,
          });
        }
      }
    }
  };

  checkCallIsPinned();

  return out;
};

interface Seen {
  id: string;
  sight?: "public" | "private";
  points_to: readonly string[];
}

export const checkSight = (records: readonly Seen[]): Finding[] => {
  const hidden = new Set(
    records.flatMap((r) => (r.sight === "public" ? [] : [r.id]))
  );

  return records
    .filter((r) => r.sight === "public")
    .flatMap((r) =>
      r.points_to
        .filter((id) => hidden.has(id))
        .map((id) => ({
          law: "public-never-names-private",
          level: "broken" as const,
          at: r.id,
          says: id,
        }))
    );
};

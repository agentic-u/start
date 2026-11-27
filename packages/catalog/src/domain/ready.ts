export interface Row {
  readonly id: string;
  readonly after: readonly string[];
  readonly only?: string;
}

export interface Unit {
  readonly id: string;
  readonly takes: readonly string[];
  readonly makes: readonly string[];
}

export interface Plan {
  readonly rows: readonly Row[];
  readonly units: readonly Unit[];
}

export const reach = (units: readonly Unit[], held: Iterable<string>) => {
  const have = new Set(held);
  const started: string[] = [];

  for (let grew = true; grew;) {
    grew = false;

    for (const u of units) {
      if (!started.includes(u.id) && u.takes.every((t) => have.has(t))) {
        started.push(u.id);

        for (const m of u.makes) {
          have.add(m);
        }

        grew = true;
      }
    }
  }

  return { started, have };
};

export const ready = (plan: Plan, held: readonly string[]) => {
  const have = new Set(held);
  const lacking = plan.rows.filter((r) => !have.has(r.id));

  const asked = new Set(
    lacking.filter((r) => r.only === undefined).flatMap((r) => r.after)
  );

  const always = lacking.filter((r) => r.only === undefined || asked.has(r.id));

  const waiting = (id: string): number =>
    plan.units.filter((u) => u.takes.includes(id)).length +
    lacking.filter((r) => r.after.includes(id)).length;

  const held_up = (r: Row) =>
    r.after.filter((id) => lacking.some((l) => l.id === id));

  const { started } = reach(plan.units, have);

  return {
    ready: always.length === 0,
    first: always
      .filter((r) => held_up(r).length === 0)
      .map((r) => ({ id: r.id, waiting: waiting(r.id) }))
      .toSorted((a, b) => b.waiting - a.waiting)
      .map((r) => r.id),
    later: always
      .filter((r) => held_up(r).length > 0)
      .map((r) => ({ id: r.id, after: held_up(r) })),
    sometimes: lacking.flatMap((r) =>
      r.only === undefined || asked.has(r.id)
        ? []
        : [{ id: r.id, only: r.only }]
    ),
    can_start: started,
  };
};

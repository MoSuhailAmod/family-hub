const ROLLOVER_TIMEZONE = "Africa/Johannesburg";
const ROLLOVER_HOUR = 6;

export type ShoppingRolloverWorkerDependencies = {
  /** Atomically records this week's run; returns false if already claimed. */
  claimWeek(weekKey: string): Promise<boolean>;
  runRollover(): Promise<number>;
};

export type ShoppingRolloverResult = { ran: boolean; deleted: number };

function johannesburgParts(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROLLOVER_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>(
    (parts, part) => ({ ...parts, [part.type]: part.value }),
    {},
  );
}

export function isRolloverDue(now: Date): boolean {
  const parts = johannesburgParts(now);
  return parts.weekday === "Mon" && Number(parts.hour) >= ROLLOVER_HOUR;
}

/** The Monday's calendar date (Africa/Johannesburg) identifying the current rollover week. */
export function currentWeekKey(now: Date): string {
  const parts = johannesburgParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function createShoppingRolloverWorker(dependencies: ShoppingRolloverWorkerDependencies) {
  return {
    async run(now = new Date()): Promise<ShoppingRolloverResult> {
      if (!isRolloverDue(now)) return { ran: false, deleted: 0 };

      const claimed = await dependencies.claimWeek(currentWeekKey(now));
      if (!claimed) return { ran: false, deleted: 0 };

      const deleted = await dependencies.runRollover();
      return { ran: true, deleted };
    },
  };
}

import { describe, it, expect } from "vitest";
import { buildDeterministicPlan } from "../_lib/deterministicPlanner.js";
import { validatePlan } from "../_lib/planValidator.js";
import { planByDeadlines } from "../_lib/deadlinePlanner.js";

const profile = {
  wake_time: "08:00", sleep_time: "22:00",
  block_duration_mins: 45, daily_hour_cap: 6, time_multiplier: 1.0,
};

describe("deterministicPlanner", () => {
  it("produces a plan that passes the validator", () => {
    const plan = buildDeterministicPlan({
      profile,
      tasks: [
        { id: "t1", title: "Math", type: "deep_work", priority: "high", is_fixed: false, estimated_hours: 1.5, deadline: null },
        { id: "t2", title: "Squash", type: "health", priority: "low", is_fixed: true, fixed_time: "18:00", estimated_hours: 1 },
      ],
      fixedEvents: [{ title: "Lecture", start_time: "10:00", end_time: "11:00" }],
    });
    const r = validatePlan(plan, {
      wakeTime: "08:00", sleepTime: "22:00",
      fixedWindows: [{ start_time: "10:00", end_time: "11:00" }, { start_time: "18:00", end_time: "19:00" }],
    });
    expect(r.ok, JSON.stringify(r.errors)).toBe(true);
    expect(plan.provider_used).toBe("deterministic");
  });

  it("respects daily_hour_cap", () => {
    const plan = buildDeterministicPlan({
      profile,
      tasks: Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`, title: `T${i}`, type: "deep_work", priority: "medium",
        is_fixed: false, estimated_hours: 2, deadline: null,
      })),
      fixedEvents: [],
    });
    const usedHours = plan.time_blocks
      .filter((b) => !b.is_fixed)
      .reduce((sum, b) => {
        const [sh, sm] = b.start_time.split(":").map(Number);
        const [eh, em] = b.end_time.split(":").map(Number);
        return sum + ((eh*60+em) - (sh*60+sm)) / 60;
      }, 0);
    expect(usedHours).toBeLessThanOrEqual(profile.daily_hour_cap + 0.01);
  });
});

describe("deadlinePlanner", () => {
  it("spreads work across days remaining until deadline", () => {
    const today = new Date("2025-01-10T00:00:00Z");
    const r = planByDeadlines(
      [{ id: "t1", estimated_hours: 6, deadline: "2025-01-13T00:00:00Z" }],
      8,
      today
    );
    const days = Object.keys(r.perDay).sort();
    expect(days.length).toBe(3);
    const total = days.reduce((sum, k) => sum + r.perDay[k][0].hours, 0);
    expect(total).toBeCloseTo(6, 1);
  });

  it("flags overflow when cap exhausted", () => {
    const today = new Date("2025-01-10T00:00:00Z");
    const r = planByDeadlines(
      [{ id: "big", estimated_hours: 50, deadline: "2025-01-12T00:00:00Z" }],
      2,
      today
    );
    expect(r.overflowTaskIds).toContain("big");
  });
});

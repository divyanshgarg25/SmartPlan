import { describe, it, expect } from "vitest";
import { buildDailyPlanPrompt } from "../_lib/promptBuilder.js";

const profile = {
  wake_time: "07:00", sleep_time: "23:00", timezone: "Asia/Kolkata",
  major: "CS", year: 3, peak_hours_start: "10:00", peak_hours_end: "13:00",
  block_duration_mins: 45, daily_hour_cap: 8, time_multiplier: 1.5,
};

describe("promptBuilder", () => {
  it("pre-multiplies estimated_hours by time_multiplier", () => {
    const { user } = buildDailyPlanPrompt({
      profile,
      checkIn: null,
      tasks: [{ id: "t1", title: "Read", type: "deep_work", priority: "high", is_fixed: false, estimated_hours: 2 }],
    });
    const payload = JSON.parse(user);
    expect(payload.tasks[0].estimated_hours).toBe(3); // 2 * 1.5
  });

  it("throws when tasks exceed 30 (HARD CAP §3.6)", () => {
    const tasks = Array.from({ length: 31 }, (_, i) => ({ id: `t${i}`, title: "x", type: "deep_work", priority: "low", is_fixed: false }));
    expect(() => buildDailyPlanPrompt({ profile, checkIn: null, tasks })).toThrow(/capped at 30/);
  });

  it("includes check_in when provided", () => {
    const { user } = buildDailyPlanPrompt({
      profile,
      checkIn: { energy: 4, top_priority: "Assignment", blocker: null },
      tasks: [],
    });
    const payload = JSON.parse(user);
    expect(payload.check_in.energy).toBe(4);
  });

  it("system prompt requires DayPlan JSON schema", () => {
    const { system } = buildDailyPlanPrompt({ profile, checkIn: null, tasks: [] });
    expect(system).toMatch(/DayPlan/);
    expect(system).toMatch(/rationale/);
  });
});

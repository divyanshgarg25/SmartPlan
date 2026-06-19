import { describe, it, expect } from "vitest";
import { validatePlan } from "../_lib/planValidator.js";

const baseCtx = {
  wakeTime: "07:00",
  sleepTime: "23:00",
  fixedWindows: [{ start_time: "10:00", end_time: "11:00" }],
  highPriorityDueSoon: [],
};

function validPlan(overrides = {}) {
  return {
    date: "2025-01-15",
    daily_insight: "Focus on math first.",
    energy_score: 7,
    estimated_focus_hours: 4,
    time_blocks: [
      {
        id: "b1",
        start_time: "08:00",
        end_time: "09:30",
        title: "Math",
        type: "deep_work",
        priority: "high",
        rationale: "Peak focus window.",
        task_id: "t1",
        is_fixed: false,
        status: "pending",
      },
      {
        id: "b2",
        start_time: "10:00",
        end_time: "11:00",
        title: "Class",
        type: "fixed_event",
        priority: "none",
        rationale: "Fixed event.",
        task_id: null,
        is_fixed: true,
        status: "pending",
      },
    ],
    deferred_tasks: [],
    tips: ["Hydrate", "Short walk"],
    provider_used: "gemini",
    ...overrides,
  };
}

describe("planValidator", () => {
  it("accepts a well-formed plan", () => {
    const r = validatePlan(JSON.stringify(validPlan()), baseCtx);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("detects truncation when string does not end with '}'", () => {
    const truncated = JSON.stringify(validPlan()).slice(0, -1) + ',';
    const r = validatePlan(truncated, baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/TRUNCATED/);
  });

  it("rejects missing required fields", () => {
    const p = validPlan();
    delete p.tips;
    const r = validatePlan(JSON.stringify(p), baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /MISSING_FIELD: tips/.test(e))).toBe(true);
  });

  it("rejects overlapping blocks", () => {
    const p = validPlan({
      time_blocks: [
        { id: "a", start_time: "08:00", end_time: "10:30", title: "X", type: "deep_work", priority: "high", rationale: "x", task_id: null, is_fixed: false, status: "pending" },
        { id: "b", start_time: "10:00", end_time: "11:00", title: "Y", type: "fixed_event", priority: "none", rationale: "y", task_id: null, is_fixed: true, status: "pending" },
      ],
    });
    const r = validatePlan(JSON.stringify(p), baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /OVERLAP/.test(e))).toBe(true);
  });

  it("rejects blocks outside wake..sleep range", () => {
    const p = validPlan({
      time_blocks: [
        { id: "x", start_time: "05:00", end_time: "06:00", title: "Early", type: "deep_work", priority: "high", rationale: "r", task_id: null, is_fixed: false, status: "pending" },
      ],
    });
    const r = validatePlan(JSON.stringify(p), baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /outside wake/.test(e))).toBe(true);
  });

  it("rejects non-fixed block overlapping fixed window", () => {
    const p = validPlan({
      time_blocks: [
        { id: "x", start_time: "09:30", end_time: "10:30", title: "Over", type: "deep_work", priority: "high", rationale: "r", task_id: null, is_fixed: false, status: "pending" },
      ],
    });
    const r = validatePlan(JSON.stringify(p), baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /inviolable fixed window/.test(e))).toBe(true);
  });

  it("rejects deferring a high-priority task due in <24h", () => {
    const p = validPlan({ deferred_tasks: ["urgent1"] });
    const r = validatePlan(JSON.stringify(p), { ...baseCtx, highPriorityDueSoon: ["urgent1"] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /DEFERRED_HIGH_PRIORITY/.test(e))).toBe(true);
  });

  it("rejects missing rationale", () => {
    const p = validPlan();
    p.time_blocks[0].rationale = "";
    const r = validatePlan(JSON.stringify(p), baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /rationale is required/.test(e))).toBe(true);
  });

  it("rejects bad HH:MM format", () => {
    const p = validPlan();
    p.time_blocks[0].start_time = "8:00";
    const r = validatePlan(JSON.stringify(p), baseCtx);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /invalid HH:MM/.test(e))).toBe(true);
  });

  it("rejects tips array of length 1 or 4", () => {
    const r1 = validatePlan(JSON.stringify(validPlan({ tips: ["only one"] })), baseCtx);
    expect(r1.ok).toBe(false);
    const r2 = validatePlan(JSON.stringify(validPlan({ tips: ["a","b","c","d"] })), baseCtx);
    expect(r2.ok).toBe(false);
  });
});

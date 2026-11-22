import assert from "node:assert/strict";
import test from "node:test";
import {
  addDomain,
  bodyCompBand,
  canFocusAnother,
  initialAttributes,
  initialDomainValue,
  project,
  questComplete,
  recoveryScore,
  settleSessions,
  tierEffective,
} from "./engine.js";

function linxiaProfile(onboardedOn = "2026-11-22") {
  return {
    name: "林夏",
    heightCm: 168,
    weightKg: 74,
    sleepHours: 6.6,
    regularity: "60",
    weeklyStrength: 40,
    weeklyCardio: 60,
    weeklyMobility: 15,
    selfStr: 3,
    selfEnd: 2,
    selfMob: 2,
    weekDeep: 180,
    focusSpan: "m25",
    review: "occasional",
    output: "notes",
    onboardedOn,
  };
}

test("林夏初始属性与筛查带", () => {
  const state = { profile: linxiaProfile(), injuries: [], domains: [] };
  const attrs = initialAttributes(state);
  assert.deepEqual(attrs, { str: 41, end: 38, mob: 36, foc: 43, ret: 38, cmp: 42 });
  assert.equal(recoveryScore(6.6, "60"), 63);
  const band = bodyCompBand(168, 74);
  assert.equal(band.bmi, 26.2);
  assert.equal(band.label, "超重范围");
  assert.equal(initialDomainValue({ band: 2, schoolUnused: true, evidence: "self" }), 30);
  assert.equal(initialDomainValue({ band: 3, evidence: "artifact" }), 50);
});

test("力量递减与第 13 节当天结算", () => {
  assert.equal(tierEffective("strength", 30, 90), 29);
  const state = {
    profile: linxiaProfile(),
    injuries: [],
    domains: [{ id: "en", name: "英语", band: 2, schoolUnused: true, evidence: "self", focus: true }],
    sessions: [
      { id: "m", date: "2026-11-22", order: 1, kind: "mobility", raw: 20, quality: 4, pain: 0 },
      { id: "s", date: "2026-11-22", order: 2, kind: "strength", raw: 30, quality: 4, pain: 1 },
      { id: "e", date: "2026-11-22", order: 3, kind: "study", domainId: "en", bucket: "input", raw: 25, quality: 3, pain: 0 },
      { id: "r", date: "2026-11-22", order: 4, kind: "study", domainId: "en", bucket: "retrieval", raw: 15, quality: 3, pain: 0 },
    ],
    days: {
      "2026-11-22": {
        sleep: 6.4,
        quests: [
          { id: "A-mobility", kind: "mobility", minutes: 20, points: 12, bonus: 0.25, bonusAttr: "mob" },
          { id: "B-en", kind: "study", domainId: "en", minutes: 35, points: 12, bonus: 0.25, bonusDomain: "en" },
          { id: "C-recovery", kind: "close", minutes: 0, points: 8, bonus: 0 },
        ],
        closed: true,
      },
    },
  };
  const view = project(state, "2026-11-22");
  assert.equal(view.attributes.str, 41.5);
  assert.equal(view.attributes.end, 38);
  assert.equal(view.attributes.mob, 36.7);
  assert.equal(view.attributes.foc, 43.2);
  assert.equal(view.attributes.ret, 38.2);
  assert.equal(view.attributes.cmp, 42);
  assert.equal(view.domains[0].value, 30.9);
  assert.equal(view.xp, 70);
  assert.equal(view.level, 1);
  assert.equal(view.points, 42);
});

test("衰减有宽限和地板，假期不计入荒废天数", () => {
  const state = {
    profile: { ...linxiaProfile("2026-01-01"), vacationStart: null },
    injuries: [],
    domains: [],
    sessions: [],
    days: {},
  };
  const grown = project(state, "2026-01-22");
  assert.equal(grown.attributes.str, 40.6);
  state.profile.vacationStart = "2026-01-10";
  state.profile.vacationEnd = "2026-01-20";
  const paused = project(state, "2026-01-22");
  assert.equal(paused.attributes.str, 41);
});

test("跳过任务不加分，记录仍然结算", () => {
  const state = {
    profile: linxiaProfile(),
    injuries: [],
    domains: [],
    sessions: [{ id: "s", date: "2026-11-22", order: 1, kind: "strength", raw: 30, quality: 4, pain: 0 }],
    days: {
      "2026-11-22": {
        sleep: 8,
        skipped: ["A-strength"],
        quests: [{ id: "A-strength", kind: "strength", minutes: 30, points: 12, bonus: 0.25, bonusAttr: "str" }],
        closed: true,
      },
    },
  };
  const view = project(state, "2026-11-22");
  assert.equal(questComplete(state.days["2026-11-22"].quests[0], state.days["2026-11-22"], state.sessions), false);
  assert.equal(view.points, 10);
  assert.equal(view.attributes.str, 41.6);
});

test("五天有效学习升到 1 阶并得到称号", () => {
  const sessions = [1, 2, 3, 4, 5].map((day) => ({
    id: `e${day}`,
    date: `2026-11-2${day}`,
    order: 1,
    kind: "study",
    domainId: "en",
    bucket: "input",
    raw: 20,
    quality: 4,
    pain: 0,
  }));
  const state = {
    profile: { ...linxiaProfile("2026-11-21"), sleepHours: 8 },
    injuries: [],
    domains: [{ id: "en", name: "英语", focus: true }],
    sessions,
    days: Object.fromEntries(sessions.map((session) => [session.date, { sleep: 8, closed: true, quests: [] }])),
  };
  const view = project(state, "2026-11-25");
  const english = view.domains[0];
  assert.equal(english.rank, 1);
  assert.equal(english.title, "英语初学者");
  assert.equal(english.badge, "英语·开课");
  assert.equal(view.points, 80);
});

test("重点科目同时最多 5 门", () => {
  const state = { domains: [] };
  for (const name of ["甲", "乙", "丙", "丁", "戊"]) addDomain(state, name);
  assert.equal(canFocusAnother(state), false);
  const extra = addDomain(state, "己");
  assert.equal(extra.ok, true);
  assert.equal(extra.domain.focus, false);
});

test("膝伤不使用深蹲自测档", () => {
  const state = {
    profile: linxiaProfile(),
    injuries: [{ region: "knee", active: true }],
    domains: [],
  };
  assert.equal(initialAttributes(state).str, 27);
});

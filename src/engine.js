/** 个人重建系统结算。公式按设计稿，不在这里改规则。 */

export function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function compareDate(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function eachDate(start, end) {
  const dates = [];
  if (!start || !end || start > end) return dates;
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function weekStart(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addDays(iso, -offset);
}

const SELF_STR = { 1: 20, 2: 35, 3: 50, 4: 62, 5: 72 };
const SELF_END = { 1: 22, 2: 38, 3: 52, 4: 65, 5: 75 };
const SELF_MOB = { 1: 25, 2: 40, 3: 55, 4: 68, 5: 78 };
const FOCUS_SPAN = { lt15: 25, m15: 38, m25: 52, m45: 64, m60: 72 };
const REVIEW = { none: 25, occasional: 38, weekly: 52, spaced: 65, system: 75 };
const OUTPUT = { rare: 28, notes: 42, structure: 55, example: 66, regular: 76 };
const DOMAIN_BAND = { 1: 20, 2: 35, 3: 50, 4: 65, 5: 78 };

const BANDS = {
  strength: [[40, 1], [70, 0.5], [90, 0.2]],
  cardio: [[45, 1], [80, 0.5], [110, 0.2]],
  mobility: [[25, 1], [45, 0.6], [70, 0.2]],
  study: [[90, 1], [150, 0.6], [210, 0.3]],
};

const COUNT_CAP = { strength: 90, cardio: 110, mobility: 70, study: 210, walk: 110 };
const DAILY_CAP = { str: 1.5, end: 1.5, mob: 1.2, foc: 1, ret: 1, cmp: 1 };
const GRACE = { str: 14, end: 10, mob: 14, foc: 21, ret: 21, cmp: 21 };
const DECAY_RATE = { str: 0.4, end: 0.5, mob: 0.3, foc: 0.2, ret: 0.2, cmp: 0.2 };
const FLOOR_MIN = { str: 20, end: 20, mob: 20, foc: 25, ret: 25, cmp: 25 };
const FLOOR_RATIO = { str: 0.75, end: 0.7, mob: 0.75, foc: 0.8, ret: 0.8, cmp: 0.8 };
const ATTR_KEYS = ["str", "end", "mob", "foc", "ret", "cmp"];
const TARGET = {
  strength: { light: 15, standard: 30, challenge: 50 },
  cardio: { light: 20, standard: 35, challenge: 55 },
  mobility: { light: 10, standard: 20, challenge: 30 },
  study: { light: 20, standard: 35, challenge: 50 },
};
const QUEST_POINTS = { light: 8, standard: 12, challenge: 18 };
const QUEST_BONUS = { light: 0.15, standard: 0.25, challenge: 0.4 };
const ABILITY_QUEST = {
  foc: { bucket: "input", label: "输入" },
  ret: { bucket: "retrieval", label: "提取" },
  cmp: { bucket: "output", label: "输出" },
};

export function bodyCompBand(heightCm, weightKg) {
  const meters = heightCm / 100;
  const bmi = weightKg / (meters * meters);
  let label = "肥胖范围";
  if (bmi < 18.5) label = "偏轻范围";
  else if (bmi < 25) label = "常见范围";
  else if (bmi < 30) label = "超重范围";
  return { bmi: round(bmi, 1), label };
}

export function regularityFactor(key) {
  if (key === "30") return 1;
  if (key === "60") return 0.85;
  if (key === "90") return 0.7;
  return 0.55;
}

export function recoveryScore(hours, regularityKey) {
  const sleep = clamp(0, 100, round(((Math.min(hours, 8) - 4) / 4) * 100));
  return round(sleep * (0.75 + 0.25 * regularityFactor(regularityKey)));
}

export function growth(value) {
  if (value < 40) return 1.2;
  if (value < 60) return 1;
  if (value < 75) return 0.7;
  if (value < 85) return 0.4;
  if (value < 95) return 0.15;
  return 0.05;
}

export function sleepRecoveryFactor(hours) {
  if (hours < 5) return 0.5;
  if (hours < 6) return 0.7;
  if (hours < 7) return 0.85;
  return 1;
}

export function painFactor(pain) {
  if (pain >= 7) return 0;
  if (pain >= 4) return 0.5;
  return 1;
}

export function qualityFactor(quality, note) {
  const score = quality === 5 && !String(note || "").trim() ? 4 : quality;
  return { 1: 0.4, 2: 0.6, 3: 0.8, 4: 1, 5: 1.05 }[score] ?? 0.8;
}

function activeInjuries(state) {
  return (state.injuries || []).filter((item) => item.active);
}

function locksStrengthSelf(state) {
  return activeInjuries(state).some((item) => item.region === "knee" || item.region === "wrist");
}

function locksMobilitySelf(state) {
  return activeInjuries(state).some((item) => item.region === "knee");
}

function volumeScore(weekly, cap, base, span) {
  return base + span * (Math.min(weekly, cap) / cap);
}

function mixBody(selfTable, self, volume, selfWeight, volumeWeight, noSelfCap) {
  if (!self) return clamp(15, noSelfCap, round(volume));
  return clamp(15, 85, round(selfWeight * selfTable[self] + volumeWeight * volume));
}

export function initialAttributes(state) {
  const profile = state.profile;
  const kneeOrWrist = locksStrengthSelf(state);
  const str = mixBody(
    SELF_STR,
    kneeOrWrist ? null : profile.selfStr,
    volumeScore(profile.weeklyStrength || 0, 180, 15, 55),
    0.6,
    0.4,
    80,
  );
  const end = mixBody(
    SELF_END,
    profile.selfEnd,
    volumeScore(profile.weeklyCardio || 0, 150, 15, 55),
    0.6,
    0.4,
    80,
  );
  const mob = mixBody(
    SELF_MOB,
    locksMobilitySelf(state) ? null : profile.selfMob,
    volumeScore(profile.weeklyMobility || 0, 90, 20, 50),
    0.65,
    0.35,
    80,
  );
  const focusVolume = volumeScore(profile.weekDeep || 0, 600, 15, 55);
  const foc = profile.focusSpan
    ? clamp(15, 85, round(0.55 * FOCUS_SPAN[profile.focusSpan] + 0.45 * focusVolume))
    : clamp(15, 80, round(focusVolume));
  const ret = profile.review ? clamp(15, 80, REVIEW[profile.review]) : 15;
  const cmp = profile.output ? clamp(15, 80, OUTPUT[profile.output]) : 15;
  return { str, end, mob, foc, ret, cmp };
}

export function initialDomainValue(domain) {
  if (!domain.band) return 15;
  let band = domain.band;
  if (domain.schoolUnused) band = Math.min(band, 2);
  let factor = 0.85;
  let cap = 60;
  if (domain.evidence === "artifact") {
    factor = 1;
    cap = 80;
  }
  if (domain.evidence === "external") {
    factor = 1;
    cap = 85;
  }
  return clamp(10, cap, round(DOMAIN_BAND[band] * factor));
}

function blankAttrState(values) {
  const attrs = {};
  for (const key of ATTR_KEYS) {
    attrs[key] = { value: values[key], peak: values[key], baseline: values[key], last: null };
  }
  return attrs;
}

function vacationSet(profile, today) {
  const dates = new Set();
  if (!profile?.vacationStart) return dates;
  const last = profile.vacationEnd
    ? profile.vacationEnd < addDays(profile.vacationStart, 13)
      ? profile.vacationEnd
      : addDays(profile.vacationStart, 13)
    : addDays(profile.vacationStart, 13);
  const end = last < today ? last : today;
  for (const date of eachDate(profile.vacationStart, end)) dates.add(date);
  return dates;
}

function daysWithout(last, today, vacation) {
  if (!last || last >= today) return 0;
  let count = 0;
  for (let date = addDays(last, 1); date <= today; date = addDays(date, 1)) {
    if (!vacation.has(date)) count += 1;
  }
  return count;
}

function decayValue(baseline, peak, days, grace, rate, floorMin, ratio) {
  const weeks = days > grace ? Math.floor((days - grace) / 7) : 0;
  const floor = Math.max(floorMin, peak * ratio);
  if (baseline <= floor || weeks === 0) return round(baseline, 1);
  return round(Math.max(floor, baseline - weeks * rate), 1);
}

function decayedAttrs(attrs, today, vacation, studyLast) {
  const next = {};
  for (const key of ATTR_KEYS) {
    const last = key === "foc" || key === "ret" || key === "cmp" ? studyLast : attrs[key].last;
    const days = daysWithout(last, today, vacation);
    next[key] = {
      ...attrs[key],
      value: decayValue(attrs[key].baseline, attrs[key].peak, days, GRACE[key], DECAY_RATE[key], FLOOR_MIN[key], FLOOR_RATIO[key]),
    };
  }
  return next;
}

function decayedDomain(domain, today, vacation) {
  if (domain.disabledOn && today > domain.disabledOn) return domain.value;
  const days = daysWithout(domain.last, today, vacation);
  const weeks = days > 14 ? Math.floor((days - 14) / 7) : 0;
  const floor = Math.max(15, domain.peak * 0.7);
  if (domain.baseline <= floor || weeks === 0) return round(domain.baseline, 1);
  return round(Math.max(floor, domain.baseline - weeks * 0.6), 1);
}

export function tierEffective(kind, alreadyRaw, raw) {
  const cuts = [...(BANDS[kind] || BANDS.cardio), [Infinity, 0]];
  let produced = 0;
  let position = alreadyRaw;
  let left = raw;
  let previous = 0;
  for (const [end, rate] of cuts) {
    if (left <= 0) break;
    const from = Math.max(position, previous);
    if (from >= end) {
      previous = end;
      continue;
    }
    const take = Math.min(left, end - from);
    produced += take * rate;
    left -= take;
    position += take;
    previous = end;
  }
  return produced;
}

function bucketWeight(bucket) {
  if (bucket === "retrieval") return 1;
  if (bucket === "output") return 1.1;
  return 0.7;
}

export function settleSessions(startAttrs, startDomains, sessions, sleepHours) {
  const attrs = { ...startAttrs };
  const domains = Object.fromEntries(Object.entries(startDomains).map(([id, value]) => [id, value]));
  const used = { strength: 0, cardio: 0, mobility: 0, study: 0 };
  const gained = { str: 0, end: 0, mob: 0, foc: 0, ret: 0, cmp: 0, domains: {} };
  let effectiveSum = 0;
  const details = [];
  const recovery = sleepRecoveryFactor(sleepHours ?? 8);
  for (const session of sessions) {
    const kind = session.kind === "walk" ? "cardio" : session.kind;
    const tierKind = kind === "study" ? "study" : kind;
    const base = tierEffective(tierKind, used[tierKind] || 0, session.raw);
    used[tierKind] = (used[tierKind] || 0) + session.raw;
    let factorR = recovery;
    if (session.injuryRelevant && (kind === "strength" || kind === "cardio")) factorR *= 0.4;
    if (session.injuryRelevant && kind === "mobility") factorR = session.pain <= 2 ? factorR * 0.7 : 0;
    const factorP = painFactor(session.pain || 0);
    const effective = factorP === 0 || factorR === 0 ? 0 : base * qualityFactor(session.quality, session.note) * factorR * factorP;
    effectiveSum += effective;
    const zeroMinutes = Math.max(0, (used[tierKind] || 0) - (COUNT_CAP[tierKind] || 0));
    if (kind === "strength") gained.str += effective * 0.02 * growth(startAttrs.str);
    if (kind === "cardio") gained.end += effective * 0.018 * growth(startAttrs.end);
    if (kind === "mobility") gained.mob += effective * 0.022 * growth(startAttrs.mob);
    if (kind === "study") {
      const bucket = session.bucket || "input";
      if (bucket === "input") gained.foc += effective * 0.012 * growth(startAttrs.foc);
      if (bucket === "retrieval") gained.ret += effective * 0.015 * growth(startAttrs.ret);
      if (bucket === "output") gained.cmp += effective * 0.015 * growth(startAttrs.cmp);
      if (session.domainId && domains[session.domainId] != null) {
        const current = startDomains[session.domainId];
        gained.domains[session.domainId] = (gained.domains[session.domainId] || 0) + effective * 0.025 * growth(current) * bucketWeight(bucket);
      }
    }
    details.push({ id: session.id, effective: round(effective, 2), unsettled: zeroMinutes > 0 });
  }
  return { gained, effectiveSum, details };
}

function capSum(timeGain, bonus, cap) {
  const time = Math.min(Math.max(timeGain, 0), cap);
  const extra = Math.min(Math.max(bonus, 0), Math.max(0, cap - time));
  return round(time + extra, 1);
}

function applyGains(startAttrs, startDomains, gained, bonuses) {
  const attrs = {};
  for (const key of ATTR_KEYS) {
    attrs[key] = round(startAttrs[key] + capSum(gained[key], bonuses[key] || 0, DAILY_CAP[key]), 1);
  }
  const domains = {};
  for (const [id, value] of Object.entries(startDomains)) {
    domains[id] = round(value + capSum(gained.domains[id] || 0, bonuses.domains[id] || 0, 2), 1);
  }
  return { attrs, domains };
}

function levelFromXp(xp) {
  let level = 0;
  while (25 * (level + 1) * (level + 1) <= xp) level += 1;
  return level;
}

function focusDomains(state) {
  return (state.domains || []).filter((domain) => domain.focus && !domain.disabledOn);
}

export function canFocusAnother(state) {
  return focusDomains(state).length < 5;
}

function questBonusMap(quests, day, sessions) {
  const bonuses = { str: 0, end: 0, mob: 0, foc: 0, ret: 0, cmp: 0, domains: {} };
  for (const quest of quests) {
    if (day.skipped?.includes(quest.id)) continue;
    if (!questComplete(quest, day, sessions)) continue;
    if (quest.bonusAttr) bonuses[quest.bonusAttr] += quest.bonus || 0;
    if (quest.bonusDomain) bonuses.domains[quest.bonusDomain] = (bonuses.domains[quest.bonusDomain] || 0) + (quest.bonus || 0);
  }
  return bonuses;
}

function countable(kind, sessions, domainId, bucket) {
  const cap = COUNT_CAP[kind] || 90;
  let raw = 0;
  for (const session of sessions) {
    if (kind === "walk" && session.kind !== "walk") continue;
    if (kind === "cardio" && session.kind !== "cardio" && session.kind !== "walk") continue;
    if (kind !== "walk" && kind !== "cardio" && session.kind !== kind) continue;
    if (kind === "study" && domainId && session.domainId !== domainId) continue;
    if (kind === "study" && bucket && (session.bucket || "input") !== bucket) continue;
    raw += session.raw;
  }
  return Math.min(raw, cap);
}

export function questComplete(quest, day, sessions) {
  if (day.skipped?.includes(quest.id)) return false;
  if (quest.kind === "confirm") return Boolean(day.confirmed);
  if (quest.kind === "daylight") return Boolean(day.daylight);
  if (quest.kind === "offscreen") return Boolean(day.offscreen);
  if (quest.kind === "review") return String(day.reviewText || "").trim().length > 0;
  if (quest.kind === "sleep") return Boolean(day.sleepIntention) || Boolean(day.closed && day.sleep != null);
  if (quest.kind === "close") return Boolean(day.closed);
  if (quest.kind === "walk" || quest.kind === "strength" || quest.kind === "cardio" || quest.kind === "mobility" || quest.kind === "study") {
    return countable(quest.kind, sessions, quest.domainId, quest.bucket) >= quest.minutes;
  }
  return false;
}

function difficultyFor(recovery, attr) {
  if (recovery < 55) return "light";
  if (attr >= 45 && recovery >= 70) return "challenge";
  return "standard";
}

function makeTrainQuest(slot, kind, attrKey, attrValue, recovery, reason) {
  const difficulty = difficultyFor(recovery, attrValue);
  const minutes = TARGET[kind][difficulty];
  return {
    id: `${slot}-${kind}`,
    slot,
    kind,
    minutes,
    difficulty,
    points: QUEST_POINTS[difficulty],
    bonus: QUEST_BONUS[difficulty],
    bonusAttr: attrKey,
    title: `${labelOf(kind)} ${minutes} 分钟`,
    detail: reason,
  };
}

function labelOf(kind) {
  return { strength: "力量", cardio: "有氧", mobility: "灵活", study: "学习", walk: "平地步行" }[kind] || kind;
}

function recentSlotA(state, today) {
  const keys = [];
  for (let index = 1; index <= 3; index += 1) {
    const quests = state.days?.[addDays(today, -index)]?.quests || [];
    const slot = quests.find((quest) => quest.slot === "A");
    if (slot?.bonusAttr) keys.push(slot.bonusAttr);
  }
  return keys;
}

function lowestAttr(entries) {
  return [...entries].sort((a, b) => a.value - b.value || a.key.localeCompare(b.key))[0];
}

export function buildQuests(state, today, start, recovery, sleepHours, hitZeroYesterday) {
  const day = state.days?.[today] || {};
  const vacationEnd = state.profile?.vacationStart
    ? (state.profile.vacationEnd && state.profile.vacationEnd < addDays(state.profile.vacationStart, 13)
      ? state.profile.vacationEnd
      : addDays(state.profile.vacationStart, 13))
    : null;
  if (state.profile?.vacationStart && today >= state.profile.vacationStart && today <= vacationEnd) {
    return [
      { id: "vac-sleep", slot: "V", kind: "sleep", minutes: 0, points: 8, bonus: 0, title: "假期：记下睡眠", detail: "训练任务暂停。衰减计数也暂停。" },
      { id: "vac-note", slot: "V", kind: "review", minutes: 0, points: 8, bonus: 0, title: "可选：写一句今天的状态", detail: "不做不扣分。" },
      { id: "vac-close", slot: "V", kind: "close", minutes: 0, points: 8, bonus: 0, title: "可以收束，也可以什么都不做", detail: "空白不扣分。" },
    ];
  }
  if (day.rest) {
    return [
      { id: "rest-sleep", slot: "R", kind: "sleep", minutes: 0, points: 8, bonus: 0, title: "写下睡眠", detail: "填写昨夜睡眠，或在收束时一并写下。属性不加。" },
      { id: "rest-move", slot: "R", kind: "walk", minutes: 10, points: 8, bonus: 0, title: "可选：轻松走动 10 分钟", detail: "不做不扣分。" },
      { id: "rest-note", slot: "R", kind: "review", minutes: 0, points: 8, bonus: 0, title: "可选：三行回顾", detail: "不做不扣分。" },
    ];
  }
  const injuries = activeInjuries(state);
  if (injuries.length) {
    const pain = day.painMax ?? 0;
    const knee = injuries.some((item) => item.region === "knee" || item.region === "ankle");
    const wristOnly = injuries.every((item) => item.region === "wrist");
    let second;
    if (pain >= 4) second = { id: "care-safe", slot: "C2", kind: "daylight", minutes: 10, points: 8, bonus: 0, title: "日光下静坐 10 分钟", detail: "坐着算完成。这不是康复动作。" };
    else if (knee && day.walkOk && pain <= 3) second = { id: "care-walk", slot: "C2", kind: "walk", minutes: 15, points: 8, bonus: 0, title: "平地步行 15 分钟", detail: "不适就停，停下也算完成这次记录。" };
    else if (!knee && wristOnly && pain <= 3) second = { id: "care-walk", slot: "C2", kind: "walk", minutes: 15, points: 8, bonus: 0, title: "平地步行 15 分钟", detail: "不安排撑地或紧握。" };
    else second = { id: "care-safe", slot: "C2", kind: "offscreen", minutes: 5, points: 8, bonus: 0, title: "离开屏幕 5 分钟", detail: "今天不安排会用到受伤部位的锻炼。" };
    return [
      { id: "care-read", slot: "C1", kind: "confirm", minutes: 0, points: 8, bonus: 0, title: "确认今天的注意事项", detail: "只说明系统不生成什么。不是医疗建议，也不是康复处方。" },
      second,
      { id: "care-life", slot: "C3", kind: "sleep", minutes: 0, points: 8, bonus: 0, title: "写下今晚的睡眠意向", detail: "大约 7–8 小时只是参考，不足不扣分。" },
    ];
  }
  const body = [
    { key: "str", kind: "strength", value: start.str },
    { key: "end", kind: "cardio", value: start.end },
    { key: "mob", kind: "mobility", value: start.mob },
  ];
  const recent = recentSlotA(state, today);
  let ranked = [...body].sort((a, b) => a.value - b.value || a.key.localeCompare(b.key));
  if (recent.length === 3 && recent.every((key) => key === recent[0])) {
    ranked = ranked.filter((item) => item.key !== recent[0]).concat(ranked.filter((item) => item.key === recent[0]));
  }
  const slotA = ranked[0];
  const names = { str: "力量", end: "耐力", mob: "灵活" };
  const quests = [makeTrainQuest("A", slotA.kind, slotA.key, slotA.value, recovery, `${names[slotA.key]}是力量、耐力、灵活里较低的一项`)];
  const domains = focusDomains(state);
  const practiced = Object.fromEntries(domains.map((domain) => [domain.id, domain.last || state.profile.onboardedOn]));
  const stale = domains
    .map((domain) => ({ domain, days: daysWithout(practiced[domain.id], today, new Set()) }))
    .sort((a, b) => b.days - a.days || a.domain.name.localeCompare(b.domain.name, "zh"));
  if (!domains.length || (stale[0] && stale.every((item) => item.days < 5))) {
    const ability = lowestAttr([
      { key: "foc", value: start.foc },
      { key: "ret", value: start.ret },
      { key: "cmp", value: start.cmp },
    ]);
    const spec = ABILITY_QUEST[ability.key];
    const difficulty = difficultyFor(recovery, ability.value);
    quests.push({
      id: `B-${ability.key}`,
      slot: "B",
      kind: "study",
      bucket: spec.bucket,
      minutes: TARGET.study[difficulty],
      difficulty,
      points: QUEST_POINTS[difficulty],
      bonus: QUEST_BONUS[difficulty],
      bonusAttr: ability.key,
      title: `${spec.label} ${TARGET.study[difficulty]} 分钟`,
      detail: "今天用这一类学习分钟。",
    });
  } else {
    const domain = stale[0].domain;
    const difficulty = difficultyFor(recovery, start.domains[domain.id] ?? 15);
    quests.push({
      id: `B-${domain.id}`,
      slot: "B",
      kind: "study",
      domainId: domain.id,
      minutes: TARGET.study[difficulty],
      difficulty,
      points: QUEST_POINTS[difficulty],
      bonus: QUEST_BONUS[difficulty],
      bonusDomain: domain.id,
      title: `${domain.name} ${TARGET.study[difficulty]} 分钟`,
      detail: stale[0].days >= 5 ? `${domain.name}已经 ${stale[0].days} 天没有记录` : `${domain.name}是重点里较久没记的一门`,
    });
  }
  const week = weekStart(today);
  const practicedBody = new Set();
  for (const session of state.sessions || []) {
    if (session.date >= week && session.date < today) {
      if (session.kind === "strength") practicedBody.add("str");
      if (session.kind === "cardio" || session.kind === "walk") practicedBody.add("end");
      if (session.kind === "mobility") practicedBody.add("mob");
    }
  }
  if (recovery < 60 || sleepHours < 6.5 || hitZeroYesterday) {
    quests.push({ id: "C-recovery", slot: "C", kind: "close", minutes: 0, points: 8, bonus: 0, title: "完成今天的收束", detail: "恢复任务不加属性。" });
  } else {
    const pending = body.filter((item) => !practicedBody.has(item.key));
    const pick = pending.length ? lowestAttr(pending.map((item) => ({ key: item.key, value: item.value, kind: item.kind }))) : { key: "mob", value: start.mob, kind: "mobility" };
    const chosen = body.find((item) => item.key === pick.key);
    if (!pending.length) {
      quests.push({ id: "C-mob", slot: "C", kind: "mobility", minutes: 10, points: 8, bonus: 0.15, bonusAttr: "mob", title: "灵活维持 10 分钟", detail: "本周三项都有记录，今天做短一点的灵活。" });
    } else {
      quests.push(makeTrainQuest("C", chosen.kind, chosen.key, chosen.value, recovery, "本周这一项还没有记录"));
    }
  }
  return quests;
}

function precautions(state, day) {
  const injuries = activeInjuries(state);
  if (!injuries.length) return [];
  const lines = ["这些句子只决定今天不生成哪些任务。不是医疗建议，也不是康复处方。"];
  if (injuries.some((item) => item.region === "knee")) lines.push("不生成跑步、跳跃、深蹲、弓步、楼梯训练，以及膝盖明显弯曲并承重的力量任务。");
  if (injuries.some((item) => item.region === "wrist")) lines.push("不生成俯卧撑、平板支撑、引体和需要紧握的负重。");
  const notes = injuries.map((item) => item.note).filter(Boolean);
  if (notes.length) lines.push(`你写下的原话：${notes.join("；")}`);
  for (const item of injuries) {
    if (item.avoidNote) lines.push(`另外不生成：${item.avoidNote}`);
  }
  if (injuries.some((item) => item.region === "knee" || item.region === "ankle") && !day.walkOk) lines.push("平地步行开关是关的，所以今天不生成步行。");
  lines.push("活动中不适加重就停止。系统不判断伤势。");
  return lines;
}

function firstRankDate(dates) {
  const unique = [...new Set(dates)].sort();
  for (const start of unique) {
    const inside = unique.filter((date) => date >= start && date <= addDays(start, 6));
    if (inside.length >= 5) return inside[4];
  }
  return null;
}

export function project(state, today) {
  const profile = state.profile;
  const initial = initialAttributes(state);
  const attrs = blankAttrState(initial);
  for (const key of ATTR_KEYS) attrs[key].last = profile.onboardedOn;
  const domainState = {};
  for (const domain of state.domains || []) {
    const value = initialDomainValue(domain);
    domainState[domain.id] = { ...domain, value, peak: value, baseline: value, last: profile.onboardedOn };
  }
  let studyLast = profile.onboardedOn;
  let xp = 0;
  let points = 0;
  const vacation = vacationSet(profile, today);
  const detailsById = new Map();
  let zeroYesterday = false;
  let todayStart = null;
  const domainQualifying = {};
  for (const domain of state.domains || []) domainQualifying[domain.id] = [];

  for (const date of eachDate(profile.onboardedOn, today)) {
    const morning = decayedAttrs(attrs, date, vacation, studyLast);
    for (const domain of Object.values(domainState)) {
      if (!(domain.disabledOn && date > domain.disabledOn)) domain.value = decayedDomain(domain, date, vacation);
    }
    const startAttrs = Object.fromEntries(ATTR_KEYS.map((key) => [key, morning[key].value]));
    const startDomains = Object.fromEntries(Object.entries(domainState).map(([id, domain]) => [id, domain.value]));
    if (date === today) todayStart = { attrs: startAttrs, domains: { ...startDomains }, zeroYesterday };
    const sessions = (state.sessions || []).filter((session) => session.date === date).sort((a, b) => a.order - b.order);
    const day = state.days?.[date] || {};
    const sleep = day.sleep ?? profile.sleepHours ?? 7;
    const settled = settleSessions(startAttrs, startDomains, sessions, sleep);
    for (const detail of settled.details) detailsById.set(detail.id, detail);
    const quests = day.quests || [];
    const bonuses = questBonusMap(quests, day, sessions);
    const applied = applyGains(startAttrs, startDomains, settled.gained, bonuses);
    for (const key of ATTR_KEYS) {
      const trained = (key === "str" && sessions.some((session) => session.kind === "strength"))
        || (key === "end" && sessions.some((session) => session.kind === "cardio" || session.kind === "walk"))
        || (key === "mob" && sessions.some((session) => session.kind === "mobility"))
        || ((key === "foc" || key === "ret" || key === "cmp") && sessions.some((session) => session.kind === "study"));
      attrs[key].value = applied.attrs[key];
      attrs[key].peak = Math.max(attrs[key].peak, applied.attrs[key]);
      if (trained) {
        attrs[key].baseline = applied.attrs[key];
        attrs[key].last = date;
      }
    }
    if (sessions.some((session) => session.kind === "study")) studyLast = date;
    for (const [id, domain] of Object.entries(domainState)) {
      if (domain.disabledOn && date > domain.disabledOn) {
        domain.value = domain.baseline;
        continue;
      }
      domain.value = applied.domains[id];
      domain.peak = Math.max(domain.peak, domain.value);
      if (sessions.some((session) => session.domainId === id)) {
        domain.baseline = domain.value;
        domain.last = date;
      }
    }
    xp += Math.min(180, round(settled.effectiveSum));
    for (const quest of quests) {
      if (questComplete(quest, day, sessions)) points += quest.points;
    }
    if (day.closed) points += 10;
    zeroYesterday = settled.details.some((detail) => detail.unsettled);
    for (const [id, dates] of Object.entries(domainQualifying)) {
      if (sessions.some((session) => session.domainId === id && (detailsById.get(session.id)?.effective || 0) >= 15)) dates.push(date);
    }
  }

  const domainViews = Object.values(domainState).map((domain) => {
    const dates = domainQualifying[domain.id] || [];
    const promotedOn = firstRankDate(dates);
    const windowCount = dates.filter((date) => date >= addDays(today, -6) && date <= today).length;
    const rank = promotedOn ? 1 : 0;
    return {
      id: domain.id,
      name: domain.name,
      value: round(domain.value, 1),
      focus: domain.focus,
      disabledOn: domain.disabledOn || null,
      last: domain.last,
      rank,
      title: rank >= 1 ? `${domain.name}初学者` : "",
      badge: rank >= 1 ? `${domain.name}·开课` : "",
      remaining: rank >= 1 ? 0 : Math.max(0, 5 - windowCount),
      promotedOn,
    };
  });
  for (const domain of domainViews) {
    if (domain.promotedOn) points += 30;
  }
  const equipped = domainViews.find((domain) => domain.focus && !domain.disabledOn && domain.title) || domainViews.find((domain) => domain.title);
  const endAttrs = Object.fromEntries(ATTR_KEYS.map((key) => [key, round(attrs[key].value, 1)]));
  const todaySessions = (state.sessions || []).filter((session) => session.date === today);
  const todayDay = state.days?.[today] || {};
  const sleepToday = todayDay.sleep ?? profile.sleepHours ?? 7;
  const recovery = recoveryScore(sleepToday, profile.regularity || "60");
  const questState = {
    ...state,
    domains: (state.domains || []).map((domain) => ({ ...domain, last: domainState[domain.id]?.last || profile.onboardedOn })),
  };
  const suggested = buildQuests(
    questState,
    today,
    { ...(todayStart?.attrs || endAttrs), domains: todayStart?.domains || Object.fromEntries(domainViews.map((domain) => [domain.id, domain.value])) },
    recovery,
    sleepToday,
    todayStart?.zeroYesterday || false,
  );
  const band = bodyCompBand(profile.heightCm, profile.weightKg);
  const fit = round(0.4 * endAttrs.str + 0.4 * endAttrs.end + 0.2 * endAttrs.mob);
  const ltp = round(0.45 * endAttrs.foc + 0.3 * endAttrs.cmp + 0.25 * endAttrs.ret);
  return {
    attributes: endAttrs,
    recovery,
    fit,
    ltp,
    xp,
    level: levelFromXp(xp),
    nextLevelXp: 25 * (levelFromXp(xp) + 1) ** 2,
    points,
    band,
    domains: domainViews,
    equippedTitle: equipped?.title || "",
    precautions: precautions(state, todayDay),
    suggestedQuests: suggested,
    quests: (todayDay.quests || suggested).map((quest) => ({
      ...quest,
      done: questComplete(quest, todayDay, todaySessions),
      skipped: Boolean(todayDay.skipped?.includes(quest.id)),
    })),
    onVacation: vacation.has(today),
    sessionDetails: todaySessions.map((session) => detailsById.get(session.id)).filter(Boolean),
  };
}

export function addDomain(state, name) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "先写科目名称" };
  if ((state.domains || []).some((domain) => domain.name === trimmed && !domain.disabledOn)) return { ok: false, error: "已经有这门科目" };
  const domain = {
    id: `d${Date.now().toString(36)}`,
    name: trimmed,
    band: null,
    evidence: "self",
    schoolUnused: false,
    focus: canFocusAnother(state),
    disabledOn: null,
  };
  state.domains.push(domain);
  return { ok: true, domain };
}

export function setDomainDisabled(state, id, today, disabled) {
  const domain = state.domains.find((item) => item.id === id);
  if (!domain) return { ok: false, error: "没有这门科目" };
  if (disabled) {
    domain.disabledOn = today;
    domain.focus = false;
    return { ok: true };
  }
  domain.disabledOn = null;
  domain.focus = canFocusAnother(state);
  return { ok: true, focus: domain.focus };
}

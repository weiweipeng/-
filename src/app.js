import {
  addDays,
  addDomain,
  bodyCompBand,
  canFocusAnother,
  project,
  setDomainDisabled,
  todayKey,
} from "./engine.js";

const STORAGE_KEY = "personal-rebuild-v1";
const REGIONS = [
  ["knee", "膝"],
  ["wrist", "腕"],
  ["ankle", "踝"],
  ["shoulder", "肩"],
  ["low_back", "腰"],
  ["neck", "颈"],
  ["other", "其他"],
];
const ATTRS = [
  ["str", "力量"],
  ["end", "耐力"],
  ["mob", "灵活"],
  ["foc", "专注"],
  ["ret", "提取"],
  ["cmp", "建构"],
];

const state = load();
let screen = state.profile ? "today" : "setup";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.profile) return saved;
  } catch {
    /* 空档案 */
  }
  return { profile: null, injuries: [], domains: [], sessions: [], days: {} };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function field(label, control) {
  return el("label", {}, [label, control]);
}

function input(props) {
  return el("input", props);
}

function button(label, props, className = "ghost") {
  return el("button", { ...props, class: className, type: "button" }, [label]);
}

function today() {
  return todayKey();
}

function dayRecord() {
  const date = today();
  if (!state.days[date]) state.days[date] = { sleep: state.profile.sleepHours, quests: null, skipped: [] };
  return state.days[date];
}

function view() {
  const record = dayRecord();
  const projected = project(state, today());
  if (!record.closed && !(record.skipped || []).length) record.quests = projected.suggestedQuests;
  if (!record.quests) record.quests = projected.suggestedQuests;
  save();
  return project(state, today());
}

function render() {
  const root = document.querySelector("#app");
  root.replaceChildren();
  if (!state.profile) {
    root.append(renderSetup());
    return;
  }
  const current = view();
  root.append(renderHeader(current), renderNav(), renderScreen(current));
}

function renderHeader(current) {
  return el("header", { class: "top" }, [
    el("div", {}, [
      el("h1", {}, ["个人重建系统"]),
      el("div", { class: "sub" }, [state.profile.name, current.equippedTitle ? ` · ${current.equippedTitle}` : ""]),
    ]),
    el("div", { class: "score" }, [
      el("b", {}, [`等级 ${current.level}`]),
      el("div", { class: "sub" }, [`积分 ${current.points} · 距下一级 ${Math.max(0, current.nextLevelXp - current.xp)} 经验`]),
    ]),
  ]);
}

function renderNav() {
  const items = [
    ["today", "今日"],
    ["log", "记一笔"],
    ["panel", "面板"],
    ["subjects", "科目"],
    ["body", "身体"],
  ];
  return el("nav", {}, items.map(([id, label]) => button(label, {
    "aria-current": screen === id ? "true" : "false",
    onclick: () => { screen = id; render(); },
  })));
}

function renderScreen(current) {
  if (screen === "log") return renderLog(current);
  if (screen === "panel") return renderPanel(current);
  if (screen === "subjects") return renderSubjects(current);
  if (screen === "body") return renderBody(current);
  return renderToday(current);
}

function renderToday(current) {
  const record = dayRecord();
  const band = current.band;
  const wrap = el("section", {}, [
    el("div", { class: "card" }, [
      el("h2", {}, ["今天"]),
      el("p", { class: "hint" }, [`筛查带：${band.label}（BMI ${band.bmi}）。这是身高体重的状态标签，不是能力，也不是评价。`]),
      field("昨夜睡眠（小时）", input({
        id: "sleep",
        type: "number",
        min: "0",
        max: "14",
        step: "0.1",
        value: record.sleep ?? state.profile.sleepHours,
        onchange: (event) => {
          record.sleep = Number(event.target.value);
          if (!record.closed && !(record.skipped || []).length) record.quests = null;
          save();
          render();
        },
      })),
      el("div", { class: "row" }, [
        el("span", { class: "tag" }, [`恢复 ${current.recovery}`]),
        button(record.rest ? "取消休息日" : "标成休息日", {
          onclick: () => {
            if (record.closed) return;
            record.rest = !record.rest;
            record.quests = null;
            record.skipped = [];
            save();
            render();
          },
        }),
        button(record.closed ? "已收束" : "收束今天", {
          id: "close-day",
          onclick: () => {
            record.closed = true;
            record.sleep = Number(document.querySelector("#sleep").value);
            save();
            render();
          },
        }, "primary"),
      ]),
    ]),
  ]);
  if (current.onVacation) {
    wrap.append(el("div", { class: "warn" }, ["假期中。衰减计数暂停，训练任务也先停。"]));
  }
  if (current.precautions.length) {
    wrap.append(el("div", { class: "card" }, [
      el("h2", {}, ["注意事项"]),
      el("div", { class: "warn" }, ["不是医疗建议，不会给出康复处方。"]),
      el("ul", {}, current.precautions.map((line) => el("li", {}, [line]))),
    ]));
  }
  const ceremony = current.domains.filter((domain) => domain.promotedOn === today());
  if (ceremony.length) {
    wrap.append(el("div", { class: "card" }, ceremony.map((domain) => el("p", {}, [`${domain.name}进入开课。称号换成「${domain.title}」。`]))));
  }
  const list = el("div", { class: "card" }, [el("h2", {}, [record.rest ? "休息日的三件事" : "今天的三件事"])]);
  for (const quest of current.quests) {
    list.append(el("div", { class: quest.done ? "quest done" : "quest" }, [
      el("div", {}, [
        el("strong", {}, [quest.done ? `已完成 · ${quest.title}` : quest.title]),
        el("div", { class: "hint" }, [quest.detail || "", ` 完成 +${quest.points} 积分`]),
      ]),
      quest.done || quest.skipped ? el("span", { class: "hint" }, [quest.skipped ? "已跳过" : "已完成"]) : button("跳过", {
        onclick: () => {
          record.skipped = [...(record.skipped || []), quest.id];
          save();
          render();
        },
      }),
    ]));
  }
  if (current.quests.some((quest) => quest.kind === "confirm")) {
    list.append(field("我看过注意事项", el("input", {
      type: "checkbox",
      checked: record.confirmed ? "" : null,
      onchange: (event) => { record.confirmed = event.target.checked; save(); render(); },
    })));
  }
  if (current.quests.some((quest) => quest.kind === "daylight")) {
    list.append(field("日光下静坐完成", el("input", {
      type: "checkbox",
      onchange: (event) => { record.daylight = event.target.checked; save(); render(); },
    })));
  }
  if (current.quests.some((quest) => quest.kind === "offscreen")) {
    list.append(field("离开屏幕完成", el("input", {
      type: "checkbox",
      onchange: (event) => { record.offscreen = event.target.checked; save(); render(); },
    })));
  }
  if (current.quests.some((quest) => quest.kind === "review" || quest.kind === "sleep")) {
    list.append(field("今晚睡眠意向或三行回顾", el("textarea", {
      id: "note",
      onchange: (event) => {
        record.sleepIntention = event.target.value;
        record.reviewText = event.target.value;
        save();
        render();
      },
    }, [])));
  }
  wrap.append(list);
  return wrap;
}

function renderLog() {
  const domains = state.domains.filter((domain) => !domain.disabledOn);
  const form = el("form", { class: "card", id: "log-form" }, [
    el("h2", {}, ["记一笔"]),
    field("种类", el("select", { id: "kind" }, [
      ["strength", "力量"],
      ["cardio", "有氧"],
      ["walk", "平地步行"],
      ["mobility", "灵活"],
      ["study", "学习"],
    ].map(([value, label]) => el("option", { value }, [label])))),
    field("科目（学习时）", el("select", { id: "domain" }, [el("option", { value: "" }, ["不指定"])].concat(domains.map((domain) => el("option", { value: domain.id }, [domain.name]))))),
    field("学习方式", el("select", { id: "bucket" }, [
      ["input", "输入"],
      ["retrieval", "提取"],
      ["output", "输出"],
    ].map(([value, label]) => el("option", { value }, [label])))),
    field("分钟", input({ id: "minutes", type: "number", min: "1", max: "300", value: "20" })),
    field("质量 1–5", input({ id: "quality", type: "number", min: "1", max: "5", value: "3" })),
    field("疼痛 0–10", input({ id: "pain", type: "number", min: "0", max: "10", value: "0" })),
    field("证据或组数（质量 5 必填）", input({ id: "note", type: "text" })),
    field("这次顶着已标记的伤病做的", el("input", { id: "injury", type: "checkbox" })),
    el("p", { class: "hint" }, ["同一学习分钟只进一个方式。超时的部分会记下来，但不再增加属性。"]),
    button("保存这条记录", { id: "save-log", onclick: saveLog }, "primary"),
  ]);
  return el("section", {}, [form]);
}

function saveLog() {
  const raw = Number(document.querySelector("#minutes").value);
  const quality = Number(document.querySelector("#quality").value);
  const note = document.querySelector("#note").value;
  if (!raw || raw < 1) return;
  if (quality === 5 && !note.trim()) {
    document.querySelector("#note").focus();
    return;
  }
  const kind = document.querySelector("#kind").value;
  state.sessions.push({
    id: `s${Date.now().toString(36)}`,
    date: today(),
    order: state.sessions.length + 1,
    kind,
    domainId: kind === "study" ? document.querySelector("#domain").value || null : null,
    bucket: kind === "study" ? document.querySelector("#bucket").value : null,
    raw,
    quality,
    note,
    pain: Number(document.querySelector("#pain").value) || 0,
    injuryRelevant: document.querySelector("#injury").checked,
  });
  save();
  screen = "today";
  render();
}

function renderPanel(current) {
  const grid = el("div", { class: "grid" });
  for (const [key, label] of ATTRS) {
    grid.append(el("div", { class: "stat" }, [el("span", {}, [label]), el("strong", {}, [current.attributes[key].toFixed(1)])]));
  }
  grid.append(el("div", { class: "stat" }, [el("span", {}, ["恢复"]), el("strong", {}, [String(current.recovery)])]));
  const domains = el("div", {}, current.domains.filter((domain) => !domain.disabledOn).map((domain) => el("p", {}, [
    `${domain.name} ${domain.value.toFixed(1)} · ${domain.rank ? `阶 ${domain.rank} · ${domain.title}` : `未开课，近 7 天还差 ${domain.remaining} 天`}`,
    domain.badge ? ` · 徽章 ${domain.badge}` : "",
  ])));
  return el("section", {}, [
    el("div", { class: "card" }, [
      el("h2", {}, ["人物面板"]),
      grid,
      el("p", { class: "hint" }, [`积分 ${current.points} · 等级 ${current.level} · 经验 ${current.xp} · 体能储备 ${current.fit} · 学习吞吐 ${current.ltp}`]),
    ]),
    el("div", { class: "card" }, [el("h2", {}, ["科目进度"]), domains.childNodes.length ? domains : el("p", { class: "hint" }, ["还没有科目。到「科目」里自己添加。"])]),
  ]);
}

function renderSubjects(current) {
  const list = el("div", { class: "card" }, [el("h2", {}, ["学习科目"])]);
  list.append(el("p", { class: "hint" }, ["没有预置清单。自己添加，自己停用。同时作为重点的最多 5 门。"]));
  for (const domain of state.domains) {
    const live = current.domains.find((item) => item.id === domain.id);
    list.append(el("div", { class: "quest" }, [
      el("div", {}, [
        el("strong", {}, [domain.disabledOn ? `${domain.name}（已停用）` : domain.name]),
        el("div", { class: "hint" }, [domain.focus ? "重点" : "已记录，不进今日轮换", live?.title ? ` · ${live.title}` : ""]),
      ]),
      button(domain.disabledOn ? "重新启用" : "停用", {
        onclick: () => {
          setDomainDisabled(state, domain.id, today(), !domain.disabledOn);
          save();
          render();
        },
      }, "ghost danger"),
    ]));
  }
  const name = input({ id: "subject-name", type: "text", placeholder: "例如：会计、编程、英语" });
  list.append(field("新科目", name), button("添加", {
    id: "add-subject",
    onclick: () => {
      const result = addDomain(state, name.value);
      if (!result.ok) return;
      const record = dayRecord();
      if (!record.closed) record.quests = null;
      save();
      render();
    },
  }, "primary"));
  if (!canFocusAnother(state)) list.append(el("p", { class: "hint" }, ["重点已有 5 门。新科目仍可添加，但先不进入任务轮换，除非停用一门。"]));
  return el("section", {}, [list]);
}

function renderBody(current) {
  const record = dayRecord();
  const card = el("div", { class: "card" }, [
    el("h2", {}, ["身体情况"]),
    el("div", { class: "warn" }, ["伤病只用来过滤任务。这里不是医疗建议，也不安排康复动作。"]),
    el("p", {}, [`身高 ${state.profile.heightCm} cm · 体重 ${state.profile.weightKg} kg · ${current.band.label}`]),
  ]);
  for (const injury of state.injuries) {
    if (!injury.active) continue;
    const region = REGIONS.find((item) => item[0] === injury.region)?.[1] || injury.region;
    card.append(el("div", { class: "quest" }, [
      el("div", {}, [el("strong", {}, [`${region} · ${injury.note || "未写原话"}`]), el("div", { class: "hint" }, [injury.avoidNote || ""])]),
      button("解除标记", { onclick: () => { injury.active = false; record.quests = null; save(); render(); } }),
    ]));
  }
  card.append(
    field("部位", el("select", { id: "region" }, REGIONS.map(([value, label]) => el("option", { value }, [label])))),
    field("你的原话", input({ id: "injury-note", type: "text", placeholder: "例如：下楼会不适" })),
    field("还不要生成的活动", input({ id: "avoid-note", type: "text" })),
    button("添加伤病标记", {
      onclick: () => {
        state.injuries.push({
          id: `i${Date.now().toString(36)}`,
          region: document.querySelector("#region").value,
          note: document.querySelector("#injury-note").value.trim(),
          avoidNote: document.querySelector("#avoid-note").value.trim(),
          active: true,
        });
        record.quests = null;
        save();
        render();
      },
    }, "primary"),
    field("今天疼痛（0–10，有标记时填写）", input({
      id: "pain-max",
      type: "number",
      min: "0",
      max: "10",
      value: String(record.painMax ?? 0),
      onchange: (event) => { record.painMax = Number(event.target.value); record.quests = null; save(); render(); },
    })),
    field("今天可以平地步行", el("input", {
      id: "walk-ok",
      type: "checkbox",
      onchange: (event) => { record.walkOk = event.target.checked; record.quests = null; save(); render(); },
    })),
    el("div", { class: "row" }, [
        button(state.profile.vacationStart && (!state.profile.vacationEnd || state.profile.vacationEnd >= today()) ? "结束假期" : "开始假期（最多 14 天）", {
        onclick: () => {
          const active = state.profile.vacationStart && (!state.profile.vacationEnd || state.profile.vacationEnd >= today());
          if (active) {
            const yesterday = addDays(today(), -1);
            if (yesterday < state.profile.vacationStart) {
              state.profile.vacationStart = null;
              state.profile.vacationEnd = null;
            } else state.profile.vacationEnd = yesterday;
          } else {
            state.profile.vacationStart = today();
            state.profile.vacationEnd = null;
          }
          record.quests = null;
          save();
          render();
        },
      }),
    ]),
  );
  return el("section", {}, [card]);
}

function renderSetup() {
  const form = el("form", { class: "card", id: "setup" }, [
    el("h2", {}, ["建立人物"]),
    el("p", { class: "hint" }, ["身高和体重只生成筛查带。学习科目建档后再自己添加，这里不提供清单。"]),
    field("怎么称呼", input({ id: "name", value: "鹏" })),
    field("身高 cm", input({ id: "height", type: "number", value: "170" })),
    field("体重 kg", input({ id: "weight", type: "number", step: "0.1", value: "70" })),
    el("p", { id: "band", class: "hint" }, ["筛查带会在这里显示。"]),
    field("近 7 日平均睡眠", input({ id: "sleep-avg", type: "number", step: "0.1", value: "7" })),
    field("起床波动", el("select", { id: "regularity" }, [
      ["30", "30 分钟以内"],
      ["60", "60 分钟以内"],
      ["90", "90 分钟以内"],
      ["more", "更大"],
    ].map(([value, label]) => el("option", { value }, [label])))),
    field("每周力量分钟", input({ id: "w-str", type: "number", value: "0" })),
    field("每周有氧分钟", input({ id: "w-end", type: "number", value: "0" })),
    field("每周灵活分钟", input({ id: "w-mob", type: "number", value: "0" })),
    field("力量自测档（可空）", optionalBand("self-str")),
    field("耐力自测档（可空）", optionalBand("self-end")),
    field("灵活自测档（可空）", optionalBand("self-mob")),
    field("每周深度学习分钟", input({ id: "deep", type: "number", value: "0" })),
    field("单次典型专注", el("select", { id: "span" }, [
      ["", "先不填"],
      ["lt15", "不到 15 分钟"],
      ["m15", "15–24 分钟"],
      ["m25", "25–44 分钟"],
      ["m45", "45–59 分钟"],
      ["m60", "60 分钟及以上"],
    ].map(([value, label]) => el("option", { value }, [label])))),
    field("复习习惯", el("select", { id: "review" }, [
      ["", "先不填"],
      ["none", "几乎不复习"],
      ["occasional", "想起来才看"],
      ["weekly", "每周复习，没有间隔"],
      ["spaced", "大约 1 天和 7 天会回看"],
      ["system", "有间隔重复或错题回炉"],
    ].map(([value, label]) => el("option", { value }, [label])))),
    field("输出习惯", el("select", { id: "output" }, [
      ["", "先不填"],
      ["rare", "很少能讲出来"],
      ["notes", "能写要点，讲给别人会卡"],
      ["structure", "不看笔记能讲清结构"],
      ["example", "能举例讲给不懂的人"],
      ["regular", "定期有输出，且持续超过 3 个月"],
    ].map(([value, label]) => el("option", { value }, [label])))),
    button("开始记录", { id: "create-profile", onclick: createProfile }, "primary"),
  ]);
  const height = form.querySelector("#height");
  const weight = form.querySelector("#weight");
  const updateBand = () => {
    const band = bodyCompBand(Number(height.value), Number(weight.value));
    form.querySelector("#band").textContent = Number.isFinite(band.bmi) ? `筛查带：${band.label}（BMI ${band.bmi}）。不是能力，也不是评价。` : "";
  };
  height.addEventListener("input", updateBand);
  weight.addEventListener("input", updateBand);
  updateBand();
  return el("section", {}, [el("h1", {}, ["个人重建系统"]), form]);
}

function optionalBand(id) {
  return el("select", { id }, [["", "不测，只用每周分钟"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]].map(([value, label]) => el("option", { value }, [label])));
}

function num(id) {
  return Number(document.querySelector(`#${id}`).value);
}

function optionalNum(id) {
  const value = document.querySelector(`#${id}`).value;
  return value ? Number(value) : null;
}

function createProfile() {
  const name = document.querySelector("#name").value.trim() || "鹏";
  const heightCm = num("height");
  const weightKg = num("weight");
  if (heightCm < 50 || weightKg < 20) return;
  state.profile = {
    name,
    heightCm,
    weightKg,
    sleepHours: num("sleep-avg"),
    regularity: document.querySelector("#regularity").value,
    weeklyStrength: num("w-str") || 0,
    weeklyCardio: num("w-end") || 0,
    weeklyMobility: num("w-mob") || 0,
    selfStr: optionalNum("self-str"),
    selfEnd: optionalNum("self-end"),
    selfMob: optionalNum("self-mob"),
    weekDeep: num("deep") || 0,
    focusSpan: document.querySelector("#span").value || null,
    review: document.querySelector("#review").value || null,
    output: document.querySelector("#output").value || null,
    onboardedOn: today(),
    vacationStart: null,
    vacationEnd: null,
  };
  state.injuries = [];
  state.domains = [];
  state.sessions = [];
  state.days = {};
  save();
  screen = "today";
  render();
}

render();

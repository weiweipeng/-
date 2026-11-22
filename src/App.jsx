import { useEffect, useState } from "react";
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
const NAV = [
  ["today", "今日"],
  ["log", "记一笔"],
  ["panel", "面板"],
  ["subjects", "科目"],
  ["body", "身体"],
];

function emptyState() {
  return { profile: null, injuries: [], domains: [], sessions: [], days: {} };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.profile) return saved;
  } catch {
    /* 空档案 */
  }
  return emptyState();
}

function syncQuests(state) {
  if (!state.profile) return false;
  const date = todayKey();
  if (!state.days[date]) state.days[date] = { sleep: state.profile.sleepHours, quests: null, skipped: [] };
  const record = state.days[date];
  const projected = project(state, date);
  const refresh = !record.closed && !(record.skipped || []).length;
  if (!(refresh || !record.quests)) return false;
  if (JSON.stringify(record.quests) === JSON.stringify(projected.suggestedQuests)) return false;
  record.quests = projected.suggestedQuests;
  return true;
}

function Field({ label, children }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

function BandSelect({ id, value, onChange }) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">不测，只用每周分钟</option>
      {["1", "2", "3", "4", "5"].map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
}

export default function App() {
  const [state, setState] = useState(load);
  const [screen, setScreen] = useState(() => (load().profile ? "today" : "setup"));

  function commit(mutator) {
    setState((current) => {
      const next = structuredClone(current);
      if (next.profile && !next.days[todayKey()]) {
        next.days[todayKey()] = { sleep: next.profile.sleepHours, quests: null, skipped: [] };
      }
      mutator(next);
      syncQuests(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    if (!state.profile) return;
    const next = structuredClone(state);
    if (!syncQuests(next)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  }, [state]);

  if (!state.profile) {
    return (
      <Setup onCreate={(profile) => {
        commit((next) => {
          next.profile = profile;
          next.injuries = [];
          next.domains = [];
          next.sessions = [];
          next.days = {};
        });
        setScreen("today");
      }} />
    );
  }

  const today = todayKey();
  const record = state.days[today] || { sleep: state.profile.sleepHours, quests: [], skipped: [] };
  const current = project(state, today);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>个人重建系统</h1>
          <div className="sub">{state.profile.name}{current.equippedTitle ? ` · ${current.equippedTitle}` : ""}</div>
        </div>
        <div className="score">
          <b>等级 {current.level}</b>
          <div className="sub">积分 {current.points} · 距下一级 {Math.max(0, current.nextLevelXp - current.xp)} 经验</div>
        </div>
      </header>
      <nav>
        {NAV.map(([id, label]) => (
          <button key={id} type="button" aria-current={screen === id} onClick={() => setScreen(id)}>{label}</button>
        ))}
      </nav>
      {screen === "log" && <Log state={state} onSave={(session) => commit((next) => { next.sessions.push(session); setScreen("today"); })} />}
      {screen === "panel" && <Panel current={current} />}
      {screen === "subjects" && <Subjects state={state} current={current} commit={commit} />}
      {screen === "body" && <Body state={state} current={current} record={record} commit={commit} />}
      {screen === "today" && <Today state={state} current={current} record={record} commit={commit} />}
    </div>
  );
}

function Setup({ onCreate }) {
  const [form, setForm] = useState({
    name: "鹏",
    height: "170",
    weight: "70",
    sleep: "7",
    regularity: "30",
    strength: "0",
    cardio: "0",
    mobility: "0",
    selfStr: "",
    selfEnd: "",
    selfMob: "",
    deep: "0",
    span: "",
    review: "",
    output: "",
  });
  const band = bodyCompBand(Number(form.height), Number(form.weight));
  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function create() {
    const heightCm = Number(form.height);
    const weightKg = Number(form.weight);
    if (heightCm < 50 || weightKg < 20) return;
    onCreate({
      name: form.name.trim() || "鹏",
      heightCm,
      weightKg,
      sleepHours: Number(form.sleep),
      regularity: form.regularity,
      weeklyStrength: Number(form.strength) || 0,
      weeklyCardio: Number(form.cardio) || 0,
      weeklyMobility: Number(form.mobility) || 0,
      selfStr: form.selfStr ? Number(form.selfStr) : null,
      selfEnd: form.selfEnd ? Number(form.selfEnd) : null,
      selfMob: form.selfMob ? Number(form.selfMob) : null,
      weekDeep: Number(form.deep) || 0,
      focusSpan: form.span || null,
      review: form.review || null,
      output: form.output || null,
      onboardedOn: todayKey(),
      vacationStart: null,
      vacationEnd: null,
    });
  }
  return (
    <section className="app">
      <h1>个人重建系统</h1>
      <form className="card" id="setup" onSubmit={(event) => { event.preventDefault(); create(); }}>
        <h2>建立人物</h2>
        <p className="hint">身高和体重只生成筛查带。学习科目建档后再自己添加，这里不提供清单。</p>
        <Field label="怎么称呼"><input id="name" value={form.name} onChange={(event) => set("name", event.target.value)} /></Field>
        <Field label="身高 cm"><input id="height" type="number" value={form.height} onChange={(event) => set("height", event.target.value)} /></Field>
        <Field label="体重 kg"><input id="weight" type="number" step="0.1" value={form.weight} onChange={(event) => set("weight", event.target.value)} /></Field>
        <p id="band" className="hint">{Number.isFinite(band.bmi) ? `筛查带：${band.label}（BMI ${band.bmi}）。不是能力，也不是评价。` : ""}</p>
        <Field label="近 7 日平均睡眠"><input id="sleep-avg" type="number" step="0.1" value={form.sleep} onChange={(event) => set("sleep", event.target.value)} /></Field>
        <Field label="起床波动">
          <select id="regularity" value={form.regularity} onChange={(event) => set("regularity", event.target.value)}>
            <option value="30">30 分钟以内</option>
            <option value="60">60 分钟以内</option>
            <option value="90">90 分钟以内</option>
            <option value="more">更大</option>
          </select>
        </Field>
        <Field label="每周力量分钟"><input id="w-str" type="number" value={form.strength} onChange={(event) => set("strength", event.target.value)} /></Field>
        <Field label="每周有氧分钟"><input id="w-end" type="number" value={form.cardio} onChange={(event) => set("cardio", event.target.value)} /></Field>
        <Field label="每周灵活分钟"><input id="w-mob" type="number" value={form.mobility} onChange={(event) => set("mobility", event.target.value)} /></Field>
        <Field label="力量自测档（可空）"><BandSelect id="self-str" value={form.selfStr} onChange={(value) => set("selfStr", value)} /></Field>
        <Field label="耐力自测档（可空）"><BandSelect id="self-end" value={form.selfEnd} onChange={(value) => set("selfEnd", value)} /></Field>
        <Field label="灵活自测档（可空）"><BandSelect id="self-mob" value={form.selfMob} onChange={(value) => set("selfMob", value)} /></Field>
        <Field label="每周深度学习分钟"><input id="deep" type="number" value={form.deep} onChange={(event) => set("deep", event.target.value)} /></Field>
        <Field label="单次典型专注">
          <select id="span" value={form.span} onChange={(event) => set("span", event.target.value)}>
            <option value="">先不填</option>
            <option value="lt15">不到 15 分钟</option>
            <option value="m15">15–24 分钟</option>
            <option value="m25">25–44 分钟</option>
            <option value="m45">45–59 分钟</option>
            <option value="m60">60 分钟及以上</option>
          </select>
        </Field>
        <Field label="复习习惯">
          <select id="review" value={form.review} onChange={(event) => set("review", event.target.value)}>
            <option value="">先不填</option>
            <option value="none">几乎不复习</option>
            <option value="occasional">想起来才看</option>
            <option value="weekly">每周复习，没有间隔</option>
            <option value="spaced">大约 1 天和 7 天会回看</option>
            <option value="system">有间隔重复或错题回炉</option>
          </select>
        </Field>
        <Field label="输出习惯">
          <select id="output" value={form.output} onChange={(event) => set("output", event.target.value)}>
            <option value="">先不填</option>
            <option value="rare">很少能讲出来</option>
            <option value="notes">能写要点，讲给别人会卡</option>
            <option value="structure">不看笔记能讲清结构</option>
            <option value="example">能举例讲给不懂的人</option>
            <option value="regular">定期有输出，且持续超过 3 个月</option>
          </select>
        </Field>
        <button id="create-profile" className="primary" type="submit">开始记录</button>
      </form>
    </section>
  );
}

function Today({ current, record, commit }) {
  const ceremony = current.domains.filter((domain) => domain.promotedOn === todayKey());
  return (
    <section>
      <div className="card">
        <h2>今天</h2>
        <p className="hint">筛查带：{current.band.label}（BMI {current.band.bmi}）。这是身高体重的状态标签，不是能力，也不是评价。</p>
        <Field label="昨夜睡眠（小时）">
          <input
            id="sleep"
            type="number"
            min="0"
            max="14"
            step="0.1"
            value={record.sleep ?? ""}
            onChange={(event) => commit((next) => {
              const day = next.days[todayKey()];
              day.sleep = Number(event.target.value);
              if (!day.closed && !(day.skipped || []).length) day.quests = null;
            })}
          />
        </Field>
        <div className="row">
          <span className="tag">恢复 {current.recovery}</span>
          <button type="button" onClick={() => commit((next) => {
            const day = next.days[todayKey()];
            if (day.closed) return;
            day.rest = !day.rest;
            day.quests = null;
            day.skipped = [];
          })}>{record.rest ? "取消休息日" : "标成休息日"}</button>
          <button id="close-day" className="primary" type="button" onClick={() => commit((next) => {
            next.days[todayKey()].closed = true;
          })}>{record.closed ? "已收束" : "收束今天"}</button>
        </div>
      </div>
      {current.onVacation && <div className="warn">假期中。衰减计数暂停，训练任务也先停。</div>}
      {current.precautions.length > 0 && (
        <div className="card">
          <h2>注意事项</h2>
          <div className="warn">不是医疗建议，不会给出康复处方。</div>
          <ul>{current.precautions.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
      {ceremony.length > 0 && (
        <div className="card">
          {ceremony.map((domain) => <p key={domain.id}>{domain.name}进入开课。称号换成「{domain.title}」。</p>)}
        </div>
      )}
      <div className="card">
        <h2>{record.rest ? "休息日的三件事" : "今天的三件事"}</h2>
        {current.quests.map((quest) => (
          <div className={quest.done ? "quest done" : "quest"} key={quest.id}>
            <div>
              <strong>{quest.done ? `已完成 · ${quest.title}` : quest.title}</strong>
              <div className="hint">{quest.detail} 完成 +{quest.points} 积分</div>
            </div>
            {quest.done || quest.skipped
              ? <span className="hint">{quest.skipped ? "已跳过" : "已完成"}</span>
              : <button type="button" onClick={() => commit((next) => {
                const day = next.days[todayKey()];
                day.skipped = [...(day.skipped || []), quest.id];
              })}>跳过</button>}
          </div>
        ))}
        {current.quests.some((quest) => quest.kind === "confirm") && (
          <Field label="我看过注意事项">
            <input type="checkbox" checked={Boolean(record.confirmed)} onChange={(event) => commit((next) => { next.days[todayKey()].confirmed = event.target.checked; })} />
          </Field>
        )}
        {current.quests.some((quest) => quest.kind === "daylight") && (
          <Field label="日光下静坐完成">
            <input type="checkbox" checked={Boolean(record.daylight)} onChange={(event) => commit((next) => { next.days[todayKey()].daylight = event.target.checked; })} />
          </Field>
        )}
        {current.quests.some((quest) => quest.kind === "offscreen") && (
          <Field label="离开屏幕完成">
            <input type="checkbox" checked={Boolean(record.offscreen)} onChange={(event) => commit((next) => { next.days[todayKey()].offscreen = event.target.checked; })} />
          </Field>
        )}
        {current.quests.some((quest) => quest.kind === "review" || quest.kind === "sleep") && (
          <Field label="今晚睡眠意向或三行回顾">
            <textarea
              id="note"
              value={record.reviewText || ""}
              onChange={(event) => commit((next) => {
                const day = next.days[todayKey()];
                day.sleepIntention = event.target.value;
                day.reviewText = event.target.value;
              })}
            />
          </Field>
        )}
      </div>
    </section>
  );
}

function Log({ state, onSave }) {
  const domains = state.domains.filter((domain) => !domain.disabledOn);
  const [form, setForm] = useState({ kind: "strength", domainId: "", bucket: "input", minutes: "20", quality: "3", pain: "0", note: "", injury: false });
  const [error, setError] = useState("");
  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function save(event) {
    event.preventDefault();
    const raw = Number(form.minutes);
    const quality = Number(form.quality);
    if (!raw || raw < 1) return;
    if (quality === 5 && !form.note.trim()) {
      setError("质量 5 需要写下证据或组数。");
      return;
    }
    onSave({
      id: `s${Date.now().toString(36)}`,
      date: todayKey(),
      order: state.sessions.length + 1,
      kind: form.kind,
      domainId: form.kind === "study" ? form.domainId || null : null,
      bucket: form.kind === "study" ? form.bucket : null,
      raw,
      quality,
      note: form.note,
      pain: Number(form.pain) || 0,
      injuryRelevant: form.injury,
    });
  }
  return (
    <section>
      <form className="card" id="log-form" onSubmit={save}>
        <h2>记一笔</h2>
        <Field label="种类">
          <select id="kind" value={form.kind} onChange={(event) => set("kind", event.target.value)}>
            <option value="strength">力量</option>
            <option value="cardio">有氧</option>
            <option value="walk">平地步行</option>
            <option value="mobility">灵活</option>
            <option value="study">学习</option>
          </select>
        </Field>
        <Field label="科目（学习时）">
          <select id="domain" value={form.domainId} onChange={(event) => set("domainId", event.target.value)}>
            <option value="">不指定</option>
            {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
          </select>
        </Field>
        <Field label="学习方式">
          <select id="bucket" value={form.bucket} onChange={(event) => set("bucket", event.target.value)}>
            <option value="input">输入</option>
            <option value="retrieval">提取</option>
            <option value="output">输出</option>
          </select>
        </Field>
        <Field label="分钟"><input id="minutes" type="number" min="1" max="300" value={form.minutes} onChange={(event) => set("minutes", event.target.value)} /></Field>
        <Field label="质量 1–5"><input id="quality" type="number" min="1" max="5" value={form.quality} onChange={(event) => set("quality", event.target.value)} /></Field>
        <Field label="疼痛 0–10"><input id="pain" type="number" min="0" max="10" value={form.pain} onChange={(event) => set("pain", event.target.value)} /></Field>
        <Field label="证据或组数（质量 5 必填）"><input id="note" type="text" value={form.note} onChange={(event) => set("note", event.target.value)} /></Field>
        <Field label="这次顶着已标记的伤病做的">
          <input id="injury" type="checkbox" checked={form.injury} onChange={(event) => set("injury", event.target.checked)} />
        </Field>
        <p className="hint">同一学习分钟只进一个方式。超时的部分会记下来，但不再增加属性。</p>
        {error && <p className="warn">{error}</p>}
        <button id="save-log" className="primary" type="submit">保存这条记录</button>
      </form>
    </section>
  );
}

function Panel({ current }) {
  const domains = current.domains.filter((domain) => !domain.disabledOn);
  return (
    <section>
      <div className="card">
        <h2>人物面板</h2>
        <div className="grid">
          {ATTRS.map(([key, label]) => (
            <div className="stat" key={key}><span>{label}</span><strong>{current.attributes[key].toFixed(1)}</strong></div>
          ))}
          <div className="stat"><span>恢复</span><strong>{current.recovery}</strong></div>
        </div>
        <p className="hint">积分 {current.points} · 等级 {current.level} · 经验 {current.xp} · 体能储备 {current.fit} · 学习吞吐 {current.ltp}</p>
      </div>
      <div className="card">
        <h2>科目进度</h2>
        {domains.length === 0 && <p className="hint">还没有科目。到「科目」里自己添加。</p>}
        {domains.map((domain) => (
          <p key={domain.id}>
            {domain.name} {domain.value.toFixed(1)} · {domain.rank ? `阶 ${domain.rank} · ${domain.title}` : `未开课，近 7 天还差 ${domain.remaining} 天`}
            {domain.badge ? ` · 徽章 ${domain.badge}` : ""}
          </p>
        ))}
      </div>
    </section>
  );
}

function Subjects({ state, current, commit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <section>
      <div className="card">
        <h2>学习科目</h2>
        <p className="hint">没有预置清单。自己添加，自己停用。同时作为重点的最多 5 门。</p>
        {state.domains.map((domain) => {
          const live = current.domains.find((item) => item.id === domain.id);
          return (
            <div className="quest" key={domain.id}>
              <div>
                <strong>{domain.disabledOn ? `${domain.name}（已停用）` : domain.name}</strong>
                <div className="hint">{domain.focus ? "重点" : "已记录，不进今日轮换"}{live?.title ? ` · ${live.title}` : ""}</div>
              </div>
              <button className="ghost danger" type="button" onClick={() => commit((next) => {
                setDomainDisabled(next, domain.id, todayKey(), !domain.disabledOn);
                const day = next.days[todayKey()];
                if (day && !day.closed) day.quests = null;
              })}>{domain.disabledOn ? "重新启用" : "停用"}</button>
            </div>
          );
        })}
        <Field label="新科目">
          <input id="subject-name" type="text" placeholder="例如：会计、编程、英语" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <button id="add-subject" className="primary" type="button" onClick={() => {
          const preview = addDomain(structuredClone(state), name);
          if (!preview.ok) {
            setError(preview.error);
            return;
          }
          setError("");
          setName("");
          commit((next) => {
            addDomain(next, name);
            const day = next.days[todayKey()];
            if (day && !day.closed) day.quests = null;
          });
        }}>添加</button>
        {error && <p className="warn">{error}</p>}
        {!canFocusAnother(state) && <p className="hint">重点已有 5 门。新科目仍可添加，但先不进入任务轮换，除非停用一门。</p>}
      </div>
    </section>
  );
}

function Body({ state, current, record, commit }) {
  const [region, setRegion] = useState("knee");
  const [note, setNote] = useState("");
  const [avoid, setAvoid] = useState("");
  const activeVacation = state.profile.vacationStart && (!state.profile.vacationEnd || state.profile.vacationEnd >= todayKey());
  return (
    <section>
      <div className="card">
        <h2>身体情况</h2>
        <div className="warn">伤病只用来过滤任务。这里不是医疗建议，也不安排康复动作。</div>
        <p>身高 {state.profile.heightCm} cm · 体重 {state.profile.weightKg} kg · {current.band.label}</p>
        {state.injuries.filter((injury) => injury.active).map((injury) => {
          const label = REGIONS.find((item) => item[0] === injury.region)?.[1] || injury.region;
          return (
            <div className="quest" key={injury.id}>
              <div>
                <strong>{label} · {injury.note || "未写原话"}</strong>
                <div className="hint">{injury.avoidNote}</div>
              </div>
              <button type="button" onClick={() => commit((next) => {
                const found = next.injuries.find((item) => item.id === injury.id);
                if (found) found.active = false;
                const day = next.days[todayKey()];
                if (day) day.quests = null;
              })}>解除标记</button>
            </div>
          );
        })}
        <Field label="部位">
          <select id="region" value={region} onChange={(event) => setRegion(event.target.value)}>
            {REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="你的原话"><input id="injury-note" type="text" placeholder="例如：下楼会不适" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <Field label="还不要生成的活动"><input id="avoid-note" type="text" value={avoid} onChange={(event) => setAvoid(event.target.value)} /></Field>
        <button className="primary" type="button" onClick={() => {
          const injury = { id: `i${Date.now().toString(36)}`, region, note: note.trim(), avoidNote: avoid.trim(), active: true };
          setNote("");
          setAvoid("");
          commit((next) => {
            next.injuries.push(injury);
            const day = next.days[todayKey()];
            if (day) day.quests = null;
          });
        }}>添加伤病标记</button>
        <Field label="今天疼痛（0–10，有标记时填写）">
          <input id="pain-max" type="number" min="0" max="10" value={record.painMax ?? 0} onChange={(event) => commit((next) => {
            const day = next.days[todayKey()];
            day.painMax = Number(event.target.value);
            day.quests = null;
          })} />
        </Field>
        <Field label="今天可以平地步行">
          <input id="walk-ok" type="checkbox" checked={Boolean(record.walkOk)} onChange={(event) => commit((next) => {
            const day = next.days[todayKey()];
            day.walkOk = event.target.checked;
            day.quests = null;
          })} />
        </Field>
        <div className="row">
          <button type="button" onClick={() => commit((next) => {
            if (activeVacation) {
              const yesterday = addDays(todayKey(), -1);
              if (yesterday < next.profile.vacationStart) {
                next.profile.vacationStart = null;
                next.profile.vacationEnd = null;
              } else next.profile.vacationEnd = yesterday;
            } else {
              next.profile.vacationStart = todayKey();
              next.profile.vacationEnd = null;
            }
            const day = next.days[todayKey()];
            if (day) day.quests = null;
          })}>{activeVacation ? "结束假期" : "开始假期（最多 14 天）"}</button>
        </div>
      </div>
    </section>
  );
}

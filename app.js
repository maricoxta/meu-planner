import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://lplvhzuaineeqvzszgjd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbHZoenVhaW5lZXF2enN6Z2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjE1NTcsImV4cCI6MjA3MTg5NzU1N30.cMdqpURqHUBEGfPb--pxo3ljN4z8-6UNvBEB5YhYXno";
const TOKEN_FN = "planner-google-token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");
const GCAL = "https://www.googleapis.com/calendar/v3";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { db: { schema: "planner" } });

const CATS = {
  estudos: { label: "Estudos", color: "var(--c-estudos)", gcolor: "9" },
  trabalho: { label: "Trabalho", color: "var(--c-trabalho)", gcolor: "7" },
  financeiro: { label: "Financeiro", color: "var(--c-financeiro)", gcolor: "2" },
  pessoal: { label: "Pessoal", color: "var(--c-pessoal)", gcolor: "10" },
  saude: { label: "Saúde", color: "var(--c-saude)", gcolor: "4" },
};
const PRIOS = { 1: "Alta", 2: "Média", 3: "Baixa" };
const REMINDERS = [[0, "Na hora"], [5, "5 min antes"], [10, "10 min antes"], [15, "15 min antes"], [30, "30 min antes"], [60, "1 h antes"], [120, "2 h antes"], [1440, "1 dia antes"]];
const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DAY_START = 6, DAY_END = 24;

// ---------------------------------------------------------------------------
// Tiny DOM helper (always textContent: nothing user-provided becomes markup)
// ---------------------------------------------------------------------------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const ICONS = {
  hoje: "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  semana: "M4 6h16M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6M4 6V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1M9 10v8m6-8v8",
  mes: "M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h2m3 0h2m-7 4h2m3 0h2",
  tarefas: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  habitos: "M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z",
  metas: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  revisao: "M4 19V9m6 10V5m6 14v-7m4 7H2",
};
function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ICONS[name]); s.append(p);
  return s;
}
function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---------------------------------------------------------------------------
// Dates (always local time)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d) => { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const todayStr = () => ymd(new Date());
const fmtDay = (d) => `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
const fmtShort = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const S = {
  session: null,
  view: ls.get("planner.view", "hoje"),
  cursor: new Date(), // week/month anchor
  tasks: [], habits: [], logs: [], goals: [], reviews: [],
  calendars: [], hiddenCals: new Set(ls.get("planner.hiddenCals", [])),
  gevents: new Map(), // key range -> events
  gStatus: "unknown", // ok | needs_reauth | not_configured | error
  taskFilter: ls.get("planner.taskFilter", { cat: "all", showDone: false }),
  me: null,          // id da pessoa logada
  viewing: null,     // linha de shares quando estou vendo o planner de outra pessoa
  shares: [],        // compartilhamentos meus e comigo
  theme: ls.get("planner.theme", "flores"),
};

// ---------------------------------------------------------------------------
// Tema (flores | azul) e compartilhamento
// ---------------------------------------------------------------------------
const iconSrc = () => (S.theme === "azul" ? "/icon-azul.svg" : "/icon.svg");
function applyTheme(t) {
  S.theme = t === "azul" ? "azul" : "flores";
  ls.set("planner.theme", S.theme);
  const link = document.getElementById("theme-css");
  if (link) link.href = S.theme === "azul" ? "/azul.css" : "/styles.css";
  const fav = document.querySelector('link[rel="icon"]');
  if (fav) fav.href = iconSrc();
}
async function loadProfile() {
  const { data, error } = await sb.from("profiles").select("theme").eq("user_id", S.me).maybeSingle();
  if (error) return;
  if (data) return applyTheme(data.theme);
  await sb.from("profiles").insert({ theme: "azul" }); // novas pessoas começam no tema azul
  applyTheme("azul");
}
async function setTheme(t) {
  applyTheme(t); render();
  const { error } = await sb.from("profiles").upsert({ user_id: S.me, theme: S.theme, updated_at: new Date().toISOString() });
  if (error) toast("Não consegui salvar o tema: " + error.message);
}
async function loadShares() {
  const { data, error } = await sb.from("shares").select("*").order("created_at");
  S.shares = error ? [] : data;
}
const myShares = () => S.shares.filter((x) => x.owner_id === S.me);
const sharedWithMe = () => {
  const seen = new Set();
  return S.shares.filter((x) => x.owner_id !== S.me && !seen.has(x.owner_id) && seen.add(x.owner_id));
};
const ownerLabel = (x) => x.owner_name || x.owner_email;
const firstName = (x) => String(x).split(/[\s@]/)[0];
const RO = () => !!S.viewing;
function roBlock() {
  if (!S.viewing) return false;
  toast(`Você está vendo o planner de ${firstName(ownerLabel(S.viewing))}: só leitura.`);
  return true;
}
async function viewPlanner(ownerId) {
  S.viewing = ownerId && ownerId !== S.me ? sharedWithMe().find((x) => x.owner_id === ownerId) || null : null;
  S.gevents.clear();
  try { await loadAll(); } catch (e) { toast("Erro ao carregar: " + e.message); }
  render(); window.scrollTo(0, 0);
}
let gToken = null, gTokenExp = 0;

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------
async function fnError(error) {
  try { const j = await error.context.json(); return j.error || "error"; } catch { return "error"; }
}
async function googleToken() {
  if (gToken && Date.now() < gTokenExp - 60_000) return gToken;
  const { data, error } = await sb.functions.invoke(TOKEN_FN, { body: { action: "access" } });
  if (error) {
    const code = await fnError(error);
    S.gStatus = code === "needs_reauth" ? "needs_reauth" : code === "server_not_configured" ? "not_configured" : "error";
    throw new Error(code);
  }
  gToken = data.access_token; gTokenExp = Date.now() + data.expires_in * 1000; S.gStatus = "ok";
  return gToken;
}
async function gfetch(path, opts = {}) {
  const tok = await googleToken();
  const r = await fetch(GCAL + path, { ...opts, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (r.status === 401) { gToken = null; S.gStatus = "needs_reauth"; throw new Error("needs_reauth"); }
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `google_${r.status}`);
  return j;
}
async function loadCalendars() {
  try {
    const j = await gfetch("/users/me/calendarList?minAccessRole=reader&maxResults=100");
    S.calendars = (j.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor || "#64748b", primary: !!c.primary }));
  } catch { S.calendars = []; }
}
async function eventsFor(from, to) {
  const key = `${S.viewing?.owner_id || "eu"}_${ymd(from)}_${ymd(to)}`;
  if (S.gevents.has(key)) return S.gevents.get(key);
  if (S.gStatus !== "ok" && S.gStatus !== "unknown") return [];
  const cals = S.viewing
    ? S.calendars.filter((c) => c.id.toLowerCase() === S.viewing.owner_email.toLowerCase())
    : S.calendars.filter((c) => !S.hiddenCals.has(c.id));
  const qs = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "500" });
  const all = [];
  await Promise.all(cals.map(async (c) => {
    try {
      const j = await gfetch(`/calendars/${encodeURIComponent(c.id)}/events?${qs}`);
      for (const e of j.items || []) {
        if (e.status === "cancelled") continue;
        if (e.extendedProperties?.private?.plannerTaskId) continue; // a própria tarefa já aparece
        const allDay = !!e.start?.date;
        const start = allDay ? parseYmd(e.start.date) : new Date(e.start.dateTime);
        const end = allDay ? parseYmd(e.end.date) : new Date(e.end.dateTime);
        all.push({ kind: "event", id: e.id, title: e.summary || "(sem título)", start, end, allDay, color: c.color, cal: c.name, link: e.htmlLink, location: e.location, desc: e.description });
      }
    } catch { /* calendário indisponível */ }
  }));
  all.sort((a, b) => a.start - b.start);
  S.gevents.set(key, all);
  return all;
}
function taskEventBody(t) {
  const start = new Date(t.start_at);
  const end = new Date(start.getTime() + (t.duration_min || 30) * 60000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    summary: (t.status === "done" ? "✓ " : "") + t.title,
    description: [t.notes || "", "", `Planner · ${CATS[t.category].label} · prioridade ${PRIOS[t.priority].toLowerCase()}`].join("\n").trim(),
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    colorId: CATS[t.category].gcolor,
    reminders: t.reminder_min == null ? { useDefault: true } : { useDefault: false, overrides: [{ method: "popup", minutes: t.reminder_min }] },
    extendedProperties: { private: { plannerTaskId: t.id } },
  };
}
// Sincroniza uma tarefa com o Google Agenda: cria/atualiza/remove o evento.
async function syncTask(t) {
  if (S.gStatus !== "ok") return t;
  try {
    if (t.start_at && !t.parent_id) {
      if (t.gcal_event_id) {
        try {
          await gfetch(`/calendars/primary/events/${encodeURIComponent(t.gcal_event_id)}`, { method: "PATCH", body: JSON.stringify(taskEventBody(t)) });
          return t;
        } catch (e) { if (!/404|410|Not Found|deleted/i.test(e.message)) throw e; }
      }
      const ev = await gfetch("/calendars/primary/events", { method: "POST", body: JSON.stringify(taskEventBody(t)) });
      await sb.from("tasks").update({ gcal_event_id: ev.id }).eq("id", t.id);
      t.gcal_event_id = ev.id;
    } else if (t.gcal_event_id) {
      await deleteEvent(t.gcal_event_id);
      await sb.from("tasks").update({ gcal_event_id: null }).eq("id", t.id);
      t.gcal_event_id = null;
    }
  } catch (e) { toast("Não consegui sincronizar com o Google Agenda: " + e.message); }
  return t;
}
async function deleteEvent(id) {
  try { await gfetch(`/calendars/primary/events/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (e) { if (!/404|410|deleted|Not Found/i.test(e.message)) throw e; }
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function loadAll() {
  const since = ymd(addDays(new Date(), -120));
  const uid = S.viewing ? S.viewing.owner_id : S.me;
  const [t, hb, lg, g, rv] = await Promise.all([
    sb.from("tasks").select("*").eq("user_id", uid).order("created_at").limit(5000),
    sb.from("habits").select("*").eq("user_id", uid).eq("archived", false).order("created_at"),
    sb.from("habit_logs").select("habit_id,day").eq("user_id", uid).gte("day", since),
    sb.from("goals").select("*").eq("user_id", uid).order("created_at"),
    sb.from("reviews").select("*").eq("user_id", uid).order("week_start", { ascending: false }),
  ]);
  const err = [t, hb, lg, g, rv].find((r) => r.error);
  if (err) throw err.error;
  S.tasks = t.data; S.habits = hb.data; S.logs = lg.data; S.goals = g.data; S.reviews = rv.data;
}
const topTasks = () => S.tasks.filter((t) => !t.parent_id);
const subsOf = (id) => S.tasks.filter((t) => t.parent_id === id);
const taskDay = (t) => (t.start_at ? ymd(new Date(t.start_at)) : t.due_date);
function itemsForDay(dayStr, events) {
  const tasks = topTasks().filter((t) => taskDay(t) === dayStr).map((t) => ({
    kind: "task", task: t, title: t.title, allDay: !t.start_at,
    start: t.start_at ? new Date(t.start_at) : parseYmd(dayStr),
    end: t.start_at ? new Date(new Date(t.start_at).getTime() + (t.duration_min || 30) * 60000) : addDays(parseYmd(dayStr), 1),
    color: CATS[t.category].color, done: t.status === "done",
  }));
  const day = parseYmd(dayStr), next = addDays(day, 1);
  const evs = events.filter((e) => e.start < next && e.end > day);
  return [...evs, ...tasks].sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
}

async function saveTask(input, subs) {
  const isNew = !input.id;
  const row = { ...input };
  if (row.status === "done" && !row.done_at) row.done_at = new Date().toISOString();
  if (row.status === "todo") row.done_at = null;
  const q = isNew ? sb.from("tasks").insert(row).select().single() : sb.from("tasks").update(row).eq("id", row.id).select().single();
  const { data, error } = await q;
  if (error) { toast("Erro ao salvar: " + error.message); return null; }
  if (subs) {
    const existing = subsOf(data.id);
    const keepIds = new Set(subs.filter((s) => s.id).map((s) => s.id));
    const del = existing.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
    if (del.length) await sb.from("tasks").delete().in("id", del);
    for (const s of subs) {
      if (!s.title.trim()) continue;
      if (s.id) await sb.from("tasks").update({ title: s.title.trim() }).eq("id", s.id);
      else await sb.from("tasks").insert({ title: s.title.trim(), parent_id: data.id, category: data.category, priority: data.priority });
    }
  }
  await syncTask(data);
  S.gevents.clear();
  await loadAll();
  return data;
}
async function toggleTask(t) {
  if (roBlock()) return;
  const status = t.status === "done" ? "todo" : "done";
  const patch = { status, done_at: status === "done" ? new Date().toISOString() : null };
  Object.assign(t, patch); render();
  const { error } = await sb.from("tasks").update(patch).eq("id", t.id);
  if (error) { toast("Erro: " + error.message); await loadAll(); return render(); }
  if (t.gcal_event_id) syncTask(t);
}
async function deleteTask(t) {
  if (t.gcal_event_id) { try { await deleteEvent(t.gcal_event_id); } catch { /* segue */ } }
  const { error } = await sb.from("tasks").delete().eq("id", t.id);
  if (error) return toast("Erro: " + error.message);
  S.gevents.clear(); await loadAll();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function signIn() {
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: GOOGLE_SCOPES,
      redirectTo: location.origin + "/",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}
async function onSession(session) {
  S.session = session;
  if (!session) return renderLogin();
  S.me = session.user.id;
  // Logo após o login o Supabase entrega os tokens do Google uma única vez: guardamos o refresh token no servidor.
  if (session.provider_refresh_token) {
    const { error } = await sb.functions.invoke(TOKEN_FN, { body: { action: "store", refresh_token: session.provider_refresh_token } });
    if (error) toast("Não consegui guardar o acesso ao Google: " + (await fnError(error)));
  }
  if (session.provider_token) { gToken = session.provider_token; gTokenExp = Date.now() + 55 * 60000; S.gStatus = "ok"; }
  try { await Promise.all([loadProfile(), loadShares()]); } catch { /* segue com o padrão */ }
  try { await loadAll(); }
  catch (e) { return renderFatal(e); }
  try { await googleToken(); await loadCalendars(); } catch { /* banner explica */ }
  render();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const app = document.getElementById("app");
const NAV = [["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["tarefas", "Tarefas"], ["habitos", "Hábitos"], ["metas", "Metas"], ["revisao", "Revisão"]];
const MOBILE_NAV = ["hoje", "semana", "mes", "tarefas", "mais"];

function renderLogin() {
  app.replaceChildren(h("div", { class: "login" }, h("div", { class: "card" },
    h("img", { src: iconSrc(), alt: "" }),
    h("h1", null, "Meu Planner"),
    h("p", null, "Tarefas, hábitos, metas e o seu Google Agenda num lugar só."),
    h("button", { class: "btn primary", onclick: signIn }, "Entrar com Google"),
  )));
}
function renderFatal(e) {
  const msg = String(e?.message || e);
  const hint = /schema|planner|PGRST106|Invalid schema/i.test(msg)
    ? "O schema \"planner\" ainda não está exposto na API do Supabase (Settings → API → Exposed schemas)." : "";
  app.replaceChildren(h("div", { class: "login" }, h("div", { class: "card" },
    h("h1", null, "Algo deu errado"), h("p", null, hint || msg),
    h("button", { class: "btn", onclick: () => location.reload() }, "Tentar de novo"),
  )));
}
function setView(v) { S.view = v; ls.set("planner.view", v); render(); window.scrollTo(0, 0); }

function navButtons(list, mobile) {
  return list.map((v) => {
    if (v === "mais") {
      const on = ["habitos", "metas", "revisao"].includes(S.view);
      return h("button", { class: "nav-btn" + (on ? " active" : ""), onclick: openMoreMenu }, icon("revisao"), "Mais");
    }
    const [key, label] = NAV.find((n) => n[0] === v);
    return h("button", { class: "nav-btn" + (S.view === key ? " active" : ""), onclick: () => setView(key) }, icon(key), label);
  });
}
function openMoreMenu() {
  const close = openModal("Mais", (m) => [
    ...[["habitos", "Hábitos"], ["metas", "Metas do mês"], ["revisao", "Revisão semanal"]].map(([k, l]) =>
      h("button", { class: "nav-btn" + (S.view === k ? " active" : ""), onclick: () => { close(); setView(k); } }, icon(k), l)),
    whoPicker() ? [h("div", { class: "section-label" }, "Planner"), whoPicker()] : null,
    h("div", { class: "section-label" }, "Tema"), themeToggle(),
    h("div", { class: "section-label" }, "Agendas do Google"),
    calendarPicker(() => close()),
    h("div", { class: "actions" },
      h("button", { class: "btn", onclick: () => { close(); openShare(); } }, "👥 Compartilhar"),
      h("button", { class: "btn", onclick: signOut }, "Sair")),
  ]);
}

let renderSeq = 0;
async function render() {
  if (!S.session) return;
  const seq = ++renderSeq;
  const main = h("main", { class: "main" });
  const views = { hoje: viewToday, semana: viewWeek, mes: viewMonth, tarefas: viewTasks, habitos: viewHabits, metas: viewGoals, revisao: viewReview };
  const content = await (views[S.view] || viewToday)();
  if (seq !== renderSeq) return; // render mais novo já começou
  main.append(...[viewingBanner(), googleBanner(), content].filter(Boolean));
  const scrollY = window.scrollY;
  const weekScroll = document.querySelector(".week")?.scrollTop;
  app.replaceChildren(h("div", { class: "shell" },
    h("aside", { class: "side" },
      h("div", { class: "brand" }, h("img", { src: iconSrc(), alt: "" }), "Meu Planner"),
      whoPicker(),
      navButtons(NAV.map((n) => n[0])),
      h("div", { class: "side-foot" },
        themeToggle(),
        h("button", { class: "btn sm", onclick: openShare }, "👥 Compartilhar meu planner"),
        S.calendars.length ? h("details", null, h("summary", null, "Agendas do Google"), calendarPicker()) : null,
        h("span", null, S.session.user.email),
        h("button", { class: "btn sm", onclick: signOut }, "Sair")),
    ),
    main,
    h("nav", { class: "bottom-nav" }, navButtons(MOBILE_NAV, true)),
    RO() ? null : h("button", { class: "fab", title: "Nova tarefa", "aria-label": "Nova tarefa", onclick: () => openTask({}) }, "+"),
  ));
  window.scrollTo(0, scrollY);
  const wk = document.querySelector(".week");
  if (wk) wk.scrollTop = weekScroll ?? (Math.max(0, new Date().getHours() - DAY_START - 1) * 48);
}
function googleBanner() {
  if (S.gStatus === "ok" || S.gStatus === "unknown") return null;
  const text = {
    needs_reauth: "Seu Google Agenda está desconectado. Entre de novo para ver suas aulas e receber lembretes.",
    not_configured: "A integração com o Google ainda não foi configurada no servidor (segredos GOOGLE_CLIENT_ID/SECRET).",
    error: "Não consegui falar com o Google Agenda agora.",
  }[S.gStatus];
  return h("div", { class: "banner warn" }, h("span", { style: { flex: 1 } }, text),
    S.gStatus === "needs_reauth" ? h("button", { class: "btn sm primary", onclick: signIn }, "Reconectar") : null);
}
function calendarPicker(after) {
  return h("div", { class: "cal-list" }, S.calendars.map((c) => h("label", null,
    h("input", { type: "checkbox", checked: !S.hiddenCals.has(c.id), onchange: (e) => {
      if (e.target.checked) S.hiddenCals.delete(c.id); else S.hiddenCals.add(c.id);
      ls.set("planner.hiddenCals", [...S.hiddenCals]); S.gevents.clear(); render(); after?.();
    } }),
    h("span", { class: "dot", style: { background: c.color } }), c.name)));
}
async function signOut() { await sb.auth.signOut(); gToken = null; location.reload(); }

// ----- shared pieces -------------------------------------------------------
function catTag(cat) { return h("span", { class: "tag" }, h("span", { class: "dot", style: { background: CATS[cat].color } }), CATS[cat].label); }
function taskRow(t, opts = {}) {
  const subs = subsOf(t.id);
  const doneSubs = subs.filter((s) => s.status === "done").length;
  const late = t.status !== "done" && taskDay(t) && taskDay(t) < todayStr();
  const meta = [
    catTag(t.category),
    t.priority === 1 ? h("span", { class: "prio-1" }, "Alta") : null,
    !opts.hideDate && taskDay(t) ? h("span", { style: late ? { color: "var(--danger)" } : null }, fmtShort(parseYmd(taskDay(t))) + (t.start_at ? " " + hm(new Date(t.start_at)) : "")) : null,
    opts.showTime && t.start_at ? h("span", null, hm(new Date(t.start_at))) : null,
    subs.length ? h("span", null, `${doneSubs}/${subs.length} subtarefas`) : null,
    t.gcal_event_id ? h("span", { title: "No Google Agenda" }, "📅") : null,
    t.is_top3 && !opts.hideTop ? h("span", null, "⭐") : null,
  ];
  return h("div", null,
    h("div", { class: "item" + (t.status === "done" ? " done" : "") },
      h("button", { class: "check" + (t.status === "done" ? " on" : ""), "aria-label": "Concluir", onclick: () => toggleTask(t) }),
      h("div", { class: "body", onclick: () => openTask(t) }, h("div", { class: "title" }, t.title), h("div", { class: "meta" }, meta)),
    ),
    opts.showSubs && subs.length && t.status !== "done" ? h("div", { class: "subs" }, subs.map((s) =>
      h("div", { class: "item" + (s.status === "done" ? " done" : "") },
        h("button", { class: "check" + (s.status === "done" ? " on" : ""), "aria-label": "Concluir subtarefa", onclick: () => toggleTask(s) }),
        h("div", { class: "body" }, h("div", { class: "title" }, s.title))))) : null,
  );
}
function periodNav(label, onPrev, onNext, onToday) {
  return [
    h("div", { class: "seg" },
      h("button", { onclick: onPrev, "aria-label": "Anterior" }, "‹"),
      h("button", { onclick: onToday }, "Hoje"),
      h("button", { onclick: onNext, "aria-label": "Próximo" }, "›")),
    h("h1", null, label),
  ];
}

// ----- Hoje ----------------------------------------------------------------
async function viewToday() {
  const today = startOfDay(new Date()), tStr = ymd(today);
  const events = await eventsFor(today, addDays(today, 1));
  const items = itemsForDay(tStr, events);
  const timed = items.filter((i) => !i.allDay);
  const allDay = items.filter((i) => i.allDay && i.kind === "event");
  const tops = topTasks().filter((t) => t.is_top3 && (t.status !== "done" || (t.done_at && ymd(new Date(t.done_at)) === tStr)));
  const dueToday = topTasks().filter((t) => taskDay(t) === tStr && !t.start_at);
  const overdue = topTasks().filter((t) => t.status !== "done" && taskDay(t) && taskDay(t) < tStr);
  const doneToday = S.tasks.filter((t) => t.done_at && ymd(new Date(t.done_at)) === tStr).length;
  const todays = topTasks().filter((t) => taskDay(t) === tStr);
  const pct = todays.length ? Math.round((todays.filter((t) => t.status === "done").length / todays.length) * 100) : 0;
  const habitsDone = S.habits.filter((hb) => S.logs.some((l) => l.habit_id === hb.id && l.day === tStr)).length;

  const agenda = h("div", { class: "card" }, h("h2", null, "Agenda de hoje", h("span", { class: "count" }, timed.length || "")),
    allDay.map((e) => h("div", { class: "item" }, h("div", { class: "time-col" }, "dia todo"), h("div", { class: "body", onclick: () => openEvent(e) }, h("div", { class: "title" }, e.title), h("div", { class: "meta" }, h("span", { class: "tag" }, h("span", { class: "dot", style: { background: e.color } }), e.cal))))),
    timed.length ? timed.map((i) => i.kind === "event"
      ? h("div", { class: "item" + (i.end < new Date() ? " done" : "") }, h("div", { class: "time-col" }, hm(i.start)),
        h("div", { class: "body", onclick: () => openEvent(i) }, h("div", { class: "title" }, i.title),
          h("div", { class: "meta" }, h("span", { class: "tag" }, h("span", { class: "dot", style: { background: i.color } }), i.cal), h("span", null, `até ${hm(i.end)}`))))
      : h("div", { class: "item" + (i.done ? " done" : "") }, h("div", { class: "time-col" }, hm(i.start)),
        h("button", { class: "check" + (i.done ? " on" : ""), onclick: () => toggleTask(i.task) }),
        h("div", { class: "body", onclick: () => openTask(i.task) }, h("div", { class: "title" }, i.title), h("div", { class: "meta" }, catTag(i.task.category), h("span", null, `${i.task.duration_min || 30} min`)))))
      : h("div", { class: "empty" }, "Nenhum compromisso com horário hoje."));

  const top3 = h("div", { class: "card" }, h("h2", null, "⭐ Top 3 prioridades"),
    tops.length ? tops.slice(0, 3).map((t) => taskRow(t, { hideTop: true, showSubs: true })) : h("div", { class: "empty" }, "Marque até 3 tarefas como prioridade do dia (estrela, no editor da tarefa)."),
    tops.length > 3 ? h("div", { class: "empty" }, `+${tops.length - 3} marcadas: foque nas 3 primeiras.`) : null);

  const todo = h("div", { class: "card" }, h("h2", null, "Tarefas do dia"),
    overdue.length ? [h("div", { class: "section-label late" }, `Atrasadas (${overdue.length})`), overdue.map((t) => taskRow(t))] : null,
    h("div", { class: "section-label" }, "Para hoje"),
    dueToday.length ? dueToday.map((t) => taskRow(t, { hideDate: true, showSubs: true })) : h("div", { class: "empty" }, "Nada com prazo para hoje."),
    h("div", { style: { marginTop: "10px" } }, h("button", { class: "btn sm", onclick: () => openTask({ due_date: tStr }) }, "+ Tarefa para hoje")));

  const habits = h("div", { class: "card" }, h("h2", null, "Hábitos de hoje", h("span", { class: "count" }, `${habitsDone}/${S.habits.length}`)),
    S.habits.length ? S.habits.map((hb) => {
      const on = S.logs.some((l) => l.habit_id === hb.id && l.day === tStr);
      return h("div", { class: "item" + (on ? " done" : "") }, h("button", { class: "check" + (on ? " on" : ""), onclick: () => toggleHabit(hb, tStr) }),
        h("div", { class: "body" }, h("div", { class: "title" }, hb.name), h("div", { class: "meta" }, catTag(hb.category), h("span", { title: "Dias seguidos sem falhar, contando até hoje" }, streakLabel(streak(hb))))));
    }) : h("div", { class: "empty" }, "Crie hábitos na aba Hábitos."));

  return h("div", null,
    h("div", { class: "head" }, h("div", null, h("h1", null, greeting()), h("div", { class: "sub" }, fmtDay(today)))),
    h("div", { class: "stats" },
      stat(`${pct}%`, "do dia concluído"), stat(doneToday, "tarefas feitas hoje"),
      stat(overdue.length, "atrasadas"), stat(`${habitsDone}/${S.habits.length}`, "hábitos")),
    h("div", { class: "grid two" }, h("div", { class: "grid" }, agenda, todo), h("div", { class: "grid" }, top3, habits)));
}
function greeting() { const hr = new Date().getHours(); return hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite"; }
function stat(v, l) { return h("div", { class: "stat" }, h("div", { class: "v" }, v), h("div", { class: "l" }, l)); }

// ----- Semana --------------------------------------------------------------
async function viewWeek() {
  const ws = startOfWeek(S.cursor), we = addDays(ws, 7);
  const events = await eventsFor(ws, we);
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const tStr = todayStr();
  const label = `${ws.getDate()} ${MONTHS[ws.getMonth()].slice(0, 3)} – ${addDays(we, -1).getDate()} ${MONTHS[addDays(we, -1).getMonth()].slice(0, 3)} ${addDays(we, -1).getFullYear()}`;
  const H = 48;

  const head = h("div", { class: "week-head" }, h("div"), days.map((d, i) => h("div", { class: ymd(d) === tStr ? "today" : "" }, DOW[i], h("b", null, d.getDate()))));
  const allday = h("div", { class: "week-allday" }, h("div", null, "dia todo"), days.map((d) => {
    const its = itemsForDay(ymd(d), events).filter((i) => i.allDay);
    return h("div", { onclick: (e) => { if (e.target === e.currentTarget) openTask({ due_date: ymd(d) }); } }, its.map((i) => chip(i)));
  }));
  const hours = h("div", { class: "hours" }, [...Array(DAY_END - DAY_START)].map((_, i) => h("div", null, i === 0 ? "" : `${DAY_START + i}h`)));
  const cols = days.map((d) => {
    const dStr = ymd(d);
    const its = itemsForDay(dStr, events).filter((i) => !i.allDay);
    const col = h("div", { class: "col" + (dStr === tStr ? " today" : ""), style: { height: `${(DAY_END - DAY_START) * H}px` } });
    col.addEventListener("click", (e) => {
      if (e.target !== col) return;
      const y = e.offsetY; const mins = Math.floor((y / H) * 2) * 30 + DAY_START * 60;
      openTask({ due_date: dStr, time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` });
    });
    layoutColumns(its).forEach(({ it, col: c, cols: n }) => {
      const dayStart = new Date(d); dayStart.setHours(DAY_START, 0, 0, 0);
      const top = Math.max(0, (it.start - dayStart) / 3600000) * H;
      const bottom = Math.min(DAY_END - DAY_START, (it.end - dayStart) / 3600000) * H;
      const el = h("div", { class: "ev" + (it.done ? " done" : ""), style: {
        top: `${top}px`, height: `${Math.max(20, bottom - top - 2)}px`, left: `calc(${(c / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: it.color,
      }, onclick: () => (it.kind === "task" ? openTask(it.task) : openEvent(it)) }, h("b", null, it.title), `${hm(it.start)}–${hm(it.end)}`);
      col.append(el);
    });
    if (dStr === tStr) {
      const now = new Date(); const y = ((now.getHours() - DAY_START) + now.getMinutes() / 60) * H;
      if (y > 0) col.append(h("div", { class: "now-line", style: { top: `${y}px` } }));
    }
    return col;
  });
  return h("div", null,
    h("div", { class: "head" }, periodNav(label, () => { S.cursor = addDays(S.cursor, -7); render(); }, () => { S.cursor = addDays(S.cursor, 7); render(); }, () => { S.cursor = new Date(); render(); })),
    h("div", { class: "week" }, h("div", { class: "week-inner" }, head, allday, h("div", { class: "week-body" }, hours, cols))));
}
// Distribui itens sobrepostos em colunas lado a lado.
function layoutColumns(items) {
  const out = []; let group = [], groupEnd = 0;
  const flush = () => {
    const colsEnd = [];
    const placed = group.map((it) => {
      let c = colsEnd.findIndex((end) => end <= it.start);
      if (c === -1) { c = colsEnd.length; colsEnd.push(it.end); } else colsEnd[c] = it.end;
      return { it, col: c };
    });
    placed.forEach((p) => out.push({ ...p, cols: colsEnd.length }));
    group = []; groupEnd = 0;
  };
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    if (group.length && it.start >= groupEnd) flush();
    group.push(it); groupEnd = Math.max(groupEnd, +it.end);
  }
  if (group.length) flush();
  return out;
}
function chip(i) {
  return h("span", { class: "chip" + (i.done ? " done" : ""), style: { color: i.color }, title: i.title,
    onclick: (e) => { e.stopPropagation(); i.kind === "task" ? openTask(i.task) : openEvent(i); } },
  h("span", { style: { color: "var(--text)" } }, (!i.allDay ? hm(i.start) + " " : "") + i.title));
}

// ----- Mês -----------------------------------------------------------------
async function viewMonth() {
  const ms = startOfMonth(S.cursor);
  const gs = startOfWeek(ms);
  const weeks = Math.ceil(((ms.getDay() + 6) % 7 + new Date(ms.getFullYear(), ms.getMonth() + 1, 0).getDate()) / 7);
  const ge = addDays(gs, weeks * 7);
  const events = await eventsFor(gs, ge);
  const tStr = todayStr();
  const mobile = matchMedia("(max-width: 820px)").matches;
  const max = mobile ? 4 : 3;
  const cells = [...Array(weeks * 7)].map((_, i) => {
    const d = addDays(gs, i), dStr = ymd(d);
    const its = itemsForDay(dStr, events);
    return h("div", { class: "day" + (d.getMonth() !== ms.getMonth() ? " other" : "") + (dStr === tStr ? " today" : ""), onclick: () => openDay(dStr, events) },
      h("div", { class: "n" }, d.getDate()),
      its.slice(0, max).map((it) => chip(it)),
      its.length > max ? h("div", { class: "more" }, `+${its.length - max}`) : null);
  });
  return h("div", null,
    h("div", { class: "head" }, periodNav(`${MONTHS[ms.getMonth()]} ${ms.getFullYear()}`,
      () => { S.cursor = new Date(ms.getFullYear(), ms.getMonth() - 1, 1); render(); },
      () => { S.cursor = new Date(ms.getFullYear(), ms.getMonth() + 1, 1); render(); },
      () => { S.cursor = new Date(); render(); })),
    h("div", { class: "month" }, h("div", { class: "dow" }, DOW.map((d) => h("div", null, d))), h("div", { class: "days" }, cells)));
}
function openDay(dStr, events) {
  const d = parseYmd(dStr);
  const close = openModal(fmtDay(d), () => {
    const its = itemsForDay(dStr, events);
    return [
      its.length ? its.map((i) => i.kind === "task" ? taskRow(i.task, { hideDate: true, showTime: true }) :
        h("div", { class: "item" }, h("div", { class: "time-col" }, i.allDay ? "dia todo" : hm(i.start)),
          h("div", { class: "body", onclick: () => { close(); openEvent(i); } }, h("div", { class: "title" }, i.title),
            h("div", { class: "meta" }, h("span", { class: "tag" }, h("span", { class: "dot", style: { background: i.color } }), i.cal)))))
        : h("div", { class: "empty" }, "Dia livre."),
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: () => { close(); S.cursor = d; setView("semana"); } }, "Ver semana"),
        h("button", { class: "btn primary", onclick: () => { close(); openTask({ due_date: dStr }); } }, "+ Tarefa")),
    ];
  });
}

// ----- Tarefas -------------------------------------------------------------
function viewTasks() {
  const f = S.taskFilter, tStr = todayStr(), in7 = ymd(addDays(new Date(), 7));
  let list = topTasks().filter((t) => f.cat === "all" || t.category === f.cat);
  const open = list.filter((t) => t.status !== "done");
  const byPrio = (a, b) => a.priority - b.priority || (taskDay(a) || "9").localeCompare(taskDay(b) || "9");
  const groups = [
    ["Atrasadas", open.filter((t) => taskDay(t) && taskDay(t) < tStr), true],
    ["Hoje", open.filter((t) => taskDay(t) === tStr)],
    ["Próximos 7 dias", open.filter((t) => taskDay(t) > tStr && taskDay(t) <= in7)],
    ["Mais adiante", open.filter((t) => taskDay(t) > in7)],
    ["Sem data", open.filter((t) => !taskDay(t))],
  ];
  const done = list.filter((t) => t.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")).slice(0, 50);
  const setF = (p) => { Object.assign(S.taskFilter, p); ls.set("planner.taskFilter", S.taskFilter); render(); };
  return h("div", null,
    h("div", { class: "head" }, h("h1", null, "Tarefas"), h("span", { class: "sub" }, `${open.length} abertas`), h("div", { class: "grow" }),
      h("button", { class: "btn primary", onclick: () => openTask({}) }, "+ Nova tarefa")),
    h("div", { class: "filters" },
      h("button", { class: "pill" + (f.cat === "all" ? " on" : ""), onclick: () => setF({ cat: "all" }) }, "Todas"),
      Object.entries(CATS).map(([k, c]) => h("button", { class: "pill" + (f.cat === k ? " on" : ""), onclick: () => setF({ cat: k }) }, h("span", { class: "dot", style: { background: c.color } }), c.label)),
      h("button", { class: "pill" + (f.showDone ? " on" : ""), onclick: () => setF({ showDone: !f.showDone }) }, "Concluídas")),
    h("div", { class: "card" },
      open.length ? groups.filter((g) => g[1].length).map(([name, items, late]) => [
        h("div", { class: "section-label" + (late ? " late" : "") }, `${name} (${items.length})`),
        items.sort(byPrio).map((t) => taskRow(t, { showSubs: true })),
      ]) : h("div", { class: "empty" }, "Nenhuma tarefa aberta. 🎉"),
      f.showDone && done.length ? [h("div", { class: "section-label" }, "Concluídas recentemente"), done.map((t) => taskRow(t))] : null));
}

// ----- Editor de tarefa ------------------------------------------------------
function openTask(t) {
  if (RO()) return t.id ? openTaskReadOnly(t) : roBlock();
  const isNew = !t.id;
  const start = t.start_at ? new Date(t.start_at) : null;
  const subs = isNew ? [] : subsOf(t.id).map((s) => ({ id: s.id, title: s.title }));
  const f = {
    title: h("input", { value: t.title || "", placeholder: "O que precisa ser feito?", maxlength: "300", required: true }),
    category: h("select", null, Object.entries(CATS).map(([k, c]) => h("option", { value: k, selected: (t.category || "pessoal") === k }, c.label))),
    priority: h("select", null, Object.entries(PRIOS).map(([k, l]) => h("option", { value: k, selected: String(t.priority || 2) === k }, l))),
    date: h("input", { type: "date", value: start ? ymd(start) : t.due_date || "" }),
    time: h("input", { type: "time", value: start ? hm(start) : t.time || "" }),
    duration: h("select", null, [15, 30, 45, 60, 90, 120, 180, 240].map((m) => h("option", { value: m, selected: (t.duration_min || 60) === m }, m < 60 ? `${m} min` : `${m / 60} h`))),
    reminder: h("select", null, REMINDERS.map(([m, l]) => h("option", { value: m, selected: (t.reminder_min ?? 30) === m }, l))),
    top3: h("input", { type: "checkbox", checked: t.is_top3 }),
    notes: h("textarea", { placeholder: "Anotações, links…", value: t.notes || "" }),
  };
  const timeFields = h("div", { class: "row2" }, h("div", { class: "field" }, h("label", null, "Duração"), f.duration), h("div", { class: "field" }, h("label", null, "Lembrete no celular"), f.reminder));
  const toggleTime = () => { timeFields.style.display = f.time.value ? "" : "none"; };
  f.time.addEventListener("input", toggleTime); toggleTime();
  const subBox = h("div");
  const drawSubs = () => subBox.replaceChildren(...subs.map((s, i) => h("div", { class: "sub-edit" },
    h("input", { value: s.title, placeholder: "Subtarefa", oninput: (e) => { s.title = e.target.value; } }),
    h("button", { class: "btn sm icon", type: "button", "aria-label": "Remover", onclick: () => { subs.splice(i, 1); drawSubs(); } }, "✕"))),
  h("button", { class: "btn sm", type: "button", onclick: () => { subs.push({ title: "" }); drawSubs(); subBox.querySelectorAll("input").forEach((x, i, a) => i === a.length - 1 && x.focus()); } }, "+ Subtarefa"));
  drawSubs();

  const close = openModal(isNew ? "Nova tarefa" : "Editar tarefa", () => [
    h("div", { class: "field" }, h("label", null, "Título"), f.title),
    h("div", { class: "row2" }, h("div", { class: "field" }, h("label", null, "Categoria"), f.category), h("div", { class: "field" }, h("label", null, "Prioridade"), f.priority)),
    h("div", { class: "row2" }, h("div", { class: "field" }, h("label", null, "Data"), f.date), h("div", { class: "field" }, h("label", null, "Horário (opcional)"), f.time)),
    timeFields,
    h("div", { class: "empty", style: { marginTop: "-6px", marginBottom: "10px", fontSize: "12.5px" } }, "Com horário, a tarefa vai para o seu Google Agenda e o lembrete chega no celular pelo app do Google Agenda."),
    h("label", { class: "inline" }, f.top3, "⭐ Uma das 3 prioridades do dia"),
    h("div", { class: "field" }, h("label", null, "Subtarefas"), subBox),
    h("div", { class: "field" }, h("label", null, "Notas"), f.notes),
    h("div", { class: "actions" },
      !isNew ? h("button", { class: "btn danger", onclick: async () => { if (confirm("Excluir esta tarefa?")) { close(); await deleteTask(t); render(); } } }, "Excluir") : null,
      h("div", { class: "grow" }),
      h("button", { class: "btn", onclick: () => close() }, "Cancelar"),
      h("button", { class: "btn primary", onclick: async (e) => {
        const title = f.title.value.trim();
        if (!title) { f.title.focus(); return; }
        if (f.time.value && !f.date.value) { toast("Escolha uma data para usar horário."); return; }
        e.target.disabled = true; e.target.textContent = "Salvando…";
        const startAt = f.time.value ? new Date(`${f.date.value}T${f.time.value}`).toISOString() : null;
        const row = {
          ...(isNew ? {} : { id: t.id }),
          title, category: f.category.value, priority: Number(f.priority.value),
          due_date: f.date.value || null, start_at: startAt,
          duration_min: startAt ? Number(f.duration.value) : null,
          reminder_min: Number(f.reminder.value),
          is_top3: f.top3.checked, notes: f.notes.value.trim() || null,
          status: t.status || "todo", gcal_event_id: t.gcal_event_id || null,
        };
        const saved = await saveTask(row, subs);
        if (saved) { close(); render(); if (startAt && S.gStatus === "ok") toast("Salvo e enviado ao Google Agenda ✓"); }
        else { e.target.disabled = false; e.target.textContent = "Salvar"; }
      } }, "Salvar")),
  ]);
  setTimeout(() => isNew && f.title.focus(), 50);
}
function openTaskReadOnly(t) {
  const subs = subsOf(t.id);
  const start = t.start_at ? new Date(t.start_at) : null;
  openModal(t.title, () => [
    h("div", { class: "meta", style: { color: "var(--muted)", marginBottom: "12px", display: "grid", gap: "6px" } },
      catTag(t.category),
      h("span", null, `Prioridade ${PRIOS[t.priority].toLowerCase()}` + (t.status === "done" ? " · concluída ✓" : "")),
      taskDay(t) ? h("span", null, fmtDay(parseYmd(taskDay(t))) + (start ? ` · ${hm(start)} (${t.duration_min || 30} min)` : "")) : null),
    subs.length ? [h("div", { class: "section-label" }, "Subtarefas"), subs.map((x) => h("div", { class: "item" + (x.status === "done" ? " done" : "") },
      h("span", { class: "check" + (x.status === "done" ? " on" : "") }), h("div", { class: "body" }, h("div", { class: "title" }, x.title))))] : null,
    t.notes ? h("div", { style: { whiteSpace: "pre-wrap", fontSize: "14px", margin: "12px 0" } }, t.notes) : null,
    h("div", { class: "actions" }, h("button", { class: "btn", onclick: () => document.querySelector(".overlay")?.remove() }, "Fechar")),
  ]);
}
function openShare() {
  let list;
  const draw = () => list.replaceChildren(...(myShares().length
    ? myShares().map((x) => h("div", { class: "share-row" }, h("span", null, x.viewer_email),
        h("button", { class: "btn sm danger", onclick: async () => {
          if (!confirm(`Parar de compartilhar com ${x.viewer_email}?`)) return;
          const { error } = await sb.from("shares").delete().eq("id", x.id);
          if (error) return toast("Erro: " + error.message);
          await loadShares(); draw();
        } }, "Remover")))
    : [h("div", { class: "empty" }, "Você ainda não compartilhou com ninguém.")]));
  const email = h("input", { type: "email", placeholder: "email.da.pessoa@gmail.com", autocomplete: "off", maxlength: "254" });
  const add = async () => {
    const v = email.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return toast("Digite um e-mail válido.");
    if (v === String(S.session.user.email || "").toLowerCase()) return toast("Esse é o seu próprio e-mail.");
    const meta = S.session.user.user_metadata || {};
    const { error } = await sb.from("shares").insert({ viewer_email: v, owner_name: String(meta.full_name || meta.name || "").slice(0, 100) || null });
    if (error) return toast(/duplicate|unique/i.test(error.message) ? "Já está compartilhado com esse e-mail." : "Erro: " + error.message);
    email.value = ""; await loadShares(); draw(); toast("Compartilhado ✓");
  };
  email.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  const close = openModal("Compartilhar meu planner", () => {
    list = h("div"); draw();
    return [
      h("p", { class: "empty", style: { marginTop: 0 } }, "Quem você adicionar consegue ver (sem editar) suas tarefas, hábitos, metas e revisões. A pessoa precisa entrar no planner com essa conta Google."),
      h("div", { class: "field" }, h("label", null, "E-mail da conta Google da pessoa"), email),
      h("div", { class: "actions", style: { marginTop: 0, marginBottom: "6px" } }, h("button", { class: "btn primary", onclick: add }, "Compartilhar")),
      h("div", { class: "section-label" }, "Você compartilha com"), list,
      h("div", { class: "section-label" }, "Aulas e compromissos do Google"),
      h("p", { class: "empty", style: { marginTop: 0 } }, "Para a pessoa ver também seus compromissos do Google Agenda, compartilhe a sua agenda pelo próprio Google: Google Agenda → Configurações → sua agenda → Compartilhar com pessoas específicas."),
      h("div", { class: "actions" }, h("button", { class: "btn", onclick: () => close() }, "Fechar")),
    ];
  });
}
function whoPicker() {
  const others = sharedWithMe();
  if (!others.length) return null;
  return h("div", { class: "who" }, h("label", null, "Vendo o planner de"),
    h("select", { "aria-label": "Planner exibido", onchange: (e) => viewPlanner(e.target.value) },
      h("option", { value: S.me, selected: !S.viewing }, "Mim (meu planner)"),
      others.map((x) => h("option", { value: x.owner_id, selected: S.viewing?.owner_id === x.owner_id }, firstName(ownerLabel(x))))));
}
function themeToggle() {
  return h("div", { class: "seg", role: "group", "aria-label": "Tema" },
    h("button", { class: S.theme === "flores" ? "on" : "", onclick: () => setTheme("flores") }, "🌸 Flores"),
    h("button", { class: S.theme === "azul" ? "on" : "", onclick: () => setTheme("azul") }, "🔵 Azul"));
}
function viewingBanner() {
  if (!S.viewing) return null;
  const name = firstName(ownerLabel(S.viewing));
  const hasCal = S.calendars.some((c) => c.id.toLowerCase() === S.viewing.owner_email.toLowerCase());
  return h("div", { class: "banner viewing" },
    h("span", { style: { flex: 1 } }, `👀 Você está vendo o planner de ${name} (só leitura).`,
      hasCal ? null : h("span", { style: { display: "block", fontSize: "12.5px", opacity: .8 } }, `Os compromissos do Google Agenda de ${name} aparecem aqui quando ${name} compartilhar a agenda do Google com você.`)),
    h("button", { class: "btn sm primary", onclick: () => viewPlanner(null) }, "Voltar ao meu"));
}
function openEvent(e) {
  openModal(e.title, () => [
    h("div", { class: "meta", style: { color: "var(--muted)", marginBottom: "12px", display: "grid", gap: "4px" } },
      h("span", { class: "tag" }, h("span", { class: "dot", style: { background: e.color } }), e.cal),
      h("span", null, e.allDay ? `${fmtDay(e.start)} · dia todo` : `${fmtDay(e.start)} · ${hm(e.start)}–${hm(e.end)}`),
      e.location ? h("span", null, "📍 " + e.location) : null),
    e.desc ? h("div", { style: { whiteSpace: "pre-wrap", fontSize: "14px", marginBottom: "12px" } }, e.desc.replace(/<[^>]+>/g, " ")) : null,
    h("div", { class: "actions" },
      e.link && e.link.startsWith("https://") ? h("a", { class: "btn", href: e.link, target: "_blank", rel: "noopener" }, "Abrir no Google Agenda") : null,
      h("button", { class: "btn primary", onclick: () => { document.querySelector(".overlay")?.remove(); openTask({ title: `Preparar: ${e.title}`, due_date: ymd(e.start), category: /ingl|english|aula|curso/i.test(e.title) ? "estudos" : "pessoal" }); } }, "+ Tarefa ligada")),
  ]);
}
function openModal(title, build) {
  const overlay = h("div", { class: "overlay" });
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKey);
  const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true" }, h("h3", null, title));
  overlay.append(modal); document.body.append(overlay);
  modal.append(...[build(modal)].flat(Infinity).filter(Boolean));
  return close;
}

// ----- Hábitos ---------------------------------------------------------------
async function toggleHabit(hb, day) {
  if (roBlock()) return;
  const on = S.logs.some((l) => l.habit_id === hb.id && l.day === day);
  if (on) S.logs = S.logs.filter((l) => !(l.habit_id === hb.id && l.day === day)); else S.logs.push({ habit_id: hb.id, day });
  render();
  const { error } = on ? await sb.from("habit_logs").delete().eq("habit_id", hb.id).eq("day", day) : await sb.from("habit_logs").insert({ habit_id: hb.id, day });
  if (error) { toast("Erro: " + error.message); await loadAll(); render(); }
}
const streakLabel = (n) => `🔥 ${n} ${n === 1 ? "dia seguido" : "dias seguidos"}`;
function streak(hb) {
  const days = new Set(S.logs.filter((l) => l.habit_id === hb.id).map((l) => l.day));
  let d = new Date(); if (!days.has(ymd(d))) d = addDays(d, -1);
  let n = 0; while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
function viewHabits() {
  const ws = startOfWeek(S.cursor), tStr = todayStr();
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  return h("div", null,
    h("div", { class: "head" }, periodNav(`Hábitos · semana de ${fmtShort(ws)}`, () => { S.cursor = addDays(S.cursor, -7); render(); }, () => { S.cursor = addDays(S.cursor, 7); render(); }, () => { S.cursor = new Date(); render(); }),
      h("div", { class: "grow" }), h("button", { class: "btn primary", onclick: () => openHabit({}) }, "+ Hábito")),
    h("div", { class: "card" },
      S.habits.length ? [
        h("div", { class: "habit-row head-row" }, h("div"), days.map((d, i) => h("div", null, DOW[i][0] + " " + d.getDate())), h("div", null, "meta")),
        S.habits.map((hb) => {
          const count = days.filter((d) => S.logs.some((l) => l.habit_id === hb.id && l.day === ymd(d))).length;
          return h("div", { class: "habit-row" },
            h("div", { class: "name", onclick: () => openHabit(hb) }, hb.name, h("div", { class: "meta", title: "Dias seguidos sem falhar, contando até hoje", style: { color: "var(--muted)", fontSize: "12px", fontWeight: 400 } }, streakLabel(streak(hb)))),
            days.map((d) => {
              const dStr = ymd(d), on = S.logs.some((l) => l.habit_id === hb.id && l.day === dStr);
              return h("button", { class: "hcell" + (on ? " on" : "") + (dStr === tStr ? " today" : ""), style: on ? { background: CATS[hb.category].color } : null,
                disabled: dStr > tStr, "aria-label": `${hb.name} ${dStr}`, onclick: () => toggleHabit(hb, dStr) });
            }),
            h("div", { class: "score", style: count >= hb.target_per_week ? { color: "var(--ok)", fontWeight: 600 } : null }, `${count}/${hb.target_per_week}`));
        }),
      ] : h("div", { class: "empty" }, "Nenhum hábito ainda. Sugestões: \"Estudar inglês 30 min\", \"Ler 20 páginas\", \"Exercício\", \"Revisar a agenda do dia\".")));
}
function openHabit(hb) {
  if (roBlock()) return;
  const isNew = !hb.id;
  const f = {
    name: h("input", { value: hb.name || "", maxlength: "100", placeholder: "Ex.: Estudar inglês 30 min" }),
    category: h("select", null, Object.entries(CATS).map(([k, c]) => h("option", { value: k, selected: (hb.category || "pessoal") === k }, c.label))),
    target: h("select", null, [1, 2, 3, 4, 5, 6, 7].map((n) => h("option", { value: n, selected: (hb.target_per_week || 7) === n }, `${n}x por semana`))),
  };
  const close = openModal(isNew ? "Novo hábito" : "Editar hábito", () => [
    h("div", { class: "field" }, h("label", null, "Nome"), f.name),
    h("div", { class: "row2" }, h("div", { class: "field" }, h("label", null, "Categoria"), f.category), h("div", { class: "field" }, h("label", null, "Meta"), f.target)),
    h("div", { class: "actions" },
      !isNew ? h("button", { class: "btn danger", onclick: async () => { if (!confirm("Arquivar este hábito?")) return; await sb.from("habits").update({ archived: true }).eq("id", hb.id); close(); await loadAll(); render(); } }, "Arquivar") : null,
      h("div", { class: "grow" }), h("button", { class: "btn", onclick: () => close() }, "Cancelar"),
      h("button", { class: "btn primary", onclick: async () => {
        const row = { name: f.name.value.trim(), category: f.category.value, target_per_week: Number(f.target.value) };
        if (!row.name) return f.name.focus();
        const { error } = isNew ? await sb.from("habits").insert(row) : await sb.from("habits").update(row).eq("id", hb.id);
        if (error) return toast("Erro: " + error.message);
        close(); await loadAll(); render();
      } }, "Salvar")),
  ]);
}

// ----- Metas -----------------------------------------------------------------
// Alvo desenhado em SVG; quando a meta está cumprida aparece um dardo cravado no centro.
function targetIcon(hit) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const svg = el("svg", { viewBox: "0 0 48 48", width: "40", height: "40", "aria-hidden": "true" });
  [[20, "ring-a"], [15, "ring-b"], [10, "ring-a"], [5, "ring-b"]].forEach(([r, c]) => svg.append(el("circle", { cx: "22", cy: "26", r: String(r), class: c })));
  if (hit) {
    svg.append(el("line", { x1: "22", y1: "26", x2: "40", y2: "8", class: "dart-shaft" }));
    svg.append(el("path", { d: "M37 5 L46 3 L44 11 L40 8 Z", class: "dart-tail" }));
    svg.append(el("circle", { cx: "22", cy: "26", r: "2.6", class: "dart-tip" }));
  }
  return svg;
}
function viewGoals() {
  const ms = startOfMonth(S.cursor), mStr = ymd(ms);
  const goals = S.goals.filter((g) => g.month === mStr);
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + Math.min(1, g.progress / g.target), 0) / goals.length * 100) : 0;
  return h("div", null,
    h("div", { class: "head" }, periodNav(`Metas · ${MONTHS[ms.getMonth()]} ${ms.getFullYear()}`,
      () => { S.cursor = new Date(ms.getFullYear(), ms.getMonth() - 1, 1); render(); },
      () => { S.cursor = new Date(ms.getFullYear(), ms.getMonth() + 1, 1); render(); },
      () => { S.cursor = new Date(); render(); }),
    h("div", { class: "grow" }), h("button", { class: "btn primary", onclick: () => openGoal({ month: mStr }) }, "+ Meta")),
    goals.length ? h("div", { class: "stats" }, stat(`${avg}%`, "progresso médio"), stat(goals.filter((g) => g.progress >= g.target).length + "/" + goals.length, "metas batidas")) : null,
    h("div", { class: "card" }, goals.length ? goals.map((g) => {
      const pct = Math.min(100, Math.round((g.progress / g.target) * 100));
      const hit = Number(g.progress) >= Number(g.target);
      const toggle = async () => {
        if (roBlock()) return;
        const progress = hit ? 0 : Number(g.target);
        g.progress = progress; render();
        if (!hit) toast("🎯 Meta cumprida!");
        const { error } = await sb.from("goals").update({ progress }).eq("id", g.id);
        if (error) toast("Erro: " + error.message);
      };
      return h("div", { class: "goal" + (hit ? " hit" : "") },
        h("div", { class: "row" }, h("span", { class: "dot", style: { background: CATS[g.category].color } }),
          h("div", { class: "t", onclick: () => openGoal(g) }, g.title,
            g.notes ? h("div", { class: "goal-note" }, g.notes) : (RO() ? null : h("div", { class: "goal-note add" }, "+ observação"))),
          Number(g.target) > 1 ? h("span", { class: "num" }, `${+g.progress}/${+g.target}${g.unit ? " " + g.unit : ""}`) : null,
          h("button", { class: "target" + (hit ? " on" : ""), title: hit ? "Meta cumprida (clique para desfazer)" : "Marcar meta como cumprida", "aria-label": hit ? "Desmarcar meta" : "Marcar meta como cumprida", "aria-pressed": hit ? "true" : "false", onclick: toggle }, targetIcon(hit))),
        Number(g.target) > 1 ? h("div", { class: "bar" }, h("span", { style: { width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : CATS[g.category].color } })) : null);
    }) : h("div", { class: "empty" }, "Defina de 3 a 5 metas para o mês. Ex.: \"Assistir 8 aulas de inglês\", \"Concluir 2 módulos do curso\", \"Treinar 12 vezes\".")));
}
function openGoal(g) {
  if (roBlock()) return;
  const isNew = !g.id;
  const f = {
    title: h("input", { value: g.title || "", maxlength: "200", placeholder: "Ex.: Assistir 8 aulas de inglês" }),
    category: h("select", null, Object.entries(CATS).map(([k, c]) => h("option", { value: k, selected: (g.category || "estudos") === k }, c.label))),
    target: h("input", { type: "number", min: "1", step: "any", value: g.target ?? 1 }),
    progress: h("input", { type: "number", min: "0", step: "any", value: g.progress ?? 0 }),
    unit: h("input", { value: g.unit || "", maxlength: "20", placeholder: "aulas, h, páginas…" }),
    notes: h("textarea", { value: g.notes || "", maxlength: "2000", placeholder: "Observação: como foi, próximos passos, links…" }),
  };
  const close = openModal(isNew ? "Nova meta" : "Editar meta", () => [
    h("div", { class: "field" }, h("label", null, "Meta"), f.title),
    h("div", { class: "empty", style: { marginTop: "-6px", marginBottom: "10px", fontSize: "12.5px" } }, "Meta simples (fazer ou não fazer): deixe o alvo em 1. Para contar, como \"8 aulas\", use um número maior."),
    h("div", { class: "field" }, h("label", null, "Categoria"), f.category),
    h("div", { class: "row3" }, h("div", { class: "field" }, h("label", null, "Alvo"), f.target), h("div", { class: "field" }, h("label", null, "Feito"), f.progress), h("div", { class: "field" }, h("label", null, "Unidade"), f.unit)),
    h("div", { class: "field" }, h("label", null, "Observação"), f.notes),
    h("div", { class: "actions" },
      !isNew ? h("button", { class: "btn danger", onclick: async () => { if (!confirm("Excluir esta meta?")) return; await sb.from("goals").delete().eq("id", g.id); close(); await loadAll(); render(); } }, "Excluir") : null,
      h("div", { class: "grow" }), h("button", { class: "btn", onclick: () => close() }, "Cancelar"),
      h("button", { class: "btn primary", onclick: async () => {
        const row = { title: f.title.value.trim(), category: f.category.value, target: Number(f.target.value) || 1, progress: Number(f.progress.value) || 0, unit: f.unit.value.trim() || null, notes: f.notes.value.trim() || null, month: g.month };
        if (!row.title) return f.title.focus();
        const { error } = isNew ? await sb.from("goals").insert(row) : await sb.from("goals").update(row).eq("id", g.id);
        if (error) return toast("Erro: " + error.message);
        close(); await loadAll(); render();
      } }, "Salvar")),
  ]);
}

// ----- Revisão semanal ---------------------------------------------------------
async function viewReview() {
  const ws = startOfWeek(S.cursor), we = addDays(ws, 7), wsStr = ymd(ws), weStr = ymd(we), tStr = todayStr();
  const events = await eventsFor(ws, we);
  const inWeek = (s) => s >= wsStr && s < weStr;
  const planned = topTasks().filter((t) => taskDay(t) && inWeek(taskDay(t)));
  const done = topTasks().filter((t) => t.done_at && inWeek(ymd(new Date(t.done_at))));
  const open = planned.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => taskDay(t) < tStr);        // data já passou e não foi feita
  const upcoming = open.filter((t) => taskDay(t) >= tStr)        // de hoje em diante
    .sort((a, b) => (a.start_at || a.due_date || "").localeCompare(b.start_at || b.due_date || ""));
  const plannedSoFar = planned.filter((t) => taskDay(t) < tStr || t.status === "done");
  const doneSoFar = plannedSoFar.filter((t) => t.status === "done").length;
  const eventHours = events.filter((e) => !e.allDay).reduce((s, e) => s + (e.end - e.start) / 3600000, 0);
  const habitPossible = S.habits.reduce((s, hb) => s + Math.min(hb.target_per_week, 7), 0);
  const habitDone = S.habits.reduce((s, hb) => s + Math.min(hb.target_per_week, S.logs.filter((l) => l.habit_id === hb.id && inWeek(l.day)).length), 0);
  const habitPct = habitPossible ? Math.round((habitDone / habitPossible) * 100) : 0;
  const byCat = Object.keys(CATS).map((k) => [k, done.filter((t) => t.category === k).length]);
  const maxCat = Math.max(1, ...byCat.map((c) => c[1]));
  const rv = S.reviews.find((r) => r.week_start === wsStr) || {};
  const notes = rv.area_notes || {};
  const f = {
    wins: h("textarea", { value: rv.wins || "", placeholder: "O que deu certo? Do que você se orgulha?", disabled: RO() }),
    blockers: h("textarea", { value: rv.blockers || "", placeholder: "O que atrapalhou? O que ficou para trás e por quê?", disabled: RO() }),
    next_focus: h("textarea", { value: rv.next_focus || "", placeholder: "Quais são as 3 coisas mais importantes da próxima semana?", disabled: RO() }),
  };
  const areaBox = Object.fromEntries(Object.keys(CATS).map((k) => [k, h("textarea", {
    class: "area-note", rows: "2", maxlength: "2000", disabled: RO(), value: notes[k] || "",
    placeholder: RO() ? "" : `Como foi a semana em ${CATS[k].label}?`, "aria-label": `Anotações sobre ${CATS[k].label}`,
  })]));
  let mood = rv.mood || null;
  const moodBox = h("div", { class: "mood" });
  const drawMood = () => moodBox.replaceChildren(...["😫", "😕", "😐", "🙂", "🤩"].map((m, i) => h("button", { class: mood === i + 1 ? "on" : "", "aria-label": `Humor ${i + 1}`, onclick: () => { if (roBlock()) return; mood = i + 1; drawMood(); } }, m)));
  drawMood();
  const save = async (e) => {
    if (roBlock()) return;
    const area_notes = {};
    for (const [k, el] of Object.entries(areaBox)) { const v = el.value.trim(); if (v) area_notes[k] = v; }
    const row = { week_start: wsStr, wins: f.wins.value.trim() || null, blockers: f.blockers.value.trim() || null, next_focus: f.next_focus.value.trim() || null, mood, area_notes };
    e.target.disabled = true;
    const { error } = await sb.from("reviews").upsert(row, { onConflict: "user_id,week_start" });
    e.target.disabled = false;
    if (error) return toast("Erro: " + error.message);
    await loadAll(); toast("Revisão salva ✓");
  };
  // pendências vão para hoje (semana atual) ou para a segunda seguinte (semanas passadas), mantendo o horário
  const target = tStr >= wsStr && tStr < weStr ? parseYmd(tStr) : we;
  const moveOverdue = async () => {
    if (roBlock()) return;
    for (const t of overdue) {
      let start_at = null;
      if (t.start_at) { const d = new Date(t.start_at); const n = new Date(target); n.setHours(d.getHours(), d.getMinutes(), 0, 0); start_at = n.toISOString(); }
      await saveTask({ id: t.id, due_date: ymd(target), start_at, status: "todo", gcal_event_id: t.gcal_event_id });
    }
    toast(`${overdue.length} tarefa(s) movidas para ${fmtShort(target)}`); render();
  };
  return h("div", null,
    h("div", { class: "head" }, periodNav(`Revisão · ${fmtShort(ws)} a ${fmtShort(addDays(we, -1))}`, () => { S.cursor = addDays(S.cursor, -7); render(); }, () => { S.cursor = addDays(S.cursor, 7); render(); }, () => { S.cursor = new Date(); render(); })),
    h("div", { class: "stats" },
      stat(done.length, "tarefas concluídas"),
      stat(plannedSoFar.length ? `${Math.round((doneSoFar / plannedSoFar.length) * 100)}%` : "–", "do planejado até hoje feito"),
      stat(`${habitPct}%`, "consistência nos hábitos"),
      stat(`${eventHours.toFixed(1)} h`, "em compromissos")),
    h("div", { class: "grid two" },
      h("div", { class: "grid" },
        h("div", { class: "card" }, h("h2", null, "Reflexão da semana"),
          h("div", { class: "field" }, h("label", null, "Como foi a semana?"), moodBox),
          h("div", { class: "field" }, h("label", null, "Vitórias"), f.wins),
          h("div", { class: "field" }, h("label", null, "Obstáculos"), f.blockers),
          h("div", { class: "field" }, h("label", null, "Foco da próxima semana"), f.next_focus),
          h("div", { class: "actions" }, RO() ? null : h("button", { class: "btn primary", onclick: save }, "Salvar revisão"))),
        h("div", { class: "card cat-bars" }, h("h2", null, "Por área"),
          h("div", { class: "empty", style: { marginTop: "-6px", marginBottom: "8px", fontSize: "12.5px" } }, "O número é quantas tarefas você concluiu na semana em cada área."),
          byCat.map(([k, n]) => h("div", { class: "area" },
            h("div", { class: "r" }, catTag(k), h("div", { class: "bar" }, h("span", { style: { width: `${(n / maxCat) * 100}%`, background: CATS[k].color } })), h("span", { style: { textAlign: "right" }, title: "tarefas concluídas" }, n)),
            areaBox[k])),
          h("div", { class: "actions" }, RO() ? null : h("button", { class: "btn primary", onclick: save }, "Salvar revisão")))),
      h("div", { class: "grid" },
        overdue.length ? h("div", { class: "card" }, h("h2", null, "Ficou pendente", h("span", { class: "count" }, overdue.length)),
          overdue.map((t) => taskRow(t)),
          RO() ? null : h("div", { style: { marginTop: "10px" } }, h("button", { class: "btn sm", onclick: moveOverdue }, `Mover para ${fmtShort(target)}`))) : null,
        h("div", { class: "card" }, h("h2", null, "Nos próximos dias", h("span", { class: "count" }, upcoming.length || "")),
          upcoming.length ? upcoming.map((t) => taskRow(t)) : h("div", { class: "empty" }, weStr <= tStr ? "Essa semana já passou." : "Nada planejado para o resto da semana.")),
        !overdue.length && planned.some((t) => taskDay(t) < tStr) ? h("div", { class: "card" }, h("div", { class: "empty" }, "Nada ficou pendente. 👏")) : null)));
}
// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
let booted = false;
sb.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
    if (event === "SIGNED_IN" && booted && S.session?.user?.id === session?.user?.id && !session?.provider_refresh_token) return;
    booted = true;
    setTimeout(() => onSession(session), 0); // fora do callback do supabase-js
  }
});
// Atualiza a tela ao voltar para o app (ex.: celular) para pegar mudanças no Google Agenda.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.session) { S.gevents.clear(); render(); }
});

/* ============================================================
   Miraaya's School Planner — app.js
   Pure vanilla JS, localStorage-backed, PWA-ready.
   ============================================================ */

const STORAGE_KEY = "msp_state_v1";

const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ---------------- State ---------------- */
function defaultState() {
  return {
    subjects: [],
    tasks: [],
    schedule: [],
    inspiration: {
      image: "",
      quote: ""
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    console.error("Failed to load state", e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

let state = loadState();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------- Navigation ---------------- */
function goTo(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + screen).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.nav === screen);
  });
  if (screen === "grades") renderGrades();
  if (screen === "calendar") renderCalendar();
  if (screen === "schedule") renderSchedule();
  if (screen === "dashboard") renderBanner();
}

document.querySelectorAll("[data-nav]").forEach(el => {
  el.addEventListener("click", () => goTo(el.dataset.nav));
});

/* ---------------- Modal helpers ---------------- */
function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }
document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

/* ---------------- Priority choice highlight ---------------- */
function updatePriorityChoiceUI() {
  document.querySelectorAll('input[name="task-priority"]').forEach(input => {
    input.parentElement.classList.toggle("selected", input.checked);
  });
}
document.querySelectorAll('input[name="task-priority"]').forEach(input => {
  input.addEventListener("change", updatePriorityChoiceUI);
});

/* ============================================================
   GRADES
   ============================================================ */

// NJ-style unweighted -> weighted (honors/AP) GPA conversion table
const GPA_TABLE = [
  { min: 97, unw: 4.0, w: 5.0 },
  { min: 93, unw: 4.0, w: 5.0 },
  { min: 90, unw: 3.7, w: 4.7 },
  { min: 87, unw: 3.3, w: 4.3 },
  { min: 83, unw: 3.0, w: 4.0 },
  { min: 80, unw: 2.7, w: 3.7 },
  { min: 77, unw: 2.3, w: 3.3 },
  { min: 73, unw: 2.0, w: 3.0 },
  { min: 70, unw: 1.7, w: 2.7 },
  { min: 67, unw: 1.3, w: 2.3 },
  { min: 65, unw: 1.0, w: 2.0 },
  { min: -Infinity, unw: 0.0, w: 0.0 }
];

function pctToGpa(pct, honors) {
  const row = GPA_TABLE.find(r => pct >= r.min);
  if (!row) return 0;
  return honors ? row.w : row.unw;
}

let currentMpFilter = "all";

document.getElementById("mp-filter").addEventListener("change", (e) => {
  currentMpFilter = e.target.value;
  renderGrades();
});

function subjectAverage(subject) {
  const entries = currentMpFilter === "all"
    ? subject.entries
    : subject.entries.filter(en => String(en.mp) === currentMpFilter);
  if (entries.length === 0) return null;
  const totalScore = entries.reduce((sum, en) => sum + Number(en.score), 0);
  const totalMax = entries.reduce((sum, en) => sum + Number(en.max), 0);
  if (totalMax === 0) return null;
  return (totalScore / totalMax) * 100;
}

let subjectModalMode = "add";
let editingSubjectId = null;

document.getElementById("add-subject-btn").addEventListener("click", () => {
  subjectModalMode = "add";
  editingSubjectId = null;
  document.getElementById("subj-name").value = "";
  document.getElementById("subj-honors").checked = false;
  openModal("modal-subject");
});

document.getElementById("save-subject-btn").addEventListener("click", () => {
  const name = document.getElementById("subj-name").value.trim();
  if (!name) return;
  const honors = document.getElementById("subj-honors").checked;
  if (subjectModalMode === "add") {
    state.subjects.push({ id: uid(), name, honors, entries: [] });
  } else {
    const subj = state.subjects.find(s => s.id === editingSubjectId);
    if (subj) { subj.name = name; subj.honors = honors; }
  }
  saveState();
  closeModal("modal-subject");
  renderGrades();
});

let entryModalMode = "add";
let entryTargetSubjectId = null;
let entryEditingId = null;

function openEntryModal(subjectId) {
  entryModalMode = "add";
  entryTargetSubjectId = subjectId;
  entryEditingId = null;
  document.getElementById("entry-name").value = "";
  document.getElementById("entry-score").value = "";
  document.getElementById("entry-max").value = "100";
  document.getElementById("entry-mp").value = currentMpFilter !== "all" ? currentMpFilter : "1";
  openModal("modal-entry");
}

document.getElementById("save-entry-btn").addEventListener("click", () => {
  const name = document.getElementById("entry-name").value.trim() || "Assignment";
  const score = parseFloat(document.getElementById("entry-score").value);
  const max = parseFloat(document.getElementById("entry-max").value);
  const mp = document.getElementById("entry-mp").value;
  if (isNaN(score) || isNaN(max) || max <= 0) return;
  const subj = state.subjects.find(s => s.id === entryTargetSubjectId);
  if (!subj) return;
  if (entryModalMode === "add") {
    subj.entries.push({ id: uid(), label: name, score, max, mp });
  } else {
    const en = subj.entries.find(e => e.id === entryEditingId);
    if (en) { en.label = name; en.score = score; en.max = max; en.mp = mp; }
  }
  saveState();
  closeModal("modal-entry");
  renderGrades();
});

function renderGrades() {
  const list = document.getElementById("subjects-list");
  list.innerHTML = "";

  if (state.subjects.length === 0) {
    list.innerHTML = `<div class="empty-state">No subjects yet 🎀<br>Tap "+ Subject" to add your first class!</div>`;
    return;
  }

  const withAvg = state.subjects.map(s => ({ subj: s, avg: subjectAverage(s) }));
  withAvg.sort((a, b) => {
    if (a.avg === null && b.avg === null) return 0;
    if (a.avg === null) return 1;
    if (b.avg === null) return -1;
    return b.avg - a.avg;
  });

  withAvg.forEach((item, idx) => {
    const s = item.subj;
    const avg = item.avg;
    const gpa = avg === null ? null : pctToGpa(avg, s.honors);

    const card = document.createElement("div");
    card.className = "card";

    const entries = currentMpFilter === "all" ? s.entries : s.entries.filter(en => String(en.mp) === currentMpFilter);

    card.innerHTML = `
      <div class="card-header">
        <h3>${escapeHtml(s.name)}</h3>
        <span class="rank-badge">${avg === null ? "—" : "#" + (idx + 1)}</span>
      </div>
      <label class="honors-toggle">
        <input type="checkbox" data-honors="${s.id}" ${s.honors ? "checked" : ""}>
        Honors / AP (5.0 scale)
      </label>
      <div class="subject-stats">
        <div class="stat-chip">
          <span class="num">${avg === null ? "—" : avg.toFixed(1) + "%"}</span>
          <span class="lbl">Average</span>
        </div>
        <div class="stat-chip">
          <span class="num">${gpa === null ? "—" : gpa.toFixed(1)}</span>
          <span class="lbl">${s.honors ? "Weighted GPA" : "GPA"}</span>
        </div>
      </div>
      <div class="entries-wrap"></div>
      <div class="row-actions" style="margin-top:8px; justify-content:space-between;">
        <button class="text-btn" data-add-entry="${s.id}">+ Add Grade</button>
        <button class="icon-btn danger" data-del-subject="${s.id}">✕</button>
      </div>
    `;

    const entriesWrap = card.querySelector(".entries-wrap");
    if (entries.length === 0) {
      entriesWrap.innerHTML = `<div class="empty-state" style="padding:12px;">No grades ${currentMpFilter === "all" ? "yet" : "this term"}.</div>`;
    } else {
      entries.forEach(en => {
        const row = document.createElement("div");
        row.className = "entry-row";
        row.innerHTML = `
          <span class="entry-name">${escapeHtml(en.label)} <span style="color:var(--wine-soft); font-weight:500;">(MP${en.mp})</span></span>
          <span class="entry-score">${en.score}/${en.max}</span>
          <button class="icon-btn danger" data-del-entry="${s.id}|${en.id}" style="width:24px;height:24px;font-size:0.7rem;">✕</button>
        `;
        entriesWrap.appendChild(row);
      });
    }

    list.appendChild(card);
  });

  // wire up dynamic buttons
  list.querySelectorAll("[data-honors]").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const subj = state.subjects.find(s => s.id === e.target.dataset.honors);
      if (subj) { subj.honors = e.target.checked; saveState(); renderGrades(); }
    });
  });
  list.querySelectorAll("[data-add-entry]").forEach(btn => {
    btn.addEventListener("click", () => openEntryModal(btn.dataset.addEntry));
  });
  list.querySelectorAll("[data-del-subject]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this subject and all its grades?")) {
        state.subjects = state.subjects.filter(s => s.id !== btn.dataset.delSubject);
        saveState();
        renderGrades();
      }
    });
  });
  list.querySelectorAll("[data-del-entry]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [subjId, entId] = btn.dataset.delEntry.split("|");
      const subj = state.subjects.find(s => s.id === subjId);
      if (subj) {
        subj.entries = subj.entries.filter(e => e.id !== entId);
        saveState();
        renderGrades();
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   CALENDAR
   ============================================================ */

let calView = "month";
let calRefDate = new Date(); // controls which month/week/day we're looking at
let selectedDay = new Date(); // for month view day selection

document.querySelectorAll("[data-calview]").forEach(btn => {
  btn.addEventListener("click", () => {
    calView = btn.dataset.calview;
    document.querySelectorAll("[data-calview]").forEach(b => b.classList.toggle("active", b === btn));
    renderCalendar();
  });
});

document.getElementById("cal-prev").addEventListener("click", () => shiftCal(-1));
document.getElementById("cal-next").addEventListener("click", () => shiftCal(1));

function shiftCal(dir) {
  if (calView === "month") calRefDate.setMonth(calRefDate.getMonth() + dir);
  else if (calView === "week") calRefDate.setDate(calRefDate.getDate() + dir * 7);
  else calRefDate.setDate(calRefDate.getDate() + dir);
  renderCalendar();
}

function dateKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function tasksOnDate(d) {
  const key = dateKey(d);
  return state.tasks.filter(t => !t.completed && t.due.slice(0,10) === key);
}

function overdueTasks(beforeDate) {
  const key = dateKey(beforeDate);
  return state.tasks.filter(t => !t.completed && t.due.slice(0,10) < key)
    .sort((a,b) => a.due.localeCompare(b.due));
}

function highestPriority(tasks) {
  if (tasks.some(t => t.priority === "urgent")) return "urgent";
  if (tasks.some(t => t.priority === "important")) return "important";
  if (tasks.length) return "todo";
  return null;
}

let taskModalMode = "add";
let editingTaskId = null;
let taskDefaultDate = null;

document.getElementById("add-task-btn").addEventListener("click", () => {
  taskModalMode = "add";
  editingTaskId = null;
  document.getElementById("task-title").value = "";
  const base = calView === "day" || calView === "week" ? calRefDate : selectedDay;
  document.getElementById("task-date").value = dateKey(base);
  document.getElementById("task-time").value = "15:00";
  document.querySelector('input[name="task-priority"][value="todo"]').checked = true;
  updatePriorityChoiceUI();
  openModal("modal-task");
});

document.getElementById("save-task-btn").addEventListener("click", () => {
  const title = document.getElementById("task-title").value.trim();
  const date = document.getElementById("task-date").value;
  const time = document.getElementById("task-time").value || "23:59";
  const priority = document.querySelector('input[name="task-priority"]:checked').value;
  if (!title || !date) return;
  const due = `${date}T${time}`;
  if (taskModalMode === "add") {
    state.tasks.push({ id: uid(), title, due, priority, completed: false });
  } else {
    const t = state.tasks.find(t => t.id === editingTaskId);
    if (t) { t.title = title; t.due = due; t.priority = priority; }
  }
  saveState();
  closeModal("modal-task");
  renderCalendar();
  renderBanner();
});

function openTaskEdit(taskId) {
  const t = state.tasks.find(t => t.id === taskId);
  if (!t) return;
  taskModalMode = "edit";
  editingTaskId = taskId;
  document.getElementById("task-title").value = t.title;
  document.getElementById("task-date").value = t.due.slice(0,10);
  document.getElementById("task-time").value = t.due.slice(11,16);
  document.querySelector(`input[name="task-priority"][value="${t.priority}"]`).checked = true;
  updatePriorityChoiceUI();
  openModal("modal-task");
}

function toggleTaskComplete(taskId) {
  const t = state.tasks.find(t => t.id === taskId);
  if (t) {
    t.completed = true;
    saveState();
    renderCalendar();
    renderBanner();
  }
}
function deleteTask(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveState();
  renderCalendar();
  renderBanner();
}

function renderCalendar() {
  document.getElementById("cal-month-view").classList.toggle("hidden", calView !== "month");
  document.getElementById("cal-week-view").classList.toggle("hidden", calView !== "week");
  document.getElementById("cal-day-view").classList.toggle("hidden", calView !== "day");

  if (calView === "month") renderMonthView();
  else if (calView === "week") renderWeekView();
  else renderDayView();
}

function renderMonthView() {
  const year = calRefDate.getFullYear();
  const month = calRefDate.getMonth();
  document.getElementById("cal-title").textContent = `${MONTH_NAMES[month]} ${year}`;

  const container = document.getElementById("cal-month-view");
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "month-grid";
  DOW_SHORT.forEach(d => {
    const dow = document.createElement("div");
    dow.className = "dow";
    dow.textContent = d;
    grid.appendChild(dow);
  });

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    const cellDate = new Date(year, month, dayNum);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (dayNum < 1 || dayNum > daysInMonth) cell.classList.add("dim");
    if (isSameDay(cellDate, today)) cell.classList.add("today");
    if (isSameDay(cellDate, selectedDay)) cell.classList.add("selected");

    const tasks = tasksOnDate(cellDate);
    const dotsHtml = tasks.slice(0,3).map(t => `<span class="dot ${t.priority}"></span>`).join("");

    cell.innerHTML = `<span>${cellDate.getDate()}</span><div class="dot-row">${dotsHtml}</div>`;
    cell.addEventListener("click", () => {
      selectedDay = cellDate;
      renderMonthView();
      renderMonthAgenda(cellDate);
    });
    grid.appendChild(cell);
  }

  container.appendChild(grid);

  const agendaWrap = document.createElement("div");
  agendaWrap.id = "month-agenda";
  container.appendChild(agendaWrap);
  renderMonthAgenda(selectedDay);
}

function renderMonthAgenda(d) {
  const wrap = document.getElementById("month-agenda");
  if (!wrap) return;
  wrap.innerHTML = `<div class="section-label">${DOW_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}</div>`;
  const tasks = tasksOnDate(d).sort((a,b) => a.due.localeCompare(b.due));
  if (tasks.length === 0) {
    wrap.innerHTML += `<div class="empty-state">No tasks on this day 🌸</div>`;
  } else {
    tasks.forEach(t => wrap.appendChild(buildTaskItem(t)));
  }
}

function renderWeekView() {
  const start = startOfWeek(calRefDate);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  document.getElementById("cal-title").textContent =
    `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;

  const container = document.getElementById("cal-week-view");
  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "week-grid";

  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const block = document.createElement("div");
    block.className = "week-day-block";
    const tasks = tasksOnDate(d).sort((a,b) => a.due.localeCompare(b.due));
    block.innerHTML = `<div class="wd-title">${DOW_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}</div>`;
    if (tasks.length === 0) {
      block.innerHTML += `<div class="empty-state" style="padding:10px;">Nothing due</div>`;
    } else {
      tasks.forEach(t => block.appendChild(buildTaskItem(t)));
    }
    grid.appendChild(block);
  }
  container.appendChild(grid);
}

function renderDayView() {
  const d = calRefDate;
  document.getElementById("cal-title").textContent = `${DOW_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

  const container = document.getElementById("cal-day-view");
  container.innerHTML = "";

  const overdue = overdueTasks(d);
  if (overdue.length > 0) {
    const label = document.createElement("div");
    label.className = "section-label";
    label.textContent = "Overdue — finish these! 💦";
    container.appendChild(label);
    overdue.forEach(t => container.appendChild(buildTaskItem(t, true)));
  }

  const label2 = document.createElement("div");
  label2.className = "section-label";
  label2.textContent = "Today";
  container.appendChild(label2);

  const tasks = tasksOnDate(d).sort((a,b) => a.due.localeCompare(b.due));
  if (tasks.length === 0) {
    container.innerHTML += `<div class="empty-state">Nothing due today 🎀</div>`;
  } else {
    tasks.forEach(t => container.appendChild(buildTaskItem(t)));
  }
}

function buildTaskItem(t, overdue) {
  const item = document.createElement("div");
  item.className = "task-item" + (overdue ? " overdue" : "");
  const timeStr = t.due.slice(11,16);
  const dateStr = overdue ? ` · ${t.due.slice(5,10)}` : "";
  item.innerHTML = `
  <div class="check-circle" data-complete="${t.id}"></div>

  <div class="task-body" data-edit="${t.id}">
    <div class="task-title">${escapeHtml(t.title)}</div>
    <div class="task-meta">${timeStr}${dateStr} · ${t.priority}</div>
  </div>

  <span class="priority-dot ${t.priority}"></span>

  <button class="icon-btn danger" data-delete-task="${t.id}" aria-label="Delete task">
    🗑️
  </button>
`;
  item.querySelector("[data-complete]").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleTaskComplete(t.id);
});

item.querySelector("[data-edit]").addEventListener("click", () => openTaskEdit(t.id));

item.querySelector("[data-delete-task]").addEventListener("click", (e) => {
  e.stopPropagation();

  if (confirm(`Delete "${t.title}"?`)) {
    deleteTask(t.id);
  }
});

return item;

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d) {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0,0,0,0);
  return s;
}

/* ============================================================
   SCHEDULE
   ============================================================ */

let selectedSchedDay = new Date().getDay();

function renderScheduleTabs() {
  const tabs = document.getElementById("sched-day-tabs");
  tabs.innerHTML = "";
  DOW_SHORT.forEach((d, idx) => {
    const btn = document.createElement("button");
    btn.textContent = d;
    if (idx === selectedSchedDay) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedSchedDay = idx;
      renderSchedule();
    });
    tabs.appendChild(btn);
  });
}

let blockModalMode = "add";
let editingBlockId = null;

document.getElementById("add-block-btn").addEventListener("click", () => {
  blockModalMode = "add";
  editingBlockId = null;
  document.getElementById("block-title").value = "";
  document.getElementById("block-sub").value = "";
  document.getElementById("block-start").value = "08:00";
  document.getElementById("block-end").value = "09:00";
  openModal("modal-block");
});

document.getElementById("save-block-btn").addEventListener("click", () => {
  const title = document.getElementById("block-title").value.trim();
  const sub = document.getElementById("block-sub").value.trim();
  const start = document.getElementById("block-start").value;
  const end = document.getElementById("block-end").value;
  if (!title || !start || !end) return;
  if (blockModalMode === "add") {
    state.schedule.push({ id: uid(), day: selectedSchedDay, title, sub, start, end });
  } else {
    const b = state.schedule.find(b => b.id === editingBlockId);
    if (b) { b.title = title; b.sub = sub; b.start = start; b.end = end; }
  }
  saveState();
  closeModal("modal-block");
  renderSchedule();
  renderBanner();
});

function openBlockEdit(blockId) {
  const b = state.schedule.find(b => b.id === blockId);
  if (!b) return;
  blockModalMode = "edit";
  editingBlockId = blockId;
  document.getElementById("block-title").value = b.title;
  document.getElementById("block-sub").value = b.sub || "";
  document.getElementById("block-start").value = b.start;
  document.getElementById("block-end").value = b.end;
  openModal("modal-block");
}

function renderSchedule() {
  renderScheduleTabs();
  const wrap = document.getElementById("sched-blocks");
  wrap.innerHTML = "";
  const blocks = state.schedule
    .filter(b => b.day === selectedSchedDay)
    .sort((a,b) => a.start.localeCompare(b.start));

  if (blocks.length === 0) {
    wrap.innerHTML = `<div class="empty-state">No classes added for ${DOW_FULL[selectedSchedDay]} yet 🌷</div>`;
    return;
  }

  blocks.forEach(b => {
    const el = document.createElement("div");
    el.className = "sched-block";
    el.innerHTML = `
      <div style="flex:1;" data-edit-block="${b.id}">
        <div class="sb-time">${b.start} – ${b.end}</div>
        <div class="sb-title">${escapeHtml(b.title)}</div>
        ${b.sub ? `<div class="sb-sub">${escapeHtml(b.sub)}</div>` : ""}
      </div>
      <button class="icon-btn danger" data-del-block="${b.id}">✕</button>
    `;
    el.querySelector("[data-edit-block]").addEventListener("click", () => openBlockEdit(b.id));
    el.querySelector("[data-del-block]").addEventListener("click", () => {
      state.schedule = state.schedule.filter(x => x.id !== b.id);
      saveState();
      renderSchedule();
      renderBanner();
    });
    wrap.appendChild(el);
  });
}

/* ============================================================
   DASHBOARD BANNER
   ============================================================ */

function renderBanner() {
  const now = new Date();

  // Next upcoming incomplete task
  const upcoming = state.tasks
    .filter(t => !t.completed)
    .sort((a,b) => a.due.localeCompare(b.due))
    .find(t => new Date(t.due) >= now) || state.tasks
    .filter(t => !t.completed)
    .sort((a,b) => a.due.localeCompare(b.due))[0];

  const nextEl = document.getElementById("banner-next-task");
  if (upcoming) {
    const due = new Date(upcoming.due);
    const overdue = due < now;
    const dateStr = isSameDay(due, now) ? `today at ${upcoming.due.slice(11,16)}` :
      `${MONTH_NAMES[due.getMonth()]} ${due.getDate()} at ${upcoming.due.slice(11,16)}`;
    nextEl.innerHTML = `${overdue ? "Overdue: " : "Next up: "}<b>${escapeHtml(upcoming.title)}</b> — ${dateStr}`;
  } else {
    nextEl.textContent = "No upcoming tasks — you're all caught up! 🎀";
  }

  // Current schedule block
  const dayIdx = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todaysBlocks = state.schedule.filter(b => b.day === dayIdx);
  const current = todaysBlocks.find(b => {
    const [sh, sm] = b.start.split(":").map(Number);
    const [eh, em] = b.end.split(":").map(Number);
    const s = sh * 60 + sm, e = eh * 60 + em;
    return nowMins >= s && nowMins < e;
  });

  const classEl = document.getElementById("banner-current-class");
  if (current) {
    classEl.innerHTML = `Right now: <b>${escapeHtml(current.title)}</b>${current.sub ? " — " + escapeHtml(current.sub) : ""}`;
  } else {
    const next = todaysBlocks
      .filter(b => {
        const [sh, sm] = b.start.split(":").map(Number);
        return (sh * 60 + sm) > nowMins;
      })
      .sort((a,b) => a.start.localeCompare(b.start))[0];
    if (next) {
      classEl.innerHTML = `Up next: <b>${escapeHtml(next.title)}</b> at ${next.start}`;
    } else {
      classEl.textContent = "No more classes scheduled today 🌸";
    }
  }
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  renderBanner();
  renderGrades();
  renderCalendar();
  renderSchedule();
   setupInspiration();
  setInterval(renderBanner, 60000); // refresh every minute

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
/* =========================================================
   DAILY INSPIRATION
   ========================================================= */

function renderInspiration() {
  const photo = document.getElementById("inspiration-photo");
  const placeholder = document.getElementById("inspiration-placeholder");
  const quote = document.getElementById("inspiration-quote");
  const removePhotoBtn = document.getElementById(
    "inspiration-remove-photo-btn"
  );

  if (!photo || !placeholder || !quote) return;

  // Make sure older saved data gets the new inspiration object.
  if (!state.inspiration) {
    state.inspiration = {
      image: "",
      quote: ""
    };
  }

  // Load saved quote.
  quote.value = state.inspiration.quote || "";

  // Load saved photo.
  if (state.inspiration.image) {
    photo.src = state.inspiration.image;
    photo.style.display = "block";
    placeholder.style.display = "none";

    if (removePhotoBtn) {
      removePhotoBtn.hidden = false;
    }
  } else {
    photo.removeAttribute("src");
    photo.style.display = "none";
    placeholder.style.display = "flex";

    if (removePhotoBtn) {
      removePhotoBtn.hidden = true;
    }
  }
}


function setupInspiration() {
  const photoInput = document.getElementById("inspiration-photo-input");
  const photoBtn = document.getElementById("inspiration-photo-btn");
  const removePhotoBtn = document.getElementById(
    "inspiration-remove-photo-btn"
  );
  const saveQuoteBtn = document.getElementById("inspiration-save-btn");
  const quoteInput = document.getElementById("inspiration-quote");
  const status = document.getElementById("inspiration-status");

  if (!photoInput || !photoBtn || !saveQuoteBtn) return;

  /*
   * Make sure inspiration exists even if the app was installed
   * before this feature was added.
   */
  if (!state.inspiration) {
    state.inspiration = {
      image: "",
      quote: ""
    };
    saveState();
  }

  /*
   * Choose Photo
   *
   * On iPhone, accept="image/*" opens the normal photo/media
   * picker, allowing the user to choose an image from Photos.
   */
  photoBtn.addEventListener("click", () => {
    photoInput.click();
  });


  /*
   * Photo selected
   *
   * The original iPhone photo can be very large, so we resize
   * it before saving. This prevents localStorage from filling
   * up with a huge original camera image.
   */
  photoInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (status) {
        status.textContent = "Please choose an image.";
      }
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const MAX_SIZE = 1200;

        let width = image.naturalWidth;
        let height = image.naturalHeight;

        /*
         * Keep the original aspect ratio while reducing the
         * longest side to 1200px.
         */
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height / width) * MAX_SIZE);
            width = MAX_SIZE;
          } else {
            width = Math.round((width / height) * MAX_SIZE);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Could not create image canvas.");
        }

        context.drawImage(image, 0, 0, width, height);

        /*
         * JPEG compression dramatically reduces the amount of
         * storage required compared with the original iPhone
         * image.
         */
        const compressedImage = canvas.toDataURL(
          "image/jpeg",
          0.82
        );

        state.inspiration.image = compressedImage;

        saveState();
        renderInspiration();

        if (status) {
          status.textContent = "Photo saved 💕";
        }
      } catch (error) {
        console.error("Could not process inspiration photo:", error);

        if (status) {
          status.textContent =
            "Sorry, that photo could not be added.";
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      if (status) {
        status.textContent =
          "Sorry, that photo could not be opened.";
      }
    };

    image.src = objectUrl;

    // Allow the same photo to be selected again later.
    photoInput.value = "";
  });


  /*
   * Remove Photo
   */
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener("click", () => {
      state.inspiration.image = "";

      saveState();
      renderInspiration();

      if (status) {
        status.textContent = "Photo removed.";
      }
    });
  }


  /*
   * Save Quote
   */
  saveQuoteBtn.addEventListener("click", () => {
    state.inspiration.quote = quoteInput.value.trim();

    saveState();

    if (status) {
      status.textContent = "Quote saved 💗";

      window.setTimeout(() => {
        if (status.textContent === "Quote saved 💗") {
          status.textContent = "";
        }
      }, 2000);
    }
  });


  /*
   * Clear the little status message when the user starts
   * editing the quote again.
   */
  quoteInput.addEventListener("input", () => {
    if (status) {
      status.textContent = "";
    }
  });

  renderInspiration();
}
init();

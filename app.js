const DB_NAME = "fitness-tracker-db";
const DB_VERSION = 1;
const STORES = ["workouts", "measurements", "photos"];
const state = {
  db: null,
  workouts: [],
  measurements: [],
  photos: [],
  homeRange: "30",
  bodyRange: "30",
  draftPhotoData: "",
  chartPoints: {},
  activeChartPoint: {},
};

const RANGE_LABELS = {
  30: "过去 30 天",
  90: "3 个月",
  180: "半年",
  365: "1 年",
  1825: "5 年",
  all: "All time",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });
}

function num(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = "readonly") {
  return state.db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadData() {
  const [workouts, measurements, photos] = await Promise.all([
    getAll("workouts"),
    getAll("measurements"),
    getAll("photos"),
  ]);
  state.workouts = workouts.sort((a, b) => b.date.localeCompare(a.date));
  state.measurements = measurements.sort((a, b) => b.date.localeCompare(a.date));
  state.photos = photos.sort((a, b) => b.date.localeCompare(a.date));
  render();
}

function render() {
  renderHome();
  renderWorkouts();
  renderMeasurements();
  renderPhotos();
  drawCharts();
}

function renderHome() {
  $("#todayLabel").textContent = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const latest = state.measurements[0];
  const previous = state.measurements[1];
  $("#latestWeight").textContent = latest?.weight ? `${latest.weight} kg` : "--";
  $("#latestWaist").textContent = latest?.waist ? `${latest.waist} cm` : "--";
  $("#weightDelta").textContent = deltaText(latest?.weight, previous?.weight, "kg");
  $("#waistDelta").textContent = deltaText(latest?.waist, previous?.waist, "cm");

  const recent = state.workouts[0];
  const target = $("#recentWorkout");
  if (!recent) {
    target.className = "empty-state";
    target.textContent = "还没有训练记录";
    target.removeAttribute("data-edit-workout");
    target.removeAttribute("role");
    target.removeAttribute("tabindex");
    return;
  }
  target.className = "timeline-item clickable-item";
  target.dataset.editWorkout = recent.id;
  target.setAttribute("role", "button");
  target.setAttribute("tabindex", "0");
  const setCount = recent.exercises.reduce((sum, item) => sum + (item.setCount || item.sets.length), 0);
  target.innerHTML = `
    <div class="timeline-title">
      <div>
        <strong>${escapeHtml(recent.title)}</strong>
        <span class="timeline-meta">${formatDate(recent.date)}</span>
      </div>
      <button class="text-button" type="button" data-edit-workout="${recent.id}">详情</button>
    </div>
    <div class="chip-row">
      <span class="chip">${recent.exercises.length} 个动作</span>
      <span class="chip">${setCount} 组</span>
      ${recent.durationMinutes ? `<span class="chip">${recent.durationMinutes} 分钟</span>` : ""}
    </div>
  `;
}

function deltaText(current, previous, unit) {
  if (current === undefined || previous === undefined) return "暂无变化";
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return "与上次相同";
  return `${delta > 0 ? "+" : ""}${delta} ${unit} 较上次`;
}

function renderWorkouts() {
  const list = $("#workoutList");
  if (!state.workouts.length) {
    list.innerHTML = `<div class="empty-state">先记录一次训练，后面就能看到历史</div>`;
    return;
  }
  list.innerHTML = state.workouts.map((workout) => {
    const setCount = workout.exercises.reduce((sum, item) => sum + (item.setCount || item.sets.length), 0);
    return `
      <article class="timeline-item clickable-item" data-edit-workout="${workout.id}" role="button" tabindex="0">
        <div class="timeline-title">
          <div>
            <strong>${escapeHtml(workout.title)}</strong>
            <span class="timeline-meta">${formatDate(workout.date)}</span>
          </div>
          <div class="item-actions">
            <button class="text-button" type="button" data-edit-workout="${workout.id}">详情</button>
            <button class="danger-link" type="button" data-delete-workout="${workout.id}">删除</button>
          </div>
        </div>
        ${workout.notes ? `<p class="muted">${escapeHtml(workout.notes)}</p>` : ""}
        <div class="chip-row">
          <span class="chip">${workout.exercises.length} 个动作</span>
          <span class="chip">${setCount} 组</span>
          ${workout.durationMinutes ? `<span class="chip">${workout.durationMinutes} 分钟</span>` : ""}
          ${workout.intensity ? `<span class="chip">强度 ${workout.intensity}/10</span>` : ""}
        </div>
        <div class="chip-row">
          ${workout.exercises.slice(0, 4).map((item) => `<span class="chip">${escapeHtml(formatExerciseSummary(item))}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function formatExerciseSummary(exercise) {
  const set = exercise.sets?.[0] || {};
  const parts = [exercise.name];
  if (set.weight) parts.push(`${set.weight} lb`);
  if (set.reps) parts.push(`${set.reps} 次`);
  if (exercise.setCount) parts.push(`${exercise.setCount} 组`);
  return parts.join(" · ");
}

function renderMeasurements() {
  const list = $("#bodyList");
  if (!state.measurements.length) {
    list.innerHTML = `<div class="empty-state">记录体重和腰围后，这里会显示趋势</div>`;
    return;
  }
  list.innerHTML = state.measurements.map((item) => `
    <article class="timeline-item">
      <div class="timeline-title">
        <div>
          <strong>${formatDate(item.date)}</strong>
          <span class="timeline-meta">${item.notes ? escapeHtml(item.notes) : "身体数据"}</span>
        </div>
        <button class="text-button" type="button" data-edit-body="${item.id}">编辑</button>
      </div>
      <div class="chip-row">
        ${item.weight ? `<span class="chip">体重 ${item.weight} kg</span>` : ""}
        ${item.waist ? `<span class="chip">腰围 ${item.waist} cm</span>` : ""}
        ${item.bodyFat ? `<span class="chip">体脂 ${item.bodyFat}%</span>` : ""}
      </div>
    </article>
  `).join("");
}

function renderPhotos() {
  const grid = $("#photoGrid");
  if (!state.photos.length) {
    grid.innerHTML = `<div class="empty-state">上传第一张照片，开始记录身材变化</div>`;
    return;
  }
  const label = { front: "正面", side: "侧面", back: "背面", other: "其他" };
  grid.innerHTML = state.photos.map((photo) => `
    <article class="photo-card">
      <button type="button" data-edit-photo="${photo.id}">
        <img src="${photo.imageData}" alt="${formatDate(photo.date)} ${label[photo.angle] || "照片"}" loading="lazy" />
        <div class="photo-caption">
          <strong>${formatDate(photo.date)}</strong>
          <span class="timeline-meta">${label[photo.angle] || "其他"}${photo.weight ? ` · ${photo.weight} kg` : ""}</span>
        </div>
      </button>
    </article>
  `).join("");
}

function drawCharts() {
  const homeData = filterMeasurements(state.homeRange);
  const globalAxis = buildGlobalMeasurementAxis();
  drawLineChart($("#homeChart"), homeData, false, "home", globalAxis);
  drawLineChart($("#bodyChart"), filterMeasurements(state.bodyRange), false, "body", globalAxis);
  $("#homeTrendTitle").textContent = `${RANGE_LABELS[state.homeRange]}趋势`;
}

function filterMeasurements(range) {
  const items = [...state.measurements].reverse();
  if (range === "all") return items;
  const days = Number(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter((item) => new Date(`${item.date}T00:00:00`) >= cutoff);
}

function drawLineChart(canvas, data, compact, chartId, globalAxis) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssHeight = getChartCssHeight(canvas);
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.max(320, rect.width) * ratio;
  canvas.height = cssHeight * ratio;
  ctx.scale(ratio, ratio);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  ctx.clearRect(0, 0, width, height);
  state.chartPoints[chartId] = [];
  ctx.fillStyle = "#66736d";
  ctx.font = "14px sans-serif";
  if (!data.length) {
    ctx.fillText("暂无身体数据", 18, 32);
    return;
  }

  const series = [
    { key: "weight", label: "体重", color: "#1f6f5b", unit: "kg" },
    { key: "waist", label: "腰围", color: "#c96f36", unit: "cm" },
  ].map((s) => ({ ...s, points: data.filter((item) => item[s.key]).map((item) => ({ date: item.date, value: item[s.key] })) }))
    .filter((s) => s.points.length);

  if (!series.length) {
    ctx.fillText("暂无可绘制的数据", 18, 32);
    return;
  }

  const left = compact ? 50 : 58;
  const right = compact ? 76 : 78;
  const top = compact ? 26 : 32;
  const bottom = compact ? 58 : 68;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const dates = data.map((item) => item.date);
  const xPad = dates.length <= 1 ? 0 : Math.min(compact ? 22 : 30, plotW * 0.12);
  const xFor = (date) => {
    const index = dates.indexOf(date);
    return left + (dates.length <= 1 ? plotW / 2 : xPad + (index / (dates.length - 1)) * (plotW - xPad * 2));
  };
  const yTicks = compact ? 3 : 5;
  const sharedAxis = globalAxis || buildAxis(series.flatMap((s) => s.points.map((point) => point.value)), yTicks);
  const axisByKey = Object.fromEntries(series.map((s) => [s.key, sharedAxis]));
  const yFor = (seriesKey, value) => {
    const axis = axisByKey[seriesKey];
    return top + (1 - (value - axis.min) / (axis.max - axis.min)) * plotH;
  };

  ctx.font = "11px sans-serif";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#e6ece8";
  ctx.lineWidth = 1;
  for (let i = 0; i < yTicks; i += 1) {
    const y = top + (plotH / (yTicks - 1)) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
  }

  const weightSeries = series.find((s) => s.key === "weight");
  const waistSeries = series.find((s) => s.key === "waist");
  ctx.lineWidth = 1;
  drawYAxis(ctx, sharedAxis, left, top, plotH, yTicks, "left", weightSeries?.color || "#9eaaa4", "体重/kg");
  drawYAxis(ctx, sharedAxis, width - right, top, plotH, yTicks, "right", waistSeries?.color || "#9eaaa4", "腰围/cm");

  ctx.strokeStyle = "#bac6c0";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + plotH);
  ctx.lineTo(width - right, top + plotH);
  ctx.lineTo(width - right, top);
  ctx.stroke();

  const firstDate = data[0]?.date;
  const lastDate = data.at(-1)?.date;
  ctx.fillStyle = "#66736d";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  if (firstDate) {
    const firstX = xFor(firstDate);
    ctx.textAlign = dates.length <= 1 ? "center" : "left";
    ctx.fillText(formatAxisDate(firstDate), firstX, top + plotH + 10);
  }
  if (lastDate && lastDate !== firstDate) {
    ctx.textAlign = "right";
    ctx.fillText(formatAxisDate(lastDate), xFor(lastDate), top + plotH + 10);
  }

  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    s.points.forEach((point, index) => {
      const x = xFor(point.date);
      const y = yFor(s.key, point.value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  series.forEach((s) => {
    s.points.forEach((point) => {
      const x = xFor(point.date);
      const y = yFor(s.key, point.value);
      const labelPosition = getPointLabelPosition(series, point.date, s.key, yFor);
      state.chartPoints[chartId].push({
        x,
        y,
        date: point.date,
        label: s.label,
        value: point.value,
        unit: s.unit,
        color: s.color,
      });
      ctx.beginPath();
      ctx.fillStyle = s.color;
      ctx.arc(x, y, compact ? 4 : 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      drawPointLabel(ctx, formatAxisValue(point.value), x, y, s.color, labelPosition, compact, {
        left,
        right: width - right,
        top,
        bottom: top + plotH,
      });
    });
  });

  const activePoint = state.activeChartPoint[chartId];
  if (activePoint) {
    drawChartTooltip(ctx, activePoint, width, height);
  }

  ctx.textBaseline = "alphabetic";
}

function getChartCssHeight(canvas) {
  return 260;
}

function buildAxis(values, ticks = 5) {
  if (!values.length) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minSpan = 36;
  const span = Math.max((max - min) * 1.8, minSpan);
  const center = (max + min) / 2;
  const rawMin = center - span / 2;
  const rawMax = center + span / 2;
  const step = niceStep((rawMax - rawMin) / Math.max(ticks - 1, 1));
  return {
    min: Math.floor(rawMin / step) * step,
    max: Math.ceil(rawMax / step) * step,
  };
}

function buildGlobalMeasurementAxis() {
  const values = state.measurements.flatMap((item) => [item.weight, item.waist].filter((value) => value !== undefined));
  return values.length ? buildAxis(values, 5) : null;
}

function niceStep(value) {
  const exponent = Math.floor(Math.log10(value || 1));
  const fraction = value / 10 ** exponent;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * 10 ** exponent;
}

function getPointLabelPosition(series, date, key, yFor) {
  const points = series
    .map((s) => {
      const point = s.points.find((item) => item.date === date);
      return point ? { key: s.key, y: yFor(s.key, point.value) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);

  if (points.length <= 1) return "above";
  const top = points[0];
  const bottom = points[points.length - 1];
  if (Math.abs(top.y - bottom.y) < 8) return key === "weight" ? "above" : "below";
  if (key === top.key) return "above";
  if (key === bottom.key) return "below";
  return "above";
}

function drawPointLabel(ctx, text, x, y, color, position, compact, bounds) {
  ctx.font = compact ? "11px sans-serif" : "12px sans-serif";
  const metrics = ctx.measureText(text);
  const padX = 4;
  const boxW = metrics.width + padX * 2;
  const boxH = 16;
  const minX = (bounds?.left ?? 0) + boxW / 2 + 4;
  const maxX = (bounds?.right ?? x) - boxW / 2 - 4;
  const labelX = Math.min(Math.max(x, minX), Math.max(minX, maxX));
  let labelY = y + (position === "above" ? -16 : 14);
  const topLimit = (bounds?.top ?? 0) + 4;
  const bottomLimit = (bounds?.bottom ?? Number.POSITIVE_INFINITY) - 4;
  if (position === "above" && labelY - boxH + 4 < topLimit) labelY = topLimit + boxH - 4;
  if (position === "below" && labelY + boxH - 4 > bottomLimit) labelY = bottomLimit - boxH + 4;
  const boxX = labelX - boxW / 2;
  const boxY = position === "above" ? labelY - boxH + 4 : labelY - 4;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = position === "above" ? "bottom" : "top";
  ctx.fillText(text, labelX, labelY);
}

function drawChartTooltip(ctx, point, width, height) {
  const title = formatAxisDate(point.date);
  const detail = `${point.label} ${formatAxisValue(point.value)} ${point.unit}`;
  ctx.font = "12px sans-serif";
  const boxW = Math.max(ctx.measureText(title).width, ctx.measureText(detail).width) + 20;
  const boxH = 44;
  const boxX = Math.min(Math.max(point.x - boxW / 2, 8), width - boxW - 8);
  const boxY = point.y > height / 2 ? point.y - boxH - 18 : point.y + 18;

  ctx.fillStyle = "rgba(24, 33, 29, 0.92)";
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(title, boxX + 10, boxY + 7);
  ctx.fillStyle = point.color;
  ctx.fillText(detail, boxX + 10, boxY + 25);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawYAxis(ctx, axis, x, top, plotH, ticks, side, color, title) {
  if (!axis) return;
  ctx.font = "11px sans-serif";
  ctx.fillStyle = color;
  ctx.textBaseline = "bottom";
  ctx.textAlign = side === "left" ? "right" : "left";
  ctx.fillText(title, side === "left" ? x - 8 : x + 8, top - 7);
  ctx.textBaseline = "middle";
  for (let i = 0; i < ticks; i += 1) {
    const y = top + (plotH / (ticks - 1)) * i;
    const value = axis.max - ((axis.max - axis.min) / (ticks - 1)) * i;
    ctx.fillStyle = color;
    ctx.textAlign = side === "left" ? "right" : "left";
    ctx.fillText(formatAxisValue(value), side === "left" ? x - 8 : x + 8, y);
  }
}

function setupChartInteractions() {
  [
    { canvas: $("#homeChart"), chartId: "home" },
    { canvas: $("#bodyChart"), chartId: "body" },
  ].forEach(({ canvas, chartId }) => {
    canvas.addEventListener("mousemove", (event) => {
      const point = findNearestChartPoint(canvas, chartId, event);
      if (state.activeChartPoint[chartId] !== point) {
        state.activeChartPoint[chartId] = point;
        drawCharts();
      }
      canvas.style.cursor = point ? "pointer" : "default";
    });
    canvas.addEventListener("mouseleave", () => {
      if (state.activeChartPoint[chartId]) {
        state.activeChartPoint[chartId] = null;
        drawCharts();
      }
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("click", (event) => {
      state.activeChartPoint[chartId] = findNearestChartPoint(canvas, chartId, event);
      drawCharts();
    });
  });
}

function findNearestChartPoint(canvas, chartId, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const points = state.chartPoints[chartId] || [];
  let nearest = null;
  let nearestDistance = Infinity;
  points.forEach((point) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= 18 ? nearest : null;
}

function formatAxisValue(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatAxisDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`;
}

function setupNavigation() {
  $$("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.nav;
      $$(".view").forEach((view) => view.classList.remove("active"));
      $(`#view-${target}`).classList.add("active");
      $$(".bottom-nav button").forEach((item) => item.classList.toggle("active", item.dataset.nav === target));
      drawCharts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function setupDialogs() {
  $$("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openCreateDialog(button.dataset.open));
  });
  $$("[data-close]").forEach((button) => {
    button.addEventListener("click", () => $(`#${button.dataset.close}`).close());
  });
  $("#backupButton").addEventListener("click", () => $("#backupDialog").showModal());
}

function openCreateDialog(id) {
  if (id === "workoutDialog") resetWorkoutForm();
  if (id === "bodyDialog") resetBodyForm();
  if (id === "photoDialog") resetPhotoForm();
  $(`#${id}`).showModal();
}

function resetWorkoutForm(workout) {
  $("#workoutDialogTitle").textContent = workout ? "编辑训练" : "记录训练";
  $("#workoutId").value = workout?.id || "";
  $("#workoutDate").value = workout?.date || today();
  $("#workoutTitle").value = workout?.title || "";
  $("#workoutDuration").value = workout?.durationMinutes || "";
  $("#workoutIntensity").value = workout?.intensity || "";
  $("#workoutNotes").value = workout?.notes || "";
  $("#deleteWorkoutButton").classList.toggle("hidden", !workout);
  $("#exerciseEditor").innerHTML = "";
  (workout?.exercises || [newExercise()]).forEach((exercise) => addExerciseEditor(exercise));
}

function newExercise() {
  return { id: uid(), name: "", type: "strength", setCount: "", sets: [{ id: uid(), weight: "", reps: "", distance: "", notes: "" }], notes: "" };
}

function addExerciseEditor(exercise = newExercise()) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.dataset.exerciseId = exercise.id || uid();
  const firstSet = exercise.sets?.[0] || {};
  card.dataset.setId = firstSet.id || uid();
  card.innerHTML = `
    <div class="field-row">
      <label>动作名称<input class="exercise-name" type="text" value="${escapeAttr(exercise.name || "")}" placeholder="例如 卧推" required /></label>
      <label>类型
        <select class="exercise-type">
          <option value="strength">重量次数</option>
          <option value="cardio">有氧</option>
          <option value="other">其他</option>
        </select>
      </label>
    </div>
    <div class="exercise-metrics">
      <label>重量 lb<input class="exercise-weight" type="number" step="0.5" min="0" inputmode="decimal" value="${firstSet.weight || ""}" /></label>
      <label>次数<input class="exercise-reps" type="number" step="1" min="0" inputmode="numeric" value="${firstSet.reps || ""}" /></label>
      <label>组数<input class="exercise-set-count" type="number" step="1" min="0" inputmode="numeric" value="${exercise.setCount || exercise.sets?.length || ""}" placeholder="例如 4" /></label>
    </div>
    <label>备注<input class="exercise-notes" type="text" value="${escapeAttr(exercise.notes || firstSet.notes || "")}" /></label>
    <div class="dialog-actions">
      <button class="danger-button remove-exercise" type="button">删除动作</button>
    </div>
  `;
  $(".exercise-type", card).value = exercise.type === "timed" ? "cardio" : exercise.type || "strength";
  $("#exerciseEditor").appendChild(card);
}

function setupWorkoutForm() {
  $("#addExerciseButton").addEventListener("click", () => addExerciseEditor());
  $("#exerciseEditor").addEventListener("click", (event) => {
    if (event.target.closest(".remove-exercise")) event.target.closest(".exercise-card").remove();
  });
  $("#workoutForm").addEventListener("submit", saveWorkout);
  $("#deleteWorkoutButton").addEventListener("click", async () => {
    const id = $("#workoutId").value;
    await deleteWorkout(id);
  });
}

async function saveWorkout(event) {
  event.preventDefault();
  const exercises = $$(".exercise-card").map((card) => {
    const type = $(".exercise-type", card).value;
    const notes = $(".exercise-notes", card)?.value.trim() || "";
    const set = {
      id: card.dataset.setId || uid(),
      weight: num($(".exercise-weight", card)?.value),
      reps: num($(".exercise-reps", card)?.value),
      notes,
    };
    const setCount = num($(".exercise-set-count", card)?.value);
    return {
      id: card.dataset.exerciseId || uid(),
      name: $(".exercise-name", card).value.trim(),
      type,
      setCount,
      notes,
      sets: [set].filter((item) => item.weight || item.reps || item.notes || setCount),
    };
  }).filter((exercise) => exercise.name && (exercise.sets.length || exercise.setCount));

  if (!exercises.length) {
    alert("至少添加一个动作，并填写重量、次数、组数或备注");
    return;
  }

  const now = new Date().toISOString();
  const existing = state.workouts.find((item) => item.id === $("#workoutId").value);
  await put("workouts", {
    id: existing?.id || uid(),
    date: $("#workoutDate").value,
    title: $("#workoutTitle").value.trim(),
    durationMinutes: num($("#workoutDuration").value),
    intensity: num($("#workoutIntensity").value),
    notes: $("#workoutNotes").value.trim(),
    exercises,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  $("#workoutDialog").close();
  await loadData();
}

function resetBodyForm(item) {
  $("#bodyDialogTitle").textContent = item ? "编辑身体数据" : "身体数据";
  $("#bodyId").value = item?.id || "";
  $("#bodyDate").value = item?.date || today();
  ["Weight", "Waist", "Chest", "Hips", "Thigh", "Arm", "Fat"].forEach((name) => {
    $(`#body${name}`).value = item?.[name === "Fat" ? "bodyFat" : name.toLowerCase()] || "";
  });
  $("#bodyNotes").value = item?.notes || "";
  $("#deleteBodyButton").classList.toggle("hidden", !item);
}

function setupBodyForm() {
  $("#bodyForm").addEventListener("submit", saveBody);
  $("#deleteBodyButton").addEventListener("click", async () => {
    const id = $("#bodyId").value;
    if (id && confirm("确定删除这条身体数据？")) {
      await remove("measurements", id);
      $("#bodyDialog").close();
      await loadData();
    }
  });
  $$(".range-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest(".range-tabs");
      const target = group.dataset.chartRange;
      if (target === "home") state.homeRange = button.dataset.range;
      if (target === "body") state.bodyRange = button.dataset.range;
      $$("button", group).forEach((item) => item.classList.toggle("active", item === button));
      drawCharts();
    });
  });
}

async function saveBody(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const existing = state.measurements.find((item) => item.id === $("#bodyId").value);
  await put("measurements", {
    id: existing?.id || uid(),
    date: $("#bodyDate").value,
    weight: num($("#bodyWeight").value),
    waist: num($("#bodyWaist").value),
    chest: num($("#bodyChest").value),
    hips: num($("#bodyHips").value),
    thigh: num($("#bodyThigh").value),
    arm: num($("#bodyArm").value),
    bodyFat: num($("#bodyFat").value),
    notes: $("#bodyNotes").value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  $("#bodyDialog").close();
  await loadData();
}

function resetPhotoForm(photo) {
  $("#photoId").value = photo?.id || "";
  $("#photoDate").value = photo?.date || today();
  $("#photoFile").value = "";
  $("#photoAngle").value = photo?.angle || "front";
  $("#photoWeight").value = photo?.weight || "";
  $("#photoNotes").value = photo?.notes || "";
  $("#deletePhotoButton").classList.toggle("hidden", !photo);
  state.draftPhotoData = photo?.imageData || "";
  renderPhotoPreview();
}

function setupPhotoForm() {
  $("#photoFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.draftPhotoData = await compressImage(file);
    renderPhotoPreview();
  });
  $("#photoForm").addEventListener("submit", savePhoto);
  $("#deletePhotoButton").addEventListener("click", async () => {
    const id = $("#photoId").value;
    if (id && confirm("确定删除这张照片？")) {
      await remove("photos", id);
      $("#photoDialog").close();
      await loadData();
    }
  });
}

function renderPhotoPreview() {
  const preview = $("#photoPreview");
  preview.innerHTML = state.draftPhotoData
    ? `<img src="${state.draftPhotoData}" alt="照片预览" />`
    : "选择照片后会显示预览";
  preview.classList.toggle("empty-state", !state.draftPhotoData);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function savePhoto(event) {
  event.preventDefault();
  if (!state.draftPhotoData) {
    alert("请选择一张照片");
    return;
  }
  const now = new Date().toISOString();
  const existing = state.photos.find((item) => item.id === $("#photoId").value);
  await put("photos", {
    id: existing?.id || uid(),
    date: $("#photoDate").value,
    imageData: state.draftPhotoData,
    angle: $("#photoAngle").value,
    weight: num($("#photoWeight").value),
    notes: $("#photoNotes").value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  $("#photoDialog").close();
  await loadData();
}

function setupEditHandlers() {
  document.addEventListener("click", (event) => {
    const deleteWorkoutButton = event.target.closest("[data-delete-workout]");
    const workoutButton = event.target.closest("[data-edit-workout]");
    const bodyButton = event.target.closest("[data-edit-body]");
    const photoButton = event.target.closest("[data-edit-photo]");
    if (deleteWorkoutButton) {
      event.stopPropagation();
      deleteWorkout(deleteWorkoutButton.dataset.deleteWorkout);
      return;
    }
    if (workoutButton) {
      resetWorkoutForm(state.workouts.find((item) => item.id === workoutButton.dataset.editWorkout));
      $("#workoutDialog").showModal();
    }
    if (bodyButton) {
      resetBodyForm(state.measurements.find((item) => item.id === bodyButton.dataset.editBody));
      $("#bodyDialog").showModal();
    }
    if (photoButton) {
      resetPhotoForm(state.photos.find((item) => item.id === photoButton.dataset.editPhoto));
      $("#photoDialog").showModal();
    }
  });
}

async function deleteWorkout(id) {
  if (id && confirm("确定删除这次训练？")) {
    await remove("workouts", id);
    if ($("#workoutDialog").open) $("#workoutDialog").close();
    await loadData();
  }
}

function setupBackup() {
  $("#exportButton").addEventListener("click", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: state.workouts,
      measurements: state.measurements,
      photos: state.photos,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fitness-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  $("#importButton").addEventListener("click", async () => {
    const file = $("#importFile").files[0];
    if (!file) {
      alert("请选择备份文件");
      return;
    }
    const payload = JSON.parse(await file.text());
    if (!payload.workouts || !payload.measurements || !payload.photos) {
      alert("备份文件格式不正确");
      return;
    }
    if (!confirm("导入会合并到当前数据中，继续？")) return;
    await Promise.all([
      ...payload.workouts.map((item) => put("workouts", item)),
      ...payload.measurements.map((item) => put("measurements", item)),
      ...payload.photos.map((item) => put("photos", item)),
    ]);
    $("#backupDialog").close();
    await loadData();
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

async function init() {
  state.db = await openDb();
  setupNavigation();
  setupDialogs();
  setupWorkoutForm();
  setupBodyForm();
  setupPhotoForm();
  setupEditHandlers();
  setupBackup();
  setupChartInteractions();
  await loadData();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js");
  }
  window.addEventListener("resize", drawCharts);
}

init().catch((error) => {
  console.error(error);
  alert("应用启动失败，请刷新后重试");
});

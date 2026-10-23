// BASE and KEY are injected by build.js into config.js, loaded before this script
// ── API ───────────────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": KEY,
      ...opts.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
  return body;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtRange(start, end) {
  const fmt = (dt, opts) =>
    new Intl.DateTimeFormat("en-GB", opts).format(new Date(dt));
  const date = fmt(start, { day: "numeric", month: "short", year: "numeric" });
  const t = (dt) => fmt(dt, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${t(start)}–${t(end)}`;
}

function fmtDateTime(dt) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dt));
}

function toast(msg, type = "neutral") {
  const bg = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    neutral: "bg-gray-800",
  }[type];
  const el = document.createElement("div");
  el.className = `${bg} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg transition-opacity duration-500`;
  el.textContent = msg;
  document.getElementById("toasts").append(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 3000);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function switchTab(name) {
  ["slots", "bookings", "admin"].forEach((t) => {
    document
      .getElementById(`panel-${t}`)
      .classList.toggle("hidden", t !== name);
    document.getElementById(`tab-${t}`).className =
      `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        t === name
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`;
  });
}

// ── Slots ─────────────────────────────────────────────────────────────────────

let slotsMap = {};

async function loadSlots() {
  const provider = document.getElementById("filter").value.trim();
  const grid = document.getElementById("slots-grid");
  const msg = document.getElementById("slots-msg");

  grid.innerHTML = "";
  msg.textContent = "Loading…";
  msg.className = "text-sm text-gray-400 py-10 text-center";

  try {
    const q = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    const { slots } = await api("/slots" + q);
    slotsMap = {
      ...slotsMap,
      ...Object.fromEntries(slots.map((s) => [s.id, s])),
    };

    if (!slots.length) {
      msg.textContent = "No slots found.";
      msg.className = "text-sm text-gray-500 py-10 text-center";
      return;
    }

    msg.textContent = "";
    slots.forEach((s) => grid.append(slotCard(s)));
  } catch (e) {
    msg.textContent = e.message;
    msg.className = "text-sm text-red-500 py-10 text-center";
  }
}

function clearFilter() {
  document.getElementById("filter").value = "";
  loadSlots();
}

function slotCard(slot) {
  const canBook = slot.available && new Date(slot.start) > new Date();
  const el = document.createElement("div");
  el.id = `slot-${slot.id}`;
  el.className =
    "bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3";
  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-medium truncate">${esc(slot.provider)}</p>
        <p class="text-xs text-gray-500 mt-0.5">${fmtRange(slot.start, slot.end)}</p>
      </div>
      <span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
        slot.available
          ? "bg-emerald-50 text-emerald-700"
          : "bg-gray-100 text-gray-500"
      }">${slot.available ? "Available" : "Booked"}</span>
    </div>
    ${canBook ? `<button class="book-btn w-full py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Book</button>` : ""}
  `;
  if (canBook) el.querySelector(".book-btn").onclick = () => openModal(slot);
  return el;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(slot) {
  document.getElementById("modal-slot-id").value = slot.id;
  document.getElementById("modal-info").textContent =
    `${slot.provider} · ${fmtRange(slot.start, slot.end)}`;
  document.getElementById("modal-name").value = "";
  document.getElementById("modal-email").value = "";
  document.getElementById("book-error").classList.add("hidden");
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.getElementById("modal-name").focus();
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

document.getElementById("book-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const slotId = document.getElementById("modal-slot-id").value;
  const name = document.getElementById("modal-name").value.trim();
  const email = document.getElementById("modal-email").value.trim();
  const errEl = document.getElementById("book-error");
  const btn = document.getElementById("book-submit");

  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Booking…";

  try {
    await api("/bookings", {
      method: "POST",
      body: JSON.stringify({ slot_id: slotId, name, email }),
    });
    closeModal();
    const updated = { ...slotsMap[slotId], available: false };
    slotsMap[slotId] = updated;
    const old = document.getElementById(`slot-${slotId}`);
    if (old) old.replaceWith(slotCard(updated));
    toast("Booked!", "success");
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm";
  }
});

// ── Bookings ──────────────────────────────────────────────────────────────────

let nextCursor = null;

async function loadBookings(append = false) {
  const email = document.getElementById("email-input").value.trim();
  if (!email) return;

  const list = document.getElementById("bookings-list");
  const msg = document.getElementById("bookings-msg");
  const moreBtn = document.getElementById("load-more");

  if (!append) {
    list.innerHTML = "";
    nextCursor = null;
    moreBtn.classList.add("hidden");
  }

  msg.textContent = "Loading…";
  msg.className = "text-sm text-gray-400 py-10 text-center";

  try {
    const params = new URLSearchParams({ email });
    if (nextCursor) params.set("cursor", nextCursor);

    const [{ bookings, next_cursor }, { slots }] = await Promise.all([
      api(`/bookings?${params}`),
      api("/slots"),
    ]);
    const slotLookup = Object.fromEntries(slots.map((s) => [s.id, s]));
    Object.assign(slotsMap, slotLookup);

    nextCursor = next_cursor || null;

    if (!append && !bookings.length) {
      msg.textContent = "No bookings found for this email.";
      msg.className = "text-sm text-gray-500 py-10 text-center";
      return;
    }

    msg.textContent = "";
    bookings.forEach((b) => list.append(bookingCard(b, slotLookup[b.slot_id])));
    moreBtn.classList.toggle("hidden", !nextCursor);
  } catch (e) {
    msg.textContent = e.message;
    msg.className = "text-sm text-red-500 py-10 text-center";
  }
}

function bookingCard(b, slot) {
  const cancelled = b.status === "cancelled";
  const slotLine = slot
    ? `${esc(slot.provider)} · ${fmtRange(slot.start, slot.end)}`
    : `Slot ${esc(b.slot_id)}`;

  const el = document.createElement("div");
  el.id = `booking-${b.id}`;
  el.className = "bg-white border border-gray-200 rounded-xl p-4";
  el.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-medium">${slotLine}</p>
        <p class="text-sm text-gray-500 mt-0.5">${esc(b.name)} · ${esc(b.email)}</p>
        <p class="text-xs text-gray-400 mt-1">Booked ${fmtDateTime(b.created_at)}</p>
      </div>
      <div class="shrink-0 flex flex-col items-end gap-2">
        <span class="text-xs font-medium px-2 py-0.5 rounded-full ${
          cancelled
            ? "bg-red-50 text-red-600"
            : "bg-emerald-50 text-emerald-700"
        }">${esc(b.status)}</span>
        ${!cancelled ? `<button class="cancel-btn text-xs text-red-500 hover:underline">Cancel</button>` : ""}
      </div>
    </div>
  `;
  if (!cancelled) {
    el.querySelector(".cancel-btn").onclick = () => cancelBooking(b.id);
  }
  return el;
}

async function cancelBooking(id) {
  if (!confirm("Cancel this booking?")) return;
  try {
    const updated = await api(`/bookings/${id}`, { method: "DELETE" });
    const el = document.getElementById(`booking-${id}`);
    if (el) el.replaceWith(bookingCard(updated, slotsMap[updated.slot_id]));
    toast("Booking cancelled.", "neutral");
  } catch (e) {
    toast(e.message, "error");
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function handleReset() {
  const raw = document.getElementById("admin-input").value.trim();
  const msgEl = document.getElementById("admin-msg");
  msgEl.textContent = "";
  msgEl.className = "text-sm";

  let slots;
  try {
    slots = JSON.parse(raw);
    if (!Array.isArray(slots)) throw new Error("must be a JSON array");
  } catch (e) {
    msgEl.textContent = `Invalid JSON: ${e.message}`;
    msgEl.classList.add("text-red-600");
    return;
  }

  if (
    !confirm(
      `Replace all slots with ${slots.length} slot(s)? All existing bookings will be deleted.`,
    )
  )
    return;

  try {
    const { slots: result } = await api("/reset", {
      method: "POST",
      body: JSON.stringify({ slots }),
    });
    msgEl.textContent = `Done — ${result.length} slot(s) created.`;
    msgEl.classList.add("text-emerald-600");
    toast(`${result.length} slots loaded.`, "success");
  } catch (e) {
    msgEl.textContent = e.message;
    msgEl.classList.add("text-red-600");
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadSlots();

document.getElementById("filter").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadSlots();
});
document.getElementById("email-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadBookings();
});
document
  .getElementById("load-more")
  .addEventListener("click", () => loadBookings(true));

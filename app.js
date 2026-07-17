
const API_URL = "https://script.google.com/macros/s/AKfycbxl9jf2P7ZkaepnuaQSy5DW-v9bdMbtWQRkLfueamtzlC8_s7kEhizH--CxJdJiDDwT/exec";

/* ---------------- ESTADO GLOBAL ---------------- */
let barberos = [];
let servicios = [];
let resumenHoyMap = {}; // { nombreBarbero: {cantidad, total} }
let barberoSeleccionado = null;
let servicioSeleccionado = null;
let adminPassword = null;

/* ---------------- HELPERS API ---------------- */
function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mostrarCargando(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

async function apiGet(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  mostrarCargando(true);
  try {
    const res = await fetch(url.toString());
    return await res.json();
  } catch (err) {
    return { ok: false, error: "Error de conexión: " + err.message };
  } finally {
    mostrarCargando(false);
  }
}

// Content-Type text/plain evita el preflight CORS que Apps Script no maneja bien.
async function apiPost(body) {
  mostrarCargando(true);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: "Error de conexión: " + err.message };
  } finally {
    mostrarCargando(false);
  }
}

/* ---------------- TEMA CLARO / OSCURO ---------------- */
function aplicarTema(tema) {
  document.body.setAttribute("data-theme", tema);
  document.getElementById("btnTema").textContent = tema === "light" ? "☀️" : "🌙";
  localStorage.setItem("izquierdos_tema", tema);
}
document.getElementById("btnTema").addEventListener("click", () => {
  const actual = document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
  aplicarTema(actual);
});
aplicarTema(localStorage.getItem("izquierdos_tema") || "dark");

/* ---------------- NAVEGACIÓN ---------------- */
function mostrarPantalla(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function abrirModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function cerrarModal(id) {
  document.getElementById(id).classList.add("hidden");
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => cerrarModal(btn.dataset.close));
});

/* ---------------- CARGA DE DATOS PÚBLICOS ---------------- */
async function cargarDatosPublicos() {
  const data = await apiGet({ action: "data" });
  if (data.ok === false) {
    document.getElementById("grid-barberos").innerHTML =
      `<p class="loading-text">⚠️ No se pudo conectar con el servidor.<br>${data.error || ""}</p>`;
    return;
  }
  barberos = data.barberos || [];
  servicios = data.servicios || [];
  await cargarResumenHoy();
  renderBarberos();
}

async function cargarResumenHoy() {
  const data = await apiGet({ action: "resumen", fecha: hoyISO() });
  resumenHoyMap = {};
  if (data.ok !== false && data.resumen) {
    data.resumen.forEach((r) => {
      resumenHoyMap[r.barbero] = { cantidad: r.cantidad, total: r.total };
    });
  }
}

/* ---------------- RENDER PANTALLA PRINCIPAL ---------------- */
function renderBarberos() {
  const grid = document.getElementById("grid-barberos");
  if (!barberos.length) {
    grid.innerHTML = `<p class="loading-text">No hay barberos activos configurados.</p>`;
    return;
  }
  grid.innerHTML = "";
  barberos.forEach((b) => {
    const info = resumenHoyMap[b.nombre] || { cantidad: 0, total: 0 };
    const inicial = b.nombre.trim().charAt(0).toUpperCase();
    const card = document.createElement("div");
    card.className = "card-barbero";
    card.innerHTML = `
      <button class="btn-info" data-id="${b.id}" title="Ver info del día">ℹ️</button>
      <div class="avatar">${inicial}</div>
      <div class="nombre-barbero">${b.nombre}</div>
      <div class="conteo-hoy">${info.cantidad} servicio${info.cantidad === 1 ? "" : "s"} hoy</div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-info")) return;
      seleccionarBarbero(b);
    });
    card.querySelector(".btn-info").addEventListener("click", (e) => {
      e.stopPropagation();
      mostrarInfoBarbero(b);
    });
    grid.appendChild(card);
  });
}

function mostrarInfoBarbero(b) {
  const info = resumenHoyMap[b.nombre] || { cantidad: 0, total: 0 };
  document.getElementById("infoBarberoNombre").textContent = b.nombre;
  document.getElementById("infoBarberoFecha").textContent = "Hoy · " + hoyISO();
  document.getElementById("infoBarberoDetalle").innerHTML = `
    <div class="fila-resumen">
      <span class="nombre">Servicios realizados</span>
      <span class="datos"><b>${info.cantidad}</b></span>
    </div>
  `;
  document.getElementById("infoBarberoTotal").textContent = `Total generado: $${info.total.toLocaleString("es-MX")}`;
  abrirModal("modal-info-barbero");
}

/* ---------------- PANTALLA SERVICIO ---------------- */
function seleccionarBarbero(b) {
  barberoSeleccionado = b;
  servicioSeleccionado = null;
  document.getElementById("nombreBarberoSeleccionado").textContent = b.nombre;
  renderServicios();
  document.getElementById("btnRegistrar").disabled = true;
  mostrarPantalla("screen-servicio");
}

function renderServicios() {
  const grid = document.getElementById("grid-servicios");
  if (!servicios.length) {
    grid.innerHTML = `<p class="loading-text">No hay servicios activos configurados.</p>`;
    return;
  }
  grid.innerHTML = "";
  servicios.forEach((s) => {
    const card = document.createElement("div");
    card.className = "card-servicio";
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="nombre-servicio">${s.nombre}</div>
      <div class="precio-servicio">$${Number(s.precio).toLocaleString("es-MX")}</div>
    `;
    card.addEventListener("click", () => {
      servicioSeleccionado = s;
      document.querySelectorAll(".card-servicio").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnRegistrar").disabled = false;
    });
    grid.appendChild(card);
  });
}

document.getElementById("btnVolver").addEventListener("click", () => {
  mostrarPantalla("screen-home");
});

document.getElementById("btnRegistrar").addEventListener("click", async () => {
  if (!barberoSeleccionado || !servicioSeleccionado) return;
  const btn = document.getElementById("btnRegistrar");
  btn.disabled = true;
  const res = await apiPost({
    action: "registrar",
    barbero: barberoSeleccionado.nombre,
    servicio: servicioSeleccionado.nombre,
  });
  if (res.ok === false) {
    alert("No se pudo registrar: " + (res.error || "error desconocido"));
    btn.disabled = false;
    return;
  }
  document.getElementById("confirm-text").textContent =
    `✅ Registrado: ${res.barbero} - ${res.servicio} - $${Number(res.precio).toLocaleString("es-MX")}`;
  abrirModal("overlay-confirm");
  setTimeout(async () => {
    cerrarModal("overlay-confirm");
    mostrarPantalla("screen-home");
    await cargarResumenHoy();
    renderBarberos();
  }, 1600);
});

/* ---------------- RESUMEN DEL DÍA (MODAL) ---------------- */
document.getElementById("btnResumen").addEventListener("click", async () => {
  const data = await apiGet({ action: "resumen", fecha: hoyISO() });
  document.getElementById("fechaResumen").textContent = "Fecha: " + hoyISO();
  const cont = document.getElementById("tabla-resumen");
  if (data.ok === false) {
    cont.innerHTML = `<p class="loading-text">${data.error}</p>`;
  } else if (!data.resumen || !data.resumen.length) {
    cont.innerHTML = `<p class="loading-text">Aún no hay servicios registrados hoy.</p>`;
  } else {
    cont.innerHTML = data.resumen
      .map(
        (r) => `
      <div class="fila-resumen">
        <span class="nombre">${r.barbero}</span>
        <span class="datos">${r.cantidad} servicio${r.cantidad === 1 ? "" : "s"}<br><b>$${r.total.toLocaleString("es-MX")}</b></span>
      </div>`
      )
      .join("");
  }
  document.getElementById("totalGeneral").textContent = data.ok === false ? "" :
    `Total del día: $${(data.granTotal || 0).toLocaleString("es-MX")} (${data.granCantidad || 0} servicios)`;
  abrirModal("modal-resumen");
});

/* ================================================================
   ADMINISTRACIÓN
   ================================================================ */
document.getElementById("btnAdminAcceso").addEventListener("click", () => {
  document.getElementById("inputAdminPassword").value = "";
  document.getElementById("adminLoginError").textContent = "";
  abrirModal("modal-admin-login");
});

document.getElementById("btnAdminLogin").addEventListener("click", intentarLoginAdmin);
document.getElementById("inputAdminPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") intentarLoginAdmin();
});

async function intentarLoginAdmin() {
  const pass = document.getElementById("inputAdminPassword").value.trim();
  if (!pass) return;
  const res = await apiPost({ action: "admin_login", password: pass });
  if (res.ok) {
    adminPassword = pass;
    cerrarModal("modal-admin-login");
    mostrarPantalla("screen-admin");
    cargarDatosAdmin();
  } else {
    document.getElementById("adminLoginError").textContent = "Contraseña incorrecta.";
  }
}

document.getElementById("btnAdminSalir").addEventListener("click", async () => {
  adminPassword = null;
  mostrarPantalla("screen-home");
  await cargarDatosPublicos();
});

/* --- Tabs --- */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

/* --- Carga de datos admin --- */
let adminBarberos = [];
let adminServicios = [];

async function cargarDatosAdmin() {
  const data = await apiPost({ action: "admin_get_data", password: adminPassword });
  if (data.ok === false) {
    alert("Error: " + data.error);
    return;
  }
  adminBarberos = data.barberos || [];
  adminServicios = data.servicios || [];
  renderAdminBarberos();
  renderAdminServicios();

  // Rango de fechas por defecto: hoy
  document.getElementById("fechaInicio").value = hoyISO();
  document.getElementById("fechaFin").value = hoyISO();
  buscarRegistros();
}

function renderAdminBarberos() {
  const cont = document.getElementById("lista-admin-barberos");
  if (!adminBarberos.length) {
    cont.innerHTML = `<p class="loading-text">No hay barberos registrados.</p>`;
    return;
  }
  cont.innerHTML = "";
  adminBarberos.forEach((b) => {
    const item = document.createElement("div");
    item.className = "admin-item" + (b.activo ? "" : " inactivo");
    item.innerHTML = `
      <div class="info">
        <input type="text" value="${b.nombre}" data-id="${b.id}" class="input-editar-nombre">
      </div>
      <span class="estado ${b.activo ? "activo" : "inactivo"}">${b.activo ? "Activo" : "Inactivo"}</span>
      <div class="acciones">
        <button class="btn-mini btn-guardar">Guardar</button>
        <button class="btn-mini ${b.activo ? "toggle-off" : "toggle-on"}">${b.activo ? "Desactivar" : "Activar"}</button>
      </div>
    `;
    item.querySelector(".btn-guardar").addEventListener("click", async () => {
      const nuevoNombre = item.querySelector(".input-editar-nombre").value.trim();
      if (!nuevoNombre) return;
      const res = await apiPost({ action: "admin_edit_barbero", password: adminPassword, id: b.id, nombre: nuevoNombre });
      if (res.ok === false) return alert(res.error);
      cargarDatosAdmin();
    });
    item.querySelector(".acciones button:last-child").addEventListener("click", async () => {
      const res = await apiPost({ action: "admin_toggle_barbero", password: adminPassword, id: b.id });
      if (res.ok === false) return alert(res.error);
      cargarDatosAdmin();
    });
    cont.appendChild(item);
  });
}

function renderAdminServicios() {
  const cont = document.getElementById("lista-admin-servicios");
  if (!adminServicios.length) {
    cont.innerHTML = `<p class="loading-text">No hay servicios registrados.</p>`;
    return;
  }
  cont.innerHTML = "";
  adminServicios.forEach((s) => {
    const item = document.createElement("div");
    item.className = "admin-item" + (s.activo ? "" : " inactivo");
    item.innerHTML = `
      <div class="info">
        <input type="text" value="${s.nombre}" class="input-editar-nombre">
      </div>
      <input type="number" value="${s.precio}" class="precio-input">
      <span class="estado ${s.activo ? "activo" : "inactivo"}">${s.activo ? "Activo" : "Inactivo"}</span>
      <div class="acciones">
        <button class="btn-mini btn-guardar">Guardar</button>
        <button class="btn-mini ${s.activo ? "toggle-off" : "toggle-on"}">${s.activo ? "Desactivar" : "Activar"}</button>
      </div>
    `;
    item.querySelector(".btn-guardar").addEventListener("click", async () => {
      const nuevoNombre = item.querySelector(".input-editar-nombre").value.trim();
      const nuevoPrecio = Number(item.querySelector(".precio-input").value);
      if (!nuevoNombre || isNaN(nuevoPrecio) || nuevoPrecio < 0) return alert("Datos inválidos");
      const res = await apiPost({ action: "admin_edit_servicio", password: adminPassword, id: s.id, nombre: nuevoNombre, precio: nuevoPrecio });
      if (res.ok === false) return alert(res.error);
      cargarDatosAdmin();
    });
    item.querySelector(".acciones button:last-child").addEventListener("click", async () => {
      const res = await apiPost({ action: "admin_toggle_servicio", password: adminPassword, id: s.id });
      if (res.ok === false) return alert(res.error);
      cargarDatosAdmin();
    });
    cont.appendChild(item);
  });
}

document.getElementById("btnAgregarBarbero").addEventListener("click", async () => {
  const input = document.getElementById("nuevoBarberoNombre");
  const nombre = input.value.trim();
  if (!nombre) return;
  const res = await apiPost({ action: "admin_add_barbero", password: adminPassword, nombre });
  if (res.ok === false) return alert(res.error);
  input.value = "";
  cargarDatosAdmin();
});

document.getElementById("btnAgregarServicio").addEventListener("click", async () => {
  const inputNombre = document.getElementById("nuevoServicioNombre");
  const inputPrecio = document.getElementById("nuevoServicioPrecio");
  const nombre = inputNombre.value.trim();
  const precio = Number(inputPrecio.value);
  if (!nombre || isNaN(precio) || precio < 0) return alert("Datos inválidos");
  const res = await apiPost({ action: "admin_add_servicio", password: adminPassword, nombre, precio });
  if (res.ok === false) return alert(res.error);
  inputNombre.value = "";
  inputPrecio.value = "";
  cargarDatosAdmin();
});

/* --- Registros y ganancias --- */
document.getElementById("btnFiltrarRegistros").addEventListener("click", buscarRegistros);

async function buscarRegistros() {
  const fechaInicio = document.getElementById("fechaInicio").value;
  const fechaFin = document.getElementById("fechaFin").value;
  if (!fechaInicio || !fechaFin) return;
  const data = await apiPost({ action: "admin_registros", password: adminPassword, fechaInicio, fechaFin });
  if (data.ok === false) return alert(data.error);

  const contResumen = document.getElementById("tabla-registros-resumen");
  contResumen.innerHTML = (data.resumen || [])
    .map(
      (r) => `
    <div class="fila-resumen">
      <span class="nombre">${r.barbero}</span>
      <span class="datos">${r.cantidad} servicio${r.cantidad === 1 ? "" : "s"}<br><b>$${r.total.toLocaleString("es-MX")}</b></span>
    </div>`
    )
    .join("") || `<p class="loading-text">Sin registros en este rango.</p>`;

  document.getElementById("totalGeneralRegistros").textContent =
    `Total: $${(data.granTotal || 0).toLocaleString("es-MX")} (${data.granCantidad || 0} servicios)`;

  const tbody = document.getElementById("tablaDetalleRegistrosBody");
  tbody.innerHTML = (data.registros || [])
    .slice()
    .reverse()
    .map(
      (r) => `
    <tr>
      <td>${r.fecha}</td>
      <td>${r.hora}</td>
      <td>${r.barbero}</td>
      <td>${r.servicio}</td>
      <td>$${Number(r.precio).toLocaleString("es-MX")}</td>
    </tr>`
    )
    .join("");
}

/* ---------------- INICIO ---------------- */
cargarDatosPublicos();

import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

const $ = (id) => document.getElementById(id);

// ===== UI refs =====
const loginCard = $("loginCard");
const appCard = $("appCard");
const catCard = $("catCard");
const prodCard = $("prodCard");
const topActions = $("topActions");

const loginMsg = $("loginMsg");
const userInfo = $("userInfo");
const adminHint = $("adminHint");

const emailEl = $("email");
const passEl = $("password");
const btnLogin = $("btnLogin");
const btnLogout = $("btnLogout");

// Categories (create form)
const catName = $("catName");
const catDesc = $("catDesc");
const catOrder = $("catOrder");
const catActive = $("catActive");
const btnSaveCat = $("btnSaveCat");
const catMsg = $("catMsg");
const catTbody = $("catTbody");

// Products (create form)
const prodName = $("prodName");
const prodDesc = $("prodDesc");
const prodPrice = $("prodPrice");
const prodCategory = $("prodCategory");
const prodOrder = $("prodOrder");
const prodActive = $("prodActive");
const btnSaveProd = $("btnSaveProd");
const prodMsg = $("prodMsg");
const prodTbody = $("prodTbody");

// Search/filter
const prodSearch = $("prodSearch");
const prodFilterCategory = $("prodFilterCategory");

// Modal
const modal = $("modal");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const modalClose = $("modalClose");
const modalSave = $("modalSave");
const modalMsg = $("modalMsg");

// ===== State =====
let categoriesCache = new Map(); // id -> category
let productsCache = new Map();   // id -> product
let unsubCats = null;
let unsubProds = null;

// modal state
let modalMode = null; // "edit-cat" | "edit-prod"
let modalId = null;

// ===== Helpers =====
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMsg(el, text, kind = "") {
  if (!el) return;
  el.classList.remove("err", "ok");
  if (kind === "err") el.classList.add("err");
  if (kind === "ok") el.classList.add("ok");
  el.textContent = text || "";
}

function parseBoolSelect(selectEl) {
  return (selectEl?.value ?? "true") === "true";
}

function formatPrice(n) {
  const x = Number(n ?? 0);
  if (Number.isNaN(x)) return "0.00";
  return x.toFixed(2);
}

function showLoggedOut() {
  loginCard.style.display = "";
  appCard.style.display = "none";
  catCard.style.display = "none";
  prodCard.style.display = "none";
  if (topActions) topActions.style.display = "none";

  setMsg(loginMsg, "");
  setMsg(catMsg, "");
  setMsg(prodMsg, "");

  catTbody.innerHTML = "";
  prodTbody.innerHTML = "";
  prodCategory.innerHTML = "";
  prodFilterCategory.innerHTML = `<option value="">Todas</option>`;
  prodSearch.value = "";

  categoriesCache.clear();
  productsCache.clear();

  if (unsubCats) unsubCats();
  if (unsubProds) unsubProds();
  unsubCats = null;
  unsubProds = null;

  closeModal();
}

function showLoggedIn(user) {
  loginCard.style.display = "none";
  appCard.style.display = "";
  catCard.style.display = "";
  prodCard.style.display = "";
  if (topActions) topActions.style.display = "";

  userInfo.textContent = `Logueado: ${user.email}`;
  adminHint.textContent = `UID: ${user.uid}`;
}

// ===== LOGIN (ARREGLADO) =====
async function doLogin() {
  setMsg(loginMsg, "");
  try {
    const email = emailEl.value.trim();
    const pass = passEl.value;
    if (!email || !pass) {
      setMsg(loginMsg, "Completá email y contraseña.", "err");
      return;
    }
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    console.error("LOGIN ERROR", e);
    setMsg(loginMsg, `Error de login: ${e?.code || ""} ${e?.message || e}`, "err");
    alert(`Login falló:\n${e?.code || ""}\n${e?.message || e}`);
  }
}

btnLogin.addEventListener("click", doLogin);

// Enter para loguear
[emailEl, passEl].forEach((el) => {
  el?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") doLogin();
  });
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// ===== Category selects =====
function renderCategorySelects() {
  const list = Array.from(categoriesCache.entries())
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const currentProdCat = prodCategory.value;
  prodCategory.innerHTML = "";
  for (const c of list) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    prodCategory.appendChild(opt);
  }
  if (currentProdCat) prodCategory.value = currentProdCat;

  const currentFilter = prodFilterCategory.value;
  prodFilterCategory.innerHTML = `<option value="">Todas</option>`;
  for (const c of list) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    prodFilterCategory.appendChild(opt);
  }
  prodFilterCategory.value = currentFilter || "";
}

// ===== Categories render =====
function renderCategoriesTable() {
  catTbody.innerHTML = "";

  const list = Array.from(categoriesCache.entries())
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const c of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div><strong>${escapeHtml(c.name)}</strong></div>
        ${c.description ? `<div class="muted">${escapeHtml(c.description)}</div>` : ""}
      </td>
      <td>${c.order ?? 0}</td>
      <td>${c.isActive ? '<span class="pill">Activa</span>' : '<span class="pill">Inactiva</span>'}</td>
      <td class="actions">
        <button class="btn2" data-edit-cat="${c.id}">Editar</button>
        <button class="btn2" data-toggle-cat="${c.id}">${c.isActive ? "Desactivar" : "Activar"}</button>
        <button class="danger" data-del-cat="${c.id}">Borrar</button>
      </td>
    `;
    catTbody.appendChild(tr);
  }
}

// ===== Products render =====
function matchesSearch(p, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    (p.name || "").toLowerCase().includes(t) ||
    (p.description || "").toLowerCase().includes(t)
  );
}

function renderProductsTable() {
  const term = (prodSearch.value || "").trim();
  const catFilter = (prodFilterCategory.value || "").trim();

  prodTbody.innerHTML = "";

  const list = Array.from(productsCache.entries())
    .map(([id, p]) => ({ id, ...p }))
    .filter((p) => !catFilter || p.categoryId === catFilter)
    .filter((p) => matchesSearch(p, term))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const p of list) {
    const catName = categoriesCache.get(p.categoryId)?.name ?? "(sin categoría)";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div><strong>${escapeHtml(p.name)}</strong></div>
        ${p.description ? `<div class="muted">${escapeHtml(p.description)}</div>` : ""}
      </td>
      <td>${escapeHtml(catName)}</td>
      <td>$${formatPrice(p.price)}</td>
      <td>${p.order ?? 0}</td>
      <td>${p.isActive ? '<span class="pill">Activo</span>' : '<span class="pill">Inactivo</span>'}</td>
      <td class="actions">
        <button class="btn2" data-edit-prod="${p.id}">Editar</button>
        <button class="btn2" data-toggle-prod="${p.id}">${p.isActive ? "Desactivar" : "Activar"}</button>
        <button class="danger" data-del-prod="${p.id}">Borrar</button>
      </td>
    `;
    prodTbody.appendChild(tr);
  }
}

// ===== Modal =====
function openModal(title) {
  modalTitle.textContent = title;
  modalMsg.textContent = "";
  modalBody.innerHTML = "";
  modal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalMode = null;
  modalId = null;
  modal.style.display = "none";
  modalBody.innerHTML = "";
  modalMsg.textContent = "";
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

async function saveModal() {
  try {
    if (modalMode === "edit-cat") {
      const name = $("m_catName").value.trim();
      if (!name) return alert("Nombre obligatorio.");

      await updateDoc(doc(db, "categories", modalId), {
        name,
        description: $("m_catDesc").value.trim() || null,
        order: Number($("m_catOrder").value || 0),
        isActive: ($("m_catActive").value === "true"),
        updatedAt: serverTimestamp()
      });

      setMsg(modalMsg, "✅ Categoría actualizada", "ok");
      closeModal();
      return;
    }

    if (modalMode === "edit-prod") {
      const name = $("m_prodName").value.trim();
      if (!name) return alert("Nombre obligatorio.");

      const price = Number($("m_prodPrice").value || 0);
      if (Number.isNaN(price) || price < 0) return alert("Precio inválido.");

      const categoryId = $("m_prodCategory").value;
      if (!categoryId) return alert("Categoría obligatoria.");

      await updateDoc(doc(db, "products", modalId), {
        name,
        description: $("m_prodDesc").value.trim() || null,
        price,
        categoryId,
        order: Number($("m_prodOrder").value || 0),
        isActive: ($("m_prodActive").value === "true"),
        updatedAt: serverTimestamp()
      });

      setMsg(modalMsg, "✅ Producto actualizado", "ok");
      closeModal();
      return;
    }
  } catch (e) {
    console.error("MODAL SAVE ERROR", e);
    setMsg(modalMsg, `❌ Error: ${e?.code || ""} ${e?.message || e}`, "err");
    alert(`No se pudo guardar:\n${e?.message || e}`);
  }
}
modalSave.addEventListener("click", saveModal);

function openCategoryEditModal(catId) {
  const c = categoriesCache.get(catId);
  if (!c) return alert("No se encontró la categoría.");

  modalMode = "edit-cat";
  modalId = catId;

  openModal("Editar categoría");

  modalBody.innerHTML = `
    <div style="display:grid; gap:12px;">
      <div>
        <label>Nombre</label>
        <input id="m_catName" value="${escapeHtml(c.name ?? "")}" />
      </div>
      <div>
        <label>Descripción</label>
        <textarea id="m_catDesc">${escapeHtml(c.description ?? "")}</textarea>
      </div>
      <div style="display:grid; gap:12px; grid-template-columns:1fr 1fr;">
        <div>
          <label>Orden</label>
          <input id="m_catOrder" type="number" value="${Number(c.order ?? 0)}" />
        </div>
        <div>
          <label>Estado</label>
          <select id="m_catActive">
            <option value="true" ${c.isActive ? "selected" : ""}>Activa</option>
            <option value="false" ${!c.isActive ? "selected" : ""}>Inactiva</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function openProductEditModal(prodId) {
  const p = productsCache.get(prodId);
  if (!p) return alert("No se encontró el producto.");

  modalMode = "edit-prod";
  modalId = prodId;

  openModal("Editar producto");

  const options = Array.from(categoriesCache.entries())
    .map(([id, c]) => ({ id, name: c.name, order: c.order ?? 0 }))
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const selected = (p.categoryId === c.id) ? "selected" : "";
      return `<option value="${c.id}" ${selected}>${escapeHtml(c.name)}</option>`;
    })
    .join("");

  modalBody.innerHTML = `
    <div style="display:grid; gap:12px;">
      <div>
        <label>Nombre</label>
        <input id="m_prodName" value="${escapeHtml(p.name ?? "")}" />
      </div>
      <div>
        <label>Descripción</label>
        <textarea id="m_prodDesc">${escapeHtml(p.description ?? "")}</textarea>
      </div>
      <div style="display:grid; gap:12px; grid-template-columns:1fr 1fr 1fr;">
        <div>
          <label>Precio</label>
          <input id="m_prodPrice" type="number" step="0.01" value="${Number(p.price ?? 0)}" />
        </div>
        <div>
          <label>Categoría</label>
          <select id="m_prodCategory">${options}</select>
        </div>
        <div>
          <label>Orden</label>
          <input id="m_prodOrder" type="number" value="${Number(p.order ?? 0)}" />
        </div>
      </div>
      <div style="display:grid; gap:12px; grid-template-columns:1fr 1fr;">
        <div>
          <label>Estado</label>
          <select id="m_prodActive">
            <option value="true" ${p.isActive ? "selected" : ""}>Activo</option>
            <option value="false" ${!p.isActive ? "selected" : ""}>Inactivo</option>
          </select>
        </div>
        <div></div>
      </div>
    </div>
  `;
}

// ===== Firestore wiring =====
function wireCategories() {
  const qCats = query(collection(db, "categories"), orderBy("order", "asc"));
  unsubCats = onSnapshot(qCats, (snap) => {
    categoriesCache.clear();
    snap.forEach((d) => categoriesCache.set(d.id, d.data()));
    renderCategorySelects();
    renderCategoriesTable();
    renderProductsTable();
  });

  btnSaveCat.addEventListener("click", async () => {
    const name = catName.value.trim();
    if (!name) return alert("El nombre de la categoría es obligatorio.");

    try {
      const ref = await addDoc(collection(db, "categories"), {
        name,
        description: catDesc.value.trim() || null,
        order: Number(catOrder.value || 0),
        isActive: parseBoolSelect(catActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setMsg(catMsg, `✅ Categoría creada (${ref.id})`, "ok");

      catName.value = "";
      catDesc.value = "";
      catOrder.value = "0";
      catActive.value = "true";
    } catch (e) {
      console.error("ADD CAT ERROR", e);
      setMsg(catMsg, `❌ Error: ${e?.code || ""} ${e?.message || e}`, "err");
      alert(`No se pudo guardar la categoría:\n${e?.message || e}`);
    }
  });

  catTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const delId = btn.getAttribute("data-del-cat");
    const toggleId = btn.getAttribute("data-toggle-cat");
    const editId = btn.getAttribute("data-edit-cat");

    try {
      if (delId) {
        if (!confirm("¿Borrar categoría?")) return;
        await deleteDoc(doc(db, "categories", delId));
      }
      if (toggleId) {
        const cur = categoriesCache.get(toggleId);
        await updateDoc(doc(db, "categories", toggleId), {
          isActive: !cur?.isActive,
          updatedAt: serverTimestamp()
        });
      }
      if (editId) {
        openCategoryEditModal(editId);
      }
    } catch (err) {
      console.error("CAT ACTION ERROR", err);
      alert(`Acción falló:\n${err?.message || err}`);
    }
  });
}

function wireProducts() {
  const qProds = query(collection(db, "products"), orderBy("order", "asc"));
  unsubProds = onSnapshot(qProds, (snap) => {
    productsCache.clear();
    snap.forEach((d) => productsCache.set(d.id, d.data()));
    renderProductsTable();
  });

  btnSaveProd.addEventListener("click", async () => {
    const name = prodName.value.trim();
    if (!name) return alert("El nombre del producto es obligatorio.");

    const price = Number(prodPrice.value || 0);
    if (Number.isNaN(price) || price < 0) return alert("El precio debe ser un número válido (>= 0).");

    const categoryId = prodCategory.value;
    if (!categoryId) return alert("Creá al menos una categoría y elegila.");

    try {
      const ref = await addDoc(collection(db, "products"), {
        name,
        description: prodDesc.value.trim() || null,
        price,
        categoryId,
        order: Number(prodOrder.value || 0),
        isActive: parseBoolSelect(prodActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setMsg(prodMsg, `✅ Producto creado (${ref.id})`, "ok");

      prodName.value = "";
      prodDesc.value = "";
      prodPrice.value = "0";
      prodOrder.value = "0";
      prodActive.value = "true";
    } catch (e) {
      console.error("ADD PROD ERROR", e);
      setMsg(prodMsg, `❌ Error: ${e?.code || ""} ${e?.message || e}`, "err");
      alert(`No se pudo guardar el producto:\n${e?.message || e}`);
    }
  });

  prodSearch.addEventListener("input", renderProductsTable);
  prodFilterCategory.addEventListener("change", renderProductsTable);

  prodTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const delId = btn.getAttribute("data-del-prod");
    const toggleId = btn.getAttribute("data-toggle-prod");
    const editId = btn.getAttribute("data-edit-prod");

    try {
      if (delId) {
        if (!confirm("¿Borrar producto?")) return;
        await deleteDoc(doc(db, "products", delId));
      }
      if (toggleId) {
        const cur = productsCache.get(toggleId);
        await updateDoc(doc(db, "products", toggleId), {
          isActive: !cur?.isActive,
          updatedAt: serverTimestamp()
        });
      }
      if (editId) {
        openProductEditModal(editId);
      }
    } catch (err) {
      console.error("PROD ACTION ERROR", err);
      alert(`Acción falló:\n${err?.message || err}`);
    }
  });
}

// ===== Init =====
onAuthStateChanged(auth, (user) => {
  if (!user) return showLoggedOut();
  showLoggedIn(user);
  wireCategories();
  wireProducts();
});
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";

document.addEventListener("DOMContentLoaded", () => {
  const mapBase = document.querySelector(".js-map");
  if (mapBase) {
    mapBase.addEventListener("click", () => mapBase.classList.toggle("active"));
  }

  loadMenuFromFirestore().catch((err) => {
    console.error("Menu load error:", err);
    const grid = document.getElementById("menuGrid");
    if (grid) grid.innerHTML = `<div class="muted-loading">Error cargando menú.</div>`;
  });
});

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatARS(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "$ 0";
  // Formato simple ARS
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function loadMenuFromFirestore() {
  const grid = document.getElementById("menuGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="muted-loading">Cargando menú...</div>`;

  // 1) categorías
  const catsQ = query(collection(db, "categories"), orderBy("order", "asc"));
  const catsSnap = await getDocs(catsQ);
  const categories = [];
  catsSnap.forEach((d) => {
    const c = d.data();
    if (c?.isActive) categories.push({ id: d.id, ...c });
  });

  // 2) productos
  const prodsQ = query(collection(db, "products"), orderBy("order", "asc"));
  const prodsSnap = await getDocs(prodsQ);
  const products = [];
  prodsSnap.forEach((d) => {
    const p = d.data();
    if (p?.isActive) products.push({ id: d.id, ...p });
  });

  // 3) agrupar por categoría
  const byCat = new Map(); // catId -> products[]
  for (const p of products) {
    const key = p.categoryId || "uncat";
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(p);
  }

  // 4) render
  if (categories.length === 0) {
    grid.innerHTML = `<div class="muted-loading">No hay categorías activas todavía.</div>`;
    return;
  }

  const htmlSections = [];

  for (const c of categories) {
    const items = byCat.get(c.id) || [];
    if (items.length === 0) continue; // opcional: ocultar categorías vacías

    htmlSections.push(renderCategorySection(c, items));
  }

  if (htmlSections.length === 0) {
    grid.innerHTML = `<div class="muted-loading">No hay productos activos todavía.</div>`;
    return;
  }

  grid.innerHTML = htmlSections.join("");
}

function renderCategorySection(category, items) {
  const title = escapeHtml(category.name || "Categoría");
  const desc = category.description ? `<div class="cat-desc">${escapeHtml(category.description)}</div>` : "";

  const lis = items.map((p) => {
    const name = escapeHtml(p.name || "");
    const description = p.description ? `<div class="item-desc">${escapeHtml(p.description)}</div>` : "";
    const price = formatARS(p.price);

    return `
      <li>
        <div class="item-left">
          <div class="item-name">${name}</div>
          ${description}
        </div>
        <span class="dots"></span>
        <span class="price">${price}</span>
      </li>
    `;
  }).join("");

  return `
    <section class="menu-column">
      <h2>${title}</h2>
      ${desc}
      <ul class="menu-list">
        ${lis}
      </ul>
    </section>
  `;
}
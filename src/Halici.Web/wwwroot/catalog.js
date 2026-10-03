"use strict";
let rugs = [],
  selectedType = "",
  activeRug,
  activePhoto = 0;
const grid = document.querySelector("#product-grid"),
  dialog = document.querySelector("#gallery");
async function loadCatalog() {
  try {
    rugs = await api("/api/products");
    render();
    window.mountRugScene?.(rugs, openGallery);
  } catch (error) {
    document.querySelector("#result-count").textContent =
      "Koleksiyon yüklenemedi.";
    const retry = el("button", "secondary", "Tekrar dene");
    retry.onclick = loadCatalog;
    grid.replaceChildren(retry);
    toast(error.message);
  }
}
function render() {
  const query = document
    .querySelector("#search")
    .value.toLocaleLowerCase("tr")
    .trim();
  const result = rugs.filter(
    (r) =>
      (!selectedType || r.type === selectedType) &&
      `${r.name} ${r.type} ${r.material} ${r.width} ${r.length}`
        .toLocaleLowerCase("tr")
        .includes(query),
  );
  const sort = document.querySelector("#sort").value;
  if (sort === "name")
    result.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  if (sort === "size")
    result.sort((a, b) => a.width * a.length - b.width * b.length);
  grid.replaceChildren();
  for (const rug of result) {
    const card = el("button", "product-card");
    card.type = "button";
    card.setAttribute(
      "aria-label",
      `${rug.name}, ${rug.width} × ${rug.length} cm, detayları aç`,
    );
    const visual = el("div", "card-visual");
    visual.append(photoElement(rug.photos[0]));
    visual.append(el("span", "card-badge", rug.type));
    if (rug.photos.length > 1)
      visual.append(el("span", "card-photo-count", `▧ ${rug.photos.length}`));
    visual.append(el("span", "card-open", "↗"));
    const info = el("div", "card-info");
    info.append(
      el("h3", "", rug.name),
      el("span", "card-size", `${rug.width} × ${rug.length} cm`),
    );
    const meta = el("div", "card-meta");
    meta.append(
      el("span", "", rug.type),
      el(
        "span",
        rug.available ? "available" : "",
        rug.available ? "• Mevcut" : "Satıldı",
      ),
    );
    card.append(visual, info, meta);
    card.onclick = () => openGallery(rug);
    grid.append(card);
  }
  document.querySelector("#result-count").textContent =
    `${result.length} parça keşfedilmeyi bekliyor`;
  document.querySelector("#empty-state").hidden = result.length !== 0;
  document.querySelector("#sample-notice").hidden = !result.some((r) => r.demo);
}
document.querySelectorAll("[data-type]").forEach(
  (button) =>
    (button.onclick = () => {
      selectedType = button.dataset.type;
      document.querySelectorAll("[data-type]").forEach((b) => {
        b.classList.toggle("selected", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      render();
    }),
);
document.querySelector("#search").oninput = render;
document.querySelector("#sort").onchange = render;
document.querySelector("#reset-filters").onclick = () => {
  document.querySelector("#search").value = "";
  document.querySelector('[data-type=""]').click();
};
function openGallery(rug) {
  activeRug = rug;
  activePhoto = 0;
  for (const [selector, value] of Object.entries({
    "#gallery-name": rug.name,
    "#gallery-type": rug.type,
    "#gallery-size": `${rug.width} × ${rug.length} cm`,
    "#gallery-material": rug.material,
    "#gallery-code": `FT-${String(rug.id).padStart(4, "0")}`,
    "#gallery-description": rug.description,
    "#gallery-status": rug.available ? "Koleksiyonda mevcut" : "Satıldı",
  }))
    document.querySelector(selector).textContent = value;
  renderPhoto();
  dialog.showModal();
  document.body.classList.add("modal-open");
}
function renderPhoto() {
  document
    .querySelector("#gallery-image")
    .replaceChildren(photoElement(activeRug.photos[activePhoto]));
  document.querySelector("#photo-count").textContent =
    `${activePhoto + 1} / ${activeRug.photos.length}`;
  document
    .querySelectorAll(".gallery-arrow")
    .forEach((b) => (b.hidden = activeRug.photos.length < 2));
  const thumbnails = document.querySelector("#thumbnails");
  thumbnails.replaceChildren();
  activeRug.photos.forEach((p, i) => {
    const b = el("button", i === activePhoto ? "selected" : "");
    b.setAttribute("aria-label", `${i + 1}. fotoğrafı göster`);
    b.setAttribute("aria-pressed", String(i === activePhoto));
    b.append(photoElement(p));
    b.onclick = () => {
      activePhoto = i;
      renderPhoto();
    };
    thumbnails.append(b);
  });
}
function movePhoto(direction) {
  activePhoto =
    (activePhoto + direction + activeRug.photos.length) %
    activeRug.photos.length;
  renderPhoto();
}
document.querySelector("#prev-photo").onclick = () => movePhoto(-1);
document.querySelector("#next-photo").onclick = () => movePhoto(1);
document.querySelector(".dialog-close").onclick = () => dialog.close();
dialog.addEventListener("close", () =>
  document.body.classList.remove("modal-open"),
);
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
dialog.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    movePhoto(e.key === "ArrowLeft" ? -1 : 1);
  }
});
const galleryImage = document.querySelector("#gallery-image");
let dragStart;
galleryImage.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  dragStart = e.clientX;
  galleryImage.setPointerCapture(e.pointerId);
});
galleryImage.addEventListener("pointerup", (e) => {
  if (dragStart !== undefined && Math.abs(e.clientX - dragStart) > 45)
    movePhoto(e.clientX < dragStart ? 1 : -1);
  dragStart = undefined;
});
galleryImage.addEventListener("pointercancel", () => (dragStart = undefined));
loadCatalog();

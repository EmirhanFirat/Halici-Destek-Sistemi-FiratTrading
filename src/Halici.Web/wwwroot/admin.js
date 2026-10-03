"use strict";
let products = [],
  editingId = 0,
  photoItems = [],
  deleteId;
const editor = document.querySelector("#editor"),
  form = document.querySelector("#product-form");
const loginPanel = document.querySelector("#login-panel"),
  dashboard = document.querySelector("#dashboard");
async function refresh() {
  products = await api("/api/products");
  renderProducts();
}
function showDashboard(authenticated) {
  loginPanel.hidden = authenticated;
  dashboard.hidden = !authenticated;
}
async function init() {
  try {
    const user = await api("/api/auth/me");
    showDashboard(user.authenticated);
    if (user.authenticated) await refresh();
  } catch (error) {
    toast(error.message);
  }
}
document.querySelector("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;
  document.querySelector("#login-error").textContent = "";
  try {
    const data = Object.fromEntries(new FormData(e.target));
    await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    csrfToken = undefined;
    e.target.reset();
    showDashboard(true);
    await refresh();
  } catch (error) {
    document.querySelector("#login-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
document.querySelector("#logout").onclick = async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    csrfToken = undefined;
    showDashboard(false);
  } catch (error) {
    toast(error.message);
  }
};
function renderProducts() {
  document.querySelector("#total-stat").textContent = products.length;
  document.querySelector("#available-stat").textContent = products.filter(
    (p) => p.available,
  ).length;
  document.querySelector("#photo-stat").textContent = products.reduce(
    (s, p) => s + p.photos.length,
    0,
  );
  const query = document
    .querySelector("#admin-search")
    .value.toLocaleLowerCase("tr");
  const list = document.querySelector("#admin-list");
  list.replaceChildren();
  const filtered = products.filter((p) =>
    `${p.name} ${p.type}`.toLocaleLowerCase("tr").includes(query),
  );
  for (const p of filtered) {
    const row = el("article", "admin-product");
    const visual = el("div", "admin-thumb");
    visual.append(photoElement(p.photos[0]));
    const info = el("div", "admin-product-info");
    info.append(
      el("h3", "", p.name),
      el(
        "p",
        "",
        `${p.type} · ${p.width} × ${p.length} cm${p.demo ? " · Örnek ürün" : ""}`,
      ),
    );
    const status = el(
      "span",
      "status-pill",
      p.available ? "Mevcut" : "Satıldı",
    );
    const actions = el("div", "admin-actions");
    const edit = el("button", "secondary", "Düzenle");
    edit.setAttribute("aria-label", `${p.name} düzenle`);
    edit.onclick = () => openEditor(p);
    const remove = el("button", "text-danger", "Sil");
    remove.setAttribute("aria-label", `${p.name} sil`);
    remove.onclick = () => {
      deleteId = p.id;
      document.querySelector("#delete-error").textContent = "";
      document.querySelector("#delete-message").textContent =
        `“${p.name}” koleksiyondan kaldırılacak.`;
      document.querySelector("#delete-dialog").showModal();
    };
    actions.append(edit, remove);
    row.append(visual, info, status, actions);
    list.append(row);
  }
  if (!filtered.length)
    list.append(
      el(
        "p",
        "empty-state",
        "Henüz görüntülenecek halı yok. Yeni bir halı ekleyerek başlayabilirsiniz.",
      ),
    );
}
document.querySelector("#admin-search").oninput = renderProducts;
function clearPhotos() {
  photoItems.forEach((p) => {
    if (p.preview) URL.revokeObjectURL(p.preview);
  });
  photoItems = [];
}
function openEditor(p) {
  form.reset();
  clearPhotos();
  editingId = p?.id || 0;
  document.querySelector("#editor-title").textContent = p
    ? "Halıyı düzenle"
    : "Yeni halı ekle";
  document.querySelector("#save-error").textContent = "";
  if (p) {
    for (const field of [
      "name",
      "type",
      "width",
      "length",
      "material",
      "description",
    ])
      form.elements[field].value = p[field];
    form.elements.available.checked = p.available;
    photoItems = p.photos.map((photo) => ({ photo }));
  }
  renderPreviews();
  editor.showModal();
  document.body.classList.add("modal-open");
}
document.querySelector("#add-product").onclick = () => openEditor();
document.querySelector("#close-editor").onclick = document.querySelector(
  "#cancel-editor",
).onclick = () => editor.close();
editor.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  clearPhotos();
});
function addFiles(files) {
  document.querySelector("#save-error").textContent = "";
  for (const file of files) {
    if (photoItems.length >= 10) {
      document.querySelector("#save-error").textContent =
        "En fazla 10 fotoğraf ekleyebilirsiniz.";
      break;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024 ||
      file.size < 12
    ) {
      document.querySelector("#save-error").textContent =
        "Fotoğraflar JPEG, PNG veya WebP biçiminde ve en fazla 8 MB olmalıdır.";
      continue;
    }
    photoItems.push({ file, preview: URL.createObjectURL(file) });
  }
  renderPreviews();
}
document.querySelector("#photo-input").onchange = (e) => {
  addFiles(e.target.files);
  e.target.value = "";
};
const dropZone = document.querySelector("#drop-zone");
dropZone.ondragover = (e) => {
  e.preventDefault();
  dropZone.classList.add("dragging");
};
dropZone.ondragleave = () => dropZone.classList.remove("dragging");
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragging");
  addFiles(e.dataTransfer.files);
};
function renderPreviews() {
  const box = document.querySelector("#photo-previews");
  box.replaceChildren();
  photoItems.forEach((item, i) => {
    const preview = el("div", "photo-preview");
    preview.append(photoElement(item.photo || { url: item.preview }));
    if (i === 0) preview.append(el("span", "cover-label", "Kapak"));
    const actions = el("div", "preview-actions");
    for (const [label, delta, text] of [
      ["Öne taşı", -1, "←"],
      ["Arkaya taşı", 1, "→"],
      ["Fotoğrafı kaldır", 0, "×"],
    ]) {
      const b = el("button", "", text);
      b.type = "button";
      b.setAttribute("aria-label", `${i + 1}. fotoğraf: ${label}`);
      b.disabled =
        delta !== 0 && (i + delta < 0 || i + delta >= photoItems.length);
      b.onclick = () => {
        if (delta)
          [photoItems[i], photoItems[i + delta]] = [
            photoItems[i + delta],
            photoItems[i],
          ];
        else {
          if (item.preview) URL.revokeObjectURL(item.preview);
          photoItems.splice(i, 1);
        }
        renderPreviews();
      };
      actions.append(b);
    }
    preview.append(actions);
    box.append(preview);
  });
}
form.onsubmit = async (e) => {
  e.preventDefault();
  const button = document.querySelector("#save-product");
  button.disabled = true;
  button.textContent = "Kaydediliyor…";
  document.querySelector("#save-error").textContent = "";
  try {
    if (!photoItems.length) throw new Error("En az bir fotoğraf ekleyin.");
    const values = Object.fromEntries(new FormData(form));
    const data = {
      ...values,
      width: Number(values.width),
      length: Number(values.length),
      available: form.elements.available.checked,
      keepPhotos: photoItems.filter((p) => p.photo).map((p) => p.photo),
    };
    let oldIndex = 0,
      newIndex = data.keepPhotos.length;
    data.photoOrder = photoItems.map((p) =>
      p.photo ? oldIndex++ : newIndex++,
    );
    const body = new FormData();
    body.append("data", JSON.stringify(data));
    photoItems
      .filter((p) => p.file)
      .forEach((p) => body.append("photos", p.file));
    await api(`/api/admin/products/${editingId}`, { method: "POST", body });
    editor.close();
    toast("Halı kaydedildi. Vitrininiz güncellendi.");
    await refresh();
  } catch (error) {
    document.querySelector("#save-error").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Halıyı kaydet ↗";
  }
};
document.querySelector("#cancel-delete").onclick = () =>
  document.querySelector("#delete-dialog").close();
document.querySelector("#confirm-delete").onclick = async (e) => {
  e.target.disabled = true;
  try {
    await api(`/api/admin/products/${deleteId}`, { method: "DELETE" });
    document.querySelector("#delete-dialog").close();
    toast("Halı koleksiyondan kaldırıldı.");
    await refresh();
  } catch (error) {
    document.querySelector("#delete-error").textContent = error.message;
  } finally {
    e.target.disabled = false;
  }
};
init();

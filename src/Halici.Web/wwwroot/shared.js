"use strict";
let csrfToken;
async function api(url, options = {}) {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") {
    if (!csrfToken) csrfToken = (await (await fetch("/api/csrf")).json()).token;
    headers.set("X-CSRF-TOKEN", csrfToken);
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error ||
        (response.status === 429
          ? "Çok fazla giriş denemesi. Bir dakika sonra tekrar deneyin."
          : response.status === 401
            ? "Oturumunuz sona erdi. Yeniden giriş yapın."
            : "İşlem tamamlanamadı. Lütfen tekrar deneyin."),
    );
  }
  return response.status === 204 ? null : response.json();
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function photoElement(photo, className = "") {
  if (photo.sample !== null && photo.sample !== undefined) {
    const node = el("div", `sample-photo sample-${photo.sample} ${className}`);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", "Halı fotoğrafı");
    return node;
  }
  const node = el("img", className);
  node.src = photo.url;
  node.alt = "Halı fotoğrafı";
  node.loading = "lazy";
  node.draggable = false;
  return node;
}
function toast(message) {
  const box = document.querySelector("#toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (box.hidden = true), 4500);
}
document
  .querySelector("#year")
  ?.replaceChildren(String(new Date().getFullYear()));

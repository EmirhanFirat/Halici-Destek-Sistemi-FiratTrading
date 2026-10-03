"use strict";

// Segmented CSS surfaces keep the photographed patterns intact while bending
// in perspective. No WebGL dependency or continuously running render loop.
window.mountRugScene = (products, openGallery) => {
  const showcase = document.querySelector("#rug-showcase");
  if (!showcase || showcase.dataset.ready) return;
  const available = products.filter(
    (product) => product.available && product.photos.length,
  );
  const featured = [...available]
    .sort((a, b) => {
      const order = [1, 5, 0];
      const rank = (p) => {
        if (!p.demo) return -1;
        const i = order.indexOf(p.photos[0].sample);
        return i < 0 ? 3 : i;
      };
      return rank(a) - rank(b);
    })
    .slice(0, 3);
  if (!featured.length) return;
  showcase.dataset.ready = "true";
  const stage = showcase.querySelector(".rug-stage");
  const inner = showcase.querySelector(".rug-stage-inner");
  const replay = showcase.querySelector(".scene-replay");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia(
    "(hover: hover) and (pointer: fine) and (min-width: 761px)",
  );
  const segments = 10;
  featured.forEach((product, index) => {
    const placement = document.createElement("div");
    placement.className = `rug-placement rug-placement-${index}`;
    const shadow = document.createElement("div");
    shadow.className = "rug-shadow";
    shadow.setAttribute("aria-hidden", "true");
    const rug = document.createElement("button");
    rug.type = "button";
    rug.className = "flying-rug";
    rug.setAttribute(
      "aria-label",
      `${product.name}: fotoğrafları ve ölçüleri incele`,
    );
    rug.addEventListener("click", () => openGallery(product));
    let parent = rug;
    for (let i = 0; i < segments; i++) {
      const segment = document.createElement("span");
      segment.className = "rug-segment";
      segment.style.setProperty("--slice", i);
      segment.setAttribute("aria-hidden", "true");
      const view = document.createElement("span");
      view.className = "rug-texture-window";
      const texture = photoElement(product.photos[0], "rug-texture");
      if (texture.tagName === "IMG") texture.loading = "eager";
      view.append(texture);
      segment.append(view);
      parent.append(segment);
      parent = segment;
    }
    placement.append(shadow, rug);
    inner.append(placement);
  });
  inner.dataset.count = featured.length;
  showcase.hidden = false;
  let played = false,
    frame = 0,
    inView = false;
  function resetTilt() {
    cancelAnimationFrame(frame);
    frame = 0;
    inner.style.setProperty("--pointer-x", "0deg");
    inner.style.setProperty("--pointer-y", "0deg");
  }
  function play() {
    if (reducedMotion.matches) return;
    played = true;
    showcase.classList.remove("scene-entering");
    // Flush the old animation only when explicitly replaying it.
    void showcase.offsetWidth;
    showcase.classList.add("scene-entering");
    showcase.dataset.motion = "playing";
  }
  inner.addEventListener("animationend", (event) => {
    if (
      ["rug-arrive", "rug-arrive-mobile"].includes(event.animationName) &&
      event.target === inner.lastElementChild?.querySelector(".flying-rug")
    ) {
      showcase.dataset.motion = "settled";
    }
  });
  function applyPreference() {
    replay.hidden = reducedMotion.matches;
    if (reducedMotion.matches) {
      showcase.classList.remove("scene-entering");
      showcase.dataset.motion = "reduced";
      resetTilt();
    } else if (inView && !played) play();
    else showcase.dataset.motion = "settled";
  }
  replay.addEventListener("click", play);
  reducedMotion.addEventListener("change", applyPreference);
  finePointer.addEventListener("change", resetTilt);
  stage.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reducedMotion.matches || !inView) return;
    cancelAnimationFrame(frame);
    const bounds = stage.getBoundingClientRect();
    const x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    const y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    frame = requestAnimationFrame(() => {
      inner.style.setProperty("--pointer-x", `${-y * 3}deg`);
      inner.style.setProperty("--pointer-y", `${x * 5}deg`);
      frame = 0;
    });
  });
  stage.addEventListener("pointerleave", resetTilt);
  document.addEventListener("visibilitychange", () => {
    showcase.classList.toggle("scene-paused", document.hidden || !inView);
    if (document.hidden) resetTilt();
  });
  applyPreference();
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        showcase.classList.toggle("scene-paused", !inView || document.hidden);
        if (inView && !played) play();
        if (!inView) resetTilt();
      },
      { threshold: 0.25 },
    );
    observer.observe(showcase);
  } else {
    inView = true;
    play();
  }
};

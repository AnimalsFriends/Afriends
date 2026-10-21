/**
 * Carrusel accesible de la página principal.
 * No usa dependencias; pausa con hover/foco, controles manuales y movimiento reducido.
 */
export function initHomeCarousel(root = document.querySelector("[data-carousel]")) {
  if (!root) return () => {};
  const slides = [...root.querySelectorAll("[data-slide]")];
  const dots = [...root.querySelectorAll("[data-carousel-to]")];
  const prev = root.querySelector("[data-carousel-prev]");
  const next = root.querySelector("[data-carousel-next]");
  const pause = root.querySelector("[data-carousel-pause]");
  if (slides.length < 2) return () => {};

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
  let paused = reducedMotion.matches;
  let hoveredOrFocused = false;
  let timer = null;

  const render = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      if ("inert" in slide) slide.inert = !active;
      else if (!active) slide.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((el) => el.setAttribute("tabindex", "-1"));
      else slide.querySelectorAll('[tabindex="-1"]').forEach((el) => el.removeAttribute("tabindex"));
    });
    dots.forEach((dot, i) => {
      dot.setAttribute("aria-current", String(i === current));
    });
  };

  const stop = () => { if (timer !== null) window.clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (!paused && !hoveredOrFocused && !document.hidden && !reducedMotion.matches) {
      timer = window.setInterval(() => render(current + 1), 6500);
    }
    pause.textContent = paused ? "Reanudar carrusel" : "Pausar carrusel";
    pause.setAttribute("aria-pressed", String(paused));
  };
  const manuallyNavigate = (index) => { render(index); start(); };

  prev?.addEventListener("click", () => manuallyNavigate(current - 1));
  next?.addEventListener("click", () => manuallyNavigate(current + 1));
  dots.forEach((dot) => dot.addEventListener("click", () => manuallyNavigate(Number(dot.dataset.carouselTo))));
  pause?.addEventListener("click", () => { paused = !paused; start(); });
  root.addEventListener("mouseenter", () => { hoveredOrFocused = true; stop(); });
  root.addEventListener("mouseleave", () => { hoveredOrFocused = false; start(); });
  root.addEventListener("focusin", () => { hoveredOrFocused = true; stop(); });
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) { hoveredOrFocused = false; start(); }
  });
  document.addEventListener("visibilitychange", start);
  reducedMotion.addEventListener?.("change", (event) => { if (event.matches) paused = true; start(); });

  render(current);
  start();
  return () => { stop(); document.removeEventListener("visibilitychange", start); };
}

if (typeof document !== "undefined") initHomeCarousel();

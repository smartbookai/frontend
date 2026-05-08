(() => {
  "use strict";

  const BASE_WIDTH = 1366;

  const fitResolution = () => {
    const viewportWidth = window.visualViewport?.width || window.innerWidth || BASE_WIDTH;
    const scale = viewportWidth < BASE_WIDTH ? viewportWidth / BASE_WIDTH : 1;
    document.documentElement.style.setProperty("--screen-fit-scale", scale.toFixed(4));
    document.documentElement.classList.toggle("is-screen-fit", scale < 0.999);
  };

  fitResolution();
  window.addEventListener("DOMContentLoaded", fitResolution, { once: true });
  window.addEventListener("resize", fitResolution, { passive: true });
  window.visualViewport?.addEventListener("resize", fitResolution, { passive: true });
})();

(function () {
  function updateRotateHint() {
    document.documentElement.classList.remove("need-rotate");
  }

  function syncViewportTopInset() {
    const vv = window.visualViewport;
    const topOffset = vv && Number.isFinite(vv.offsetTop) ? Math.max(0, vv.offsetTop) : 0;
    document.documentElement.style.setProperty("--vv-top-offset", `${topOffset.toFixed(2)}px`);
  }

  window.addEventListener("resize", updateRotateHint, { passive: true });
  window.addEventListener("resize", syncViewportTopInset, { passive: true });
  window.addEventListener("orientationchange", syncViewportTopInset, { passive: true });
  if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
    window.visualViewport.addEventListener("resize", syncViewportTopInset, { passive: true });
    window.visualViewport.addEventListener("scroll", syncViewportTopInset, { passive: true });
  }
  const mql = window.matchMedia("(orientation: landscape)");
  if (mql && typeof mql.addEventListener === "function") {
    mql.addEventListener("change", updateRotateHint);
    mql.addEventListener("change", syncViewportTopInset);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      updateRotateHint();
      syncViewportTopInset();
    });
  } else {
    updateRotateHint();
    syncViewportTopInset();
  }
})();

const isPanelOpen = () => {
  const el = document.getElementById("brightnessPanel");
  return !!el && getComputedStyle(el).display !== "none";
};

function positionBrightnessPanel() {
  const brightnessPanel = document.getElementById("brightnessPanel");
  const btnBrightness = document.getElementById("btnBrightness") || document.getElementById("btnBright");
  if (!brightnessPanel || !btnBrightness) return;

  const wasHidden = getComputedStyle(brightnessPanel).display === "none";
  if (wasHidden) {
    brightnessPanel.style.visibility = "hidden";
    brightnessPanel.style.display = "block";
  }

  const btnRect = btnBrightness.getBoundingClientRect();
  const panW = brightnessPanel.offsetWidth;
  const centerX = btnRect.left + btnRect.width / 2;
  let left = Math.round(centerX - panW / 2);
  left = Math.max(8, Math.min(left, window.innerWidth - panW - 8));

  brightnessPanel.style.left = `${left}px`;
  brightnessPanel.style.right = "auto";

  if (wasHidden) {
    brightnessPanel.style.display = "none";
    brightnessPanel.style.visibility = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const cinemaEnterLabel = "影院模式";
  const cinemaExitLabel = "退出影院模式";
  const topActions = document.querySelector(".top-actions");
  const btnReset = document.getElementById("btnReset");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnToggleMode = document.getElementById("btnToggleMode");
  const btnCinema = document.getElementById("btnCinema");
  const btnClose = document.getElementById("btnClose");
  const btnBrightness = document.getElementById("btnBrightness") || document.getElementById("btnBright");
  const btnLudicrous = document.getElementById("btnLudicrous");
  const canvas = document.getElementById("stage");
  const infoCloseBtn = document.getElementById("infoCloseBtn");
  const brightnessPanel = document.getElementById("brightnessPanel");

  let onOutside = null;
  let onEsc = null;

  function syncCinemaButton(isCinemaMode) {
    if (!btnCinema) return;
    btnCinema.setAttribute("aria-pressed", String(isCinemaMode));
    btnCinema.textContent = isCinemaMode ? cinemaExitLabel : cinemaEnterLabel;
    btnCinema.title = isCinemaMode ? cinemaExitLabel : "切换影院模式";
  }

  const searchParams = new URLSearchParams(window.location.search);
  if (!searchParams.get("closable") && btnClose) {
    btnClose.style.display = "none";
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "dream-lab:solar-system-close" }, "*");
        }
      } catch (_) {}
    });
  }

  function disableOutsideClose() {
    if (onOutside) {
      document.removeEventListener("click", onOutside, true);
      document.removeEventListener("touchstart", onOutside, true);
      onOutside = null;
    }
    if (onEsc) {
      window.removeEventListener("keydown", onEsc);
      onEsc = null;
    }
  }

  function closeBrightnessPanel() {
    if (isPanelOpen()) solarSystemController.toggleBrightnessPanel();
    disableOutsideClose();
  }

  function enableOutsideClose() {
    disableOutsideClose();
    onOutside = (event) => {
      const target = event.target;
      if ((brightnessPanel && brightnessPanel.contains(target)) || (btnBrightness && btnBrightness.contains(target))) {
        return;
      }
      closeBrightnessPanel();
    };
    onEsc = (event) => {
      if (event.key === "Escape") closeBrightnessPanel();
    };
    document.addEventListener("click", onOutside, true);
    document.addEventListener("touchstart", onOutside, { capture: true, passive: true });
    window.addEventListener("keydown", onEsc);
  }

  function focusFirstInPanel() {
    if (!brightnessPanel) return;
    const first = brightnessPanel.querySelector("input,button,select,textarea,[tabindex]:not([tabindex='-1'])");
    if (first) first.focus({ preventScroll: true });
  }

  if (btnReset) btnReset.addEventListener("click", () => solarSystemController.resetView());
  if (btnPlayPause) btnPlayPause.addEventListener("click", () => solarSystemController.togglePlayPauseAndNow());
  if (btnToggleMode) btnToggleMode.addEventListener("click", () => solarSystemController.toggleScientificMode());
  if (btnCinema) {
    btnCinema.addEventListener("click", () => {
      const nextState = btnCinema.getAttribute("aria-pressed") !== "true";
      solarSystemController.toggleCinemaMode();
      syncCinemaButton(nextState);
    });
  }
  if (btnLudicrous) btnLudicrous.addEventListener("click", () => solarSystemController.toggleLudicrousSpeed());
  if (window.solarControls && typeof window.solarControls.bindController === "function") {
    window.solarControls.bindController(solarSystemController);
  }

  if (btnBrightness) {
    btnBrightness.setAttribute("role", "button");
    btnBrightness.setAttribute("aria-label", "调整亮度");
    btnBrightness.addEventListener("mousedown", (event) => event.stopPropagation());
    btnBrightness.addEventListener("click", () => {
      solarSystemController.toggleBrightnessPanel();
      if (isPanelOpen()) {
        positionBrightnessPanel();
        enableOutsideClose();
        focusFirstInPanel();
      } else {
        disableOutsideClose();
      }
    });
  }

  if (brightnessPanel) brightnessPanel.addEventListener("mousedown", (event) => event.stopPropagation());

  if (canvas) {
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      solarSystemController.handleCanvasClick(event.clientX - rect.left, event.clientY - rect.top);
    });
  }

  if (infoCloseBtn) infoCloseBtn.addEventListener("click", () => solarSystemController.closeInfoPanel());

  [
    { id: "slBelt", target: "belt" },
    { id: "slKuiper", target: "kuiper" },
    { id: "slGalaxy", target: "galaxy" },
    { id: "slLabels", target: "labels" },
  ].forEach(({ id, target }) => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.addEventListener("input", (event) => {
        solarSystemController.setBrightness(target, parseFloat(event.target.value));
      });
    }
  });

  document.querySelectorAll("input[type='range']").forEach((range) => {
    range.addEventListener("keydown", (event) => {
      const step = parseFloat(range.step || "0.01") || 0.01;
      let value = parseFloat(range.value || "0");
      if (event.key === "ArrowRight" || event.key === "ArrowUp") value += step;
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") value -= step;
      else return;
      event.preventDefault();
      const min = parseFloat(range.min || "0");
      const max = parseFloat(range.max || "1");
      value = Math.max(min, Math.min(max, value));
      range.value = String(value);
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  if (topActions) {
    topActions.addEventListener("mousedown", (event) => event.stopPropagation());
  }

  syncCinemaButton(btnCinema?.getAttribute("aria-pressed") === "true");
});

window.addEventListener("resize", () => {
  if (isPanelOpen()) positionBrightnessPanel();
});

window.addEventListener("orientationchange", () => {
  if (isPanelOpen()) positionBrightnessPanel();
});

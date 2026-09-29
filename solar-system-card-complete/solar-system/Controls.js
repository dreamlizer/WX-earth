(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const controls = {
    speedRange: null,
    zoomRange: null,
    tiltTrack: null,
    tiltFill: null,
    tiltThumb: null,
    controller: null,
    draggingTilt: false,
    _bound: false,

    init() {
      this.speedRange = document.getElementById("speedRange");
      this.zoomRange = document.getElementById("zoomRange");
      this.tiltTrack = document.getElementById("tiltTrack");
      this.tiltFill = document.getElementById("tiltFill");
      this.tiltThumb = document.getElementById("tiltThumb");
    },

    setRangeVisual(rangeEl, value) {
      if (!rangeEl || !Number.isFinite(value)) return;
      const min = parseFloat(rangeEl.min || "0");
      const max = parseFloat(rangeEl.max || "100");
      const span = max - min;
      if (!Number.isFinite(span) || span <= 0) return;

      const pct = clamp(((value - min) / span) * 100, 0, 100);
      rangeEl.style.setProperty("--value-pct", `${pct.toFixed(3)}%`);

      const shell = rangeEl.closest(".range-control");
      if (shell) {
        shell.style.setProperty("--value-pct", `${pct.toFixed(3)}%`);
        shell.style.setProperty("--thumb-pct", `${clamp(pct, 2, 98).toFixed(3)}%`);
      }
    },

    setTiltVisual(value) {
      if (!this.tiltTrack || !this.tiltFill || !this.tiltThumb) this.init();
      if (!this.tiltTrack || !this.tiltFill || !this.tiltThumb) return;

      const nextValue = clamp(Number(value) || 0, 0, 90);
      const ratio = nextValue / 90;
      const pct = (ratio * 100).toFixed(2);

      this.tiltTrack.setAttribute("aria-valuenow", String(Math.round(nextValue)));
      this.tiltThumb.style.bottom = `calc(${pct}% - 11px)`;
      this.tiltFill.style.height = `${pct}%`;
    },

    updateTiltFromClientY(clientY) {
      if (!this.tiltTrack || !this.controller || typeof this.controller.setTilt !== "function") return;
      const rect = this.tiltTrack.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height;
      this.controller.setTilt(clamp(ratio * 90, 0, 90));
    },

    bindController(controller) {
      this.controller = controller || null;
      if (this._bound) {
        this.syncFromDom();
        return;
      }
      this.init();

      if (this.speedRange) {
        this.speedRange.addEventListener("input", (event) => {
          if (!this.controller || typeof this.controller.setSpeed !== "function") return;
          this.controller.setSpeed(parseFloat(event.target.value));
        });
      }

      if (this.zoomRange) {
        this.zoomRange.addEventListener("input", (event) => {
          if (!this.controller || typeof this.controller.setZoom !== "function") return;
          this.controller.setZoom(parseFloat(event.target.value));
        });
      }

      if (this.tiltTrack) {
        this.tiltTrack.addEventListener("pointerdown", (event) => {
          this.draggingTilt = true;
          this.tiltTrack.setPointerCapture?.(event.pointerId);
          this.updateTiltFromClientY(event.clientY);
        });

        this.tiltTrack.addEventListener("pointermove", (event) => {
          if (!this.draggingTilt) return;
          this.updateTiltFromClientY(event.clientY);
        });

        this.tiltTrack.addEventListener("pointerup", (event) => {
          this.draggingTilt = false;
          this.tiltTrack.releasePointerCapture?.(event.pointerId);
        });

        this.tiltTrack.addEventListener("pointercancel", () => {
          this.draggingTilt = false;
        });

        this.tiltTrack.addEventListener("keydown", (event) => {
          if (!this.controller || typeof this.controller.setTilt !== "function") return;
          const currentValue = Number(this.tiltTrack.getAttribute("aria-valuenow") || "0");
          let nextValue = currentValue;
          if (event.key === "ArrowUp" || event.key === "ArrowRight") nextValue += 1;
          else if (event.key === "ArrowDown" || event.key === "ArrowLeft") nextValue -= 1;
          else if (event.key === "PageUp") nextValue += 5;
          else if (event.key === "PageDown") nextValue -= 5;
          else if (event.key === "Home") nextValue = 0;
          else if (event.key === "End") nextValue = 90;
          else return;
          event.preventDefault();
          this.controller.setTilt(clamp(nextValue, 0, 90));
        });
      }

      this.syncFromDom();
      this._bound = true;
    },

    syncFromDom() {
      if (this.speedRange) {
        const speedValue = parseFloat(this.speedRange.value);
        if (Number.isFinite(speedValue)) this.setRangeVisual(this.speedRange, speedValue);
      }
      if (this.zoomRange) {
        const zoomValue = parseFloat(this.zoomRange.value);
        if (Number.isFinite(zoomValue)) this.setRangeVisual(this.zoomRange, zoomValue);
      }
      if (this.tiltTrack) {
        const tiltValue = Number(this.tiltTrack.getAttribute("aria-valuenow") || "0");
        this.setTiltVisual(Number.isFinite(tiltValue) ? tiltValue : 0);
      }
    },
  };

  window.solarControls = controls;
  window.setTiltUiValue = (value) => controls.setTiltVisual(value);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => controls.init());
  } else {
    controls.init();
  }
})();

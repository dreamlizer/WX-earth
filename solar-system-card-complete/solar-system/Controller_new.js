const solarSystemController = {
    state: {
        scientific: (localStorage.getItem('m.sci') || '0') === '1',
        cinema: false,
    },

    resetView() {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('resetView');
        }
    },

    togglePlayPauseAndNow() {
        if (!window.solarSystemEngine) return;

        const btn = document.getElementById('btnPlayPause');
        if (!btn) return;

        const isCurrentlyRunning = btn.getAttribute('aria-pressed') === 'true';
        const isPanelVisible = !!window.isSnapshotVisible;

        if (isPanelVisible) {
            solarSystemEngine.command('hideSnapshot');
            solarSystemEngine.command('play');
            return;
        }

        if (isCurrentlyRunning) {
            solarSystemEngine.command('setToNow');
            solarSystemEngine.command('pause');
            solarSystemEngine.command('showSnapshot');
            return;
        }

        solarSystemEngine.command('play');
    },

    setSpeed(newSpeed) {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('setSpeed', newSpeed);
        }
    },

    setZoom(newZoom) {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('setZoom', newZoom);
        }
    },

    setTilt(newTilt) {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('setTilt', newTilt);
        }
    },

    toggleScientificMode() {
        this.state.scientific = !this.state.scientific;
        if (window.solarSystemEngine) {
            solarSystemEngine.command('setScientificMode', this.state.scientific);
        }
    },

    toggleCinemaMode() {
        this.state.cinema = !this.state.cinema;
        if (window.solarSystemEngine) {
            solarSystemEngine.command('setCinemaMode', this.state.cinema);
        }
    },

    toggleBrightnessPanel() {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('toggleBrightnessPanel');
        }
    },

    setBrightness(target, value) {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('setBrightness', { target, value });
        }
    },

    handleCanvasClick(x, y) {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('handleCanvasClick', { x, y });
        }
    },

    closeInfoPanel() {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('closeInfoPanel');
        }
    },

    toggleLudicrousSpeed() {
        if (window.solarSystemEngine) {
            solarSystemEngine.command('toggleLudicrousSpeed');
        }
    }
};

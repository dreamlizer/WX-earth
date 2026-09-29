// Galaxy.js: (V13 - 精细分层渲染最终版)

(function() {
    // --- 模块内部变量 ---
    const gal = { rot: -0.35, particles: [], coreRidge: [] };
    const galaxyLayers = [];
    const nebulae = [];

    // --- 内部函数 (这部分与之前版本相同) ---
    function buildGalaxyResources() {
        gal.particles = []; gal.coreRidge = []; (function() { const ANG = 25 * Math.PI / 180; const HALF_LEN = 0.34; const HALF_WID = 0.085; const COUNT = 900; for (let i = 0; i < COUNT; i++) { const t = (Math.random() * 2 - 1) * HALF_LEN; const w = (Math.random() * 2 - 1) * HALF_WID * (1 - Math.abs(t) / HALF_LEN); const x = t * Math.cos(ANG) - w * Math.sin(ANG); const y = t * Math.sin(ANG) + w * Math.cos(ANG); const a = 1.0 - Math.min(1, Math.abs(t) / HALF_LEN); gal.coreRidge.push({ x, y, a }); } })(); const N = 5000; for (let i = 0; i < N; i++) { const arm = i % 4; const t = Math.random() * 9 * Math.PI; const b = 0.21; let r = 0.05 * Math.exp(b * t) + (Math.random() - 0.5) * 0.06; r = Math.max(0.01, Math.min(0.98, r)); const a = arm * (Math.PI / 2) + t + (Math.random() - 0.5) * 0.35; const particle = { r, a, phase: Math.random() * Math.PI * 2, tw: 0.5 + Math.random() * 1.5 }; const typeChance = Math.random(); if (typeChance < 0.05) { particle.type = 'bright_star'; particle.mag = 1.0 + Math.random() * 0.5; } else if (typeChance < 0.45) { particle.type = 'dust'; particle.mag = 0.2 + Math.random() * 0.4; } else { particle.type = 'star'; particle.mag = 0.5 + Math.random() * 0.5; } gal.particles.push(particle); }
    }
    function buildStarfieldResources() {
        const L = [{ z: 0.4, n: 1500 }, { z: 0.7, n: 2600 }, { z: 1.0, n: 3600 }]; for (const l of L) { const pts = []; for (let i = 0; i < l.n; i++) { pts.push({ x: Math.random() * 1.4 - 0.2, y: Math.random() * 1.4 - 0.2, a: 0.5 + 0.5 * Math.random() }); } galaxyLayers.push({ z: l.z, pts }); } for (let i = 0; i < 48; i++) { nebulae.push({ x: Math.random() * 1.2 - 0.1, y: Math.random() * 1.2 - 0.1, r: 0.06 + Math.random() * 0.18, a: 0.02 + Math.random() * 0.06 }); }
    }
    function getSafeRgba(r, g, b, alpha) { const safeAlpha = (isNaN(alpha) || alpha < 0) ? 0 : alpha; return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`; }

    // ★★★ 修改点 1: 让银河主体函数接收 cameraOffset 参数，用于计算视差 ★★★
    function drawMilkyWaySystem(ctx, amount, W, H, cameraOffset) {
        if (amount <= 0.01) return;
        const R = Math.max(W, H) * 1.60;
        const cx = W / 2, cy = H / 2;

        // 计算一个非常微弱的视差效果，因为银河非常非常遥远
        const parallaxX = cameraOffset.x * 0.08;
        const parallaxY = cameraOffset.y * 0.08;

        ctx.save();
        // ★★★ 修改点 2: 将计算出的视差应用到平移变换中 ★★★
        ctx.translate(cx + R * -0.55 + parallaxX, cy + R * 0.2 + parallaxY);
        ctx.rotate(gal.rot);

        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.15);
        coreGrad.addColorStop(0, getSafeRgba(255, 245, 230, 0.9 * amount));
        coreGrad.addColorStop(1, "rgba(255, 200, 150, 0)");

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        for (const p of gal.coreRidge) {
            const alpha = 0.65 * amount * p.a;
            if (alpha <= 0) continue;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255, 232, 205, 1)';
            const bx = p.x * R;
            const by = p.y * R * 0.55;
            ctx.beginPath();
            ctx.ellipse(bx, by, 2.2, 1.3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        const now = performance.now() * 0.001;
        for (const s of gal.particles) {
            const rr = s.r * R;
            const x = rr * Math.cos(s.a);
            const y = rr * 0.5 * Math.sin(s.a);
            const flick = 0.7 + 0.3 * Math.sin(now * s.tw + s.phase);
            let color, size = 1;
            if (s.type === 'bright_star') {
                color = getSafeRgba(200, 225, 255, s.mag * flick * amount);
                size = 2;
            } else if (s.type === 'dust') {
                color = getSafeRgba(40, 25, 20, s.mag * amount * 0.5);
                size = Math.random() < 0.5 ? 2 : 3;
            } else {
                color = getSafeRgba(255, 240, 220, s.mag * flick * amount * 0.7);
            }
            ctx.fillStyle = color;
            ctx.fillRect(x | 0, y | 0, size, size);
        }
        ctx.restore();
    }

    function drawStarfield(ctx, amount, cameraOffset, W, H) {
        if (amount <= 0.01) return;
        const px = (cameraOffset.x / W), py = (cameraOffset.y / H);
        ctx.save();
        for (const nb of nebulae) { const X = (nb.x * W - px * 120) | 0, Y = (nb.y * H - py * 120) | 0; const R = Math.min(W, H) * nb.r; const g = ctx.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, getSafeRgba(140, 180, 255, nb.a * amount)); g.addColorStop(1, 'rgba(140, 180, 255, 0)'); ctx.fillStyle = g; ctx.globalAlpha = 0.15 * amount; ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); ctx.save(); for (const L of galaxyLayers) { for (const p of L.pts) { const sx = (p.x * W - px * 60 * L.z) | 0, sy = (p.y * H - py * 60 * L.z) | 0; const alpha = (0.15 + 0.45 * p.a) * amount; ctx.globalAlpha = alpha; ctx.fillStyle = '#e8f1ff'; ctx.fillRect(sx, sy, 1, 1); if (Math.random() < 0.05) { ctx.fillRect(sx + 1, sy, 1, 1); } } } ctx.restore();
    }

    window.galaxyDrawer = {
        init: function() {
            buildGalaxyResources();
            buildStarfieldResources();
            console.log(`Galaxy Drawer Initialized. Milky Way particles: ${gal.particles.length}, Starfield layers: ${galaxyLayers.length}`);
        },

        draw: function(ctx, galaxyAmount, cameraOffset, W, H, brightness) {
            const safeBrightness = (typeof brightness === 'number') ? brightness : 0.7;
            const visualBrightness = Math.max(0, Math.min(1, safeBrightness));
            const safeGalaxyAmount = galaxyAmount || 0;

            const gbg = ctx.createLinearGradient(0, 0, 0, H);
            gbg.addColorStop(0, '#050a1a');
            gbg.addColorStop(1, '#070b1e');
            ctx.fillStyle = gbg;
            ctx.fillRect(0, 0, W, H);

            const finalGalaxyVisibility = safeGalaxyAmount * (0.15 + 1.25 * visualBrightness);

            // 银河主体的渲染逻辑保持不变，它只在远景时出现
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const milkyWayAmount = finalGalaxyVisibility * 1.8;
            // ★★★ 修改点 3: 将 cameraOffset 传递给银河主体绘制函数 ★★★
            drawMilkyWaySystem(ctx, milkyWayAmount, W, H, cameraOffset);
            ctx.restore();

            // 恢复原始的星空背景逻辑：它在近景时也可见 (因为 1 + ...)，实现了基础星空的效果
            const starfieldAmount = (0.35 + safeGalaxyAmount * 1.7) * (0.2 + 1.15 * visualBrightness);
            drawStarfield(ctx, starfieldAmount, cameraOffset, W, H);

            // Make low brightness states visibly darker on mobile/small screens.
            const dimAlpha = Math.max(0, (0.55 - visualBrightness) * 1.05);
            if (dimAlpha > 0.01) {
                ctx.save();
                ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha.toFixed(3)})`;
                ctx.fillRect(0, 0, W, H);
                ctx.restore();
            }
        }
    };
})();

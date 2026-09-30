/*
  Hero simulations. One is picked at random per page load (never the same twice in a row).
  Force one for testing by adding ?sim=NAME to the URL. Names:
    catch, car, ascent, wing, orbit, jet, engine, vortex, suspension
  To remove a simulation, delete its line in the `scenes` object near the bottom.
*/
(function(){
  const cv = document.getElementById('flow');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PI = Math.PI, TAU = 2 * PI;

  // Palettes
  const PAL = ['#3D7BFF', '#6E7F92', '#39C6D6', '#F4C542', '#F2603A'];      // airspeed: slow .. fastest
  const TCOL = ['#3D7BFF', '#39C6D6', '#F4C542', '#FF7A2E', '#FFF4DA'];     // temperature: cold .. hottest
  const FIRE = ['#FFF4DA', '#FFC24A', '#FF7A2E', '#A8301A'];
  const INK = '#F2F2F2', MUTE = '#8C8C8C', FILL = '#050505';
  const GRAD_SPEED = 'linear-gradient(90deg,#3D7BFF,#6E7F92,#39C6D6,#F4C542,#F2603A)';
  const GRAD_TEMP = 'linear-gradient(90deg,#3D7BFF,#39C6D6,#F4C542,#FF7A2E,#FFF4DA)';
  const tBucket = T => T < 380 ? 0 : T < 700 ? 1 : T < 1100 ? 2 : T < 1500 ? 3 : 4;
  let W = 0, H = 0, mobile = false, F = 0; // F = global frame counter

  // ---------- helpers ----------
  const fade = a => { ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(0, 0, W, H); };
  const clear = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); };
  const newPaths = n => Array.from({ length: n }, () => new Path2D());
  const seg = (p, x0, y0, x1, y1) => { p.moveTo(x0, y0); p.lineTo(x1, y1); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function strokePaths(paths, cols, lw){
    ctx.lineWidth = lw; ctx.lineCap = 'round';
    paths.forEach((p, i) => { ctx.strokeStyle = cols[i]; ctx.stroke(p); });
  }
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += Math.random(); return (u - 2) * 1.7; };
  function table(tbl, x){
    if (x <= tbl[0][0]) return tbl[0][1];
    for (let i = 1; i < tbl.length; i++){
      if (x <= tbl[i][0]){ const [a0, b0] = tbl[i - 1], [a1, b1] = tbl[i]; return b0 + (b1 - b0) * (x - a0) / (a1 - a0); }
    }
    return tbl[tbl.length - 1][1];
  }
  function drawFire(list, lw, tail, alpha){
    const paths = newPaths(4);
    for (const f of list){
      if (f.dust) continue;
      const t = f.age / f.life, b = t < 0.08 ? 0 : t < 0.35 ? 1 : t < 0.7 ? 2 : 3;
      if (tail) seg(paths[b], f.X - f.vx * tail, f.Y - f.vy * tail, f.X, f.Y);
      else seg(paths[b], f.px, f.py, f.X, f.Y);
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha || 0.5;
    strokePaths(paths, FIRE, lw);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // Text readout: first line bright, the rest muted
  function readout(x, y, lines, align){
    ctx.font = (mobile ? 11 : 12.5) + 'px "Hanken Grotesk", Arial, sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    const lh = mobile ? 15 : 17, wmax = Math.max(...lines.map(l => ctx.measureText(l).width));
    ctx.fillStyle = '#000'; ctx.fillRect(align === 'right' ? x - wmax - 6 : x - 6, y - 15, wmax + 12, lh * lines.length + 8);
    lines.forEach((l, i) => { ctx.fillStyle = i === 0 ? INK : MUTE; ctx.fillText(l, x, y + i * lh); });
  }
  // stroke style that fades out toward the left, so ground lines don't run through the name
  function leftFade(col){
    if (mobile) return col;
    const g = ctx.createLinearGradient(W * 0.3, 0, W * 0.48, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col); return g;
  }
  function makeStars(n, maxY){
    return Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * maxY, a: 0.12 + Math.random() * 0.5, r: Math.random() < 0.1 ? 1.5 : 0.9 }));
  }
  function drawStars(st){
    ctx.fillStyle = INK;
    for (const s of st){ ctx.globalAlpha = s.a; ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
  }
  function coil(x0, y0, x1, y1, w, turns){
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    const n = turns * 2;
    for (let i = 1; i < n; i++){
      const t = i / n, s = (i % 2 ? 1 : -1) * w / 2;
      ctx.lineTo(x0 + dx * t + nx * s, y0 + dy * t + ny * s);
    }
    ctx.lineTo(x1, y1); ctx.stroke();
  }
  // complex numbers as [re, im]
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const div = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
  const sc = (p, k) => [p[0] * k, p[1] * k];
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

  // =========================================================
  // Booster catch: constant-deceleration landing burn into the tower arms
  // =========================================================
  function Catch(){
    const V0 = 160, A = 25, HB = V0 * V0 / (2 * A), HC = HB + 220, DT = 1 / 60;
    let bx, bw, len, restTop, GY, tX, tW, tTop, armY, k, stars, fire, hist;
    let phase, t, h, v, arm, thr, tHold, settle, gim;

    function reset(){ phase = 'coast'; h = HC; v = V0; arm = 1; thr = 0; t = 0; tHold = 0; settle = 0; gim = 0; fire = []; hist = []; }

    function update(){
      const tb = V0 / A;
      if (phase === 'coast'){
        h -= V0 * DT; v = V0; thr = 0;
        if (h <= HB){ h = HB; phase = 'burn'; t = 0; }
      } else if (phase === 'burn'){
        t += DT;
        if (t >= tb){ t = tb; phase = 'caught'; tHold = 0; }
        h = Math.max(0, HB - V0 * t + A * t * t / 2);
        v = Math.max(0, V0 - A * t);
        thr = t < tb - 1.2 ? 1 : 0.45 + 0.55 * (tb - t) / 1.2;
        arm = t < tb - 1.4 ? 1 : Math.max(0, (tb - t) / 1.4);
        gim = Math.sin(t * 2.3) * 0.12 * (1 - t / tb);
        if (phase === 'caught'){ thr = 0; arm = 0; }
      } else if (phase === 'caught'){
        tHold += DT; thr = 0; v = 0; h = 0; arm = 0;
        settle = Math.min(1, tHold / 1.2);
        if (tHold > 3.4){ phase = 'out'; tHold = 0; }
      } else if (phase === 'out'){
        tHold += DT;
        if (tHold > 1) reset();
      }
      if (phase === 'burn' || phase === 'coast') hist.push(h);

      const top = restTop - h * k + settle * len * 0.025, bot = top + len;
      if (thr > 0){
        const n = Math.round((mobile ? 8 : 13) * thr), vpx = v * k * DT;
        for (let i = 0; i < n; i++){
          const o = [-0.28, 0, 0.28][i % 3] * bw + (Math.random() - 0.5) * bw * 0.15;
          fire.push({ X: bx + o, Y: bot + bw * 0.3, vx: (Math.random() - 0.5) * 1.2 + o * 0.02 + gim * 6,
            vy: vpx + 8 + Math.random() * 6, age: 0, life: 25 + Math.random() * 25 });
        }
      }
      for (const f of fire){
        f.X += f.vx; f.Y += f.vy; f.age++;
        if (!f.dust){
          f.vx *= 1.01;
          if (f.Y >= GY){
            f.dust = true; f.Y = GY - 1; f.vy = -(0.3 + Math.random() * 1.2);
            f.vx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
            f.life = f.age + 40 + Math.random() * 40;
          }
        } else { f.vx *= 0.97; f.vy *= 0.97; }
      }
      fire = fire.filter(f => f.age < f.life);
    }

    function drawGround(){
      ctx.fillStyle = '#000'; ctx.fillRect(0, GY, W, H - GY);
      ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(Math.max(0, bx - bw * 8), GY); ctx.lineTo(W, GY); ctx.stroke();
      // launch mount under the tower
      ctx.strokeStyle = '#4A4A4A'; ctx.strokeRect(tX - tW * 0.6, GY - bw * 0.5, tW * 2.2, bw * 0.5);
    }
    function drawTower(){
      ctx.strokeStyle = '#6E6E6E'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(tX, tTop); ctx.lineTo(tX, GY); ctx.moveTo(tX + tW, tTop); ctx.lineTo(tX + tW, GY);
      const step = tW * 1.1;
      for (let y = tTop; y < GY; y += step){
        ctx.moveTo(tX, y); ctx.lineTo(tX + tW, y);
        ctx.moveTo(tX, y); ctx.lineTo(tX + tW, Math.min(GY, y + step));
      }
      ctx.moveTo(tX + tW / 2, tTop); ctx.lineTo(tX + tW / 2, tTop - tW * 1.3);
      ctx.stroke();
      // aviation lights
      const on = (F % 90) < 45;
      [[tX + tW / 2, tTop - tW * 1.3], [tX, tTop + (GY - tTop) * 0.5], [tX + tW, tTop + (GY - tTop) * 0.5]].forEach(([x, y], i) => {
        const lit = i === 0 ? on : !on;
        ctx.fillStyle = lit ? '#FF3B30' : '#3A1210';
        ctx.beginPath(); ctx.arc(x, y, lit ? 2.6 : 1.8, 0, TAU); ctx.fill();
        if (lit){ ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      });
    }
    function drawCarriage(){
      const ay = armY + settle * len * 0.025;
      ctx.fillStyle = '#141414'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(tX - 2, ay - bw * 0.45, tW + 4, bw * 0.9);
      ctx.strokeRect(tX - 2, ay - bw * 0.45, tW + 4, bw * 0.9);
    }
    function drawArm(back){
      const ay = armY + settle * len * 0.025 - (back ? bw * 0.18 : 0);
      const reach = tX - (bx - bw / 2) + bw * 0.3, th = arm * 1.1 + (back ? arm * 0.08 : 0);
      ctx.strokeStyle = back ? '#5A5A5A' : '#BDBDBD'; ctx.lineWidth = bw * (back ? 0.16 : 0.2); ctx.lineCap = 'butt';
      const ex = tX - Math.cos(th) * reach, ey = ay - Math.sin(th) * reach;
      ctx.beginPath(); ctx.moveTo(tX, ay); ctx.lineTo(ex, ey); ctx.stroke();
      if (!back){
        // truss detail along the arm
        ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 8; i++){
          const f = i / 8, px = tX + (ex - tX) * f, py = ay + (ey - ay) * f;
          ctx.moveTo(px - Math.sin(th) * bw * 0.09, py - Math.cos(th) * bw * 0.09);
          ctx.lineTo(px + Math.sin(th) * bw * 0.09, py + Math.cos(th) * bw * 0.09);
        }
        ctx.stroke(); ctx.restore();
      }
    }
    function drawBooster(){
      const x0 = bx - bw / 2, top = restTop - h * k + settle * len * 0.025, bot = top + len;
      if (bot < -20) return;
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
      // engines, gimballing slightly
      [-0.28, 0, 0.28].forEach(o => {
        const ex = bx + o * bw, sk = gim * bw * 0.6;
        ctx.beginPath();
        ctx.moveTo(ex - bw * 0.08, bot); ctx.lineTo(ex - bw * 0.13 + sk, bot + bw * 0.3);
        ctx.lineTo(ex + bw * 0.13 + sk, bot + bw * 0.3); ctx.lineTo(ex + bw * 0.08, bot);
        ctx.closePath(); ctx.fillStyle = '#161616'; ctx.fill(); ctx.stroke();
      });
      // shock diamonds in the plume core
      if (thr > 0.6){
        ctx.globalCompositeOperation = 'lighter';
        [-0.28, 0, 0.28].forEach(o => {
          for (let i = 1; i <= 3; i++){
            const y = bot + bw * 0.3 + i * bw * 0.55, a = (0.5 - i * 0.12) * (0.8 + Math.random() * 0.2);
            ctx.globalAlpha = a; ctx.fillStyle = '#FFF4DA';
            ctx.beginPath(); ctx.ellipse(bx + o * bw + gim * bw * i, y, bw * 0.06, bw * 0.16, 0, 0, TAU); ctx.fill();
          }
        });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = FILL; ctx.fillRect(x0, top, bw, len); ctx.strokeRect(x0, top, bw, len);
      // chines and panel lines
      ctx.save(); ctx.globalAlpha = 0.4; ctx.beginPath();
      [0.12, 0.33, 0.55, 0.77, 0.9].forEach(f => { ctx.moveTo(x0, top + len * f); ctx.lineTo(x0 + bw, top + len * f); });
      ctx.moveTo(bx, top + len * 0.12); ctx.lineTo(bx, top + len * 0.9);
      ctx.stroke(); ctx.restore();
      // grid fins, twitching as they steer
      [-1, 1].forEach(d => {
        const fw = bw * 0.42, fh = bw * 0.36, fx = d < 0 ? x0 - fw : x0 + bw, fy = top + len * 0.025;
        const tw = phase === 'burn' || phase === 'coast' ? Math.sin(F * 0.13 + d) * fh * 0.12 : 0;
        ctx.fillStyle = FILL;
        ctx.beginPath(); ctx.moveTo(fx, fy + tw); ctx.lineTo(fx + fw, fy - tw); ctx.lineTo(fx + fw, fy + fh - tw); ctx.lineTo(fx, fy + fh + tw); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let i = 1; i < 4; i++){
          ctx.moveTo(fx + fw * i / 4, fy + tw * (1 - 2 * i / 4)); ctx.lineTo(fx + fw * i / 4, fy + fh + tw * (1 - 2 * i / 4));
          ctx.moveTo(fx, fy + fh * i / 4 + tw); ctx.lineTo(fx + fw, fy + fh * i / 4 - tw);
        }
        ctx.stroke(); ctx.restore();
      });
      // catch pins
      const pinY = top + (armY - restTop) - bw * 0.1 - bw * 0.14;
      ctx.fillStyle = INK;
      ctx.fillRect(x0 - bw * 0.18, pinY, bw * 0.18, bw * 0.14);
      ctx.fillRect(x0 + bw, pinY, bw * 0.18, bw * 0.14);
    }
    function drawDust(){
      const p = new Path2D();
      for (const f of fire) if (f.dust) seg(p, f.X - f.vx * 2, f.Y - f.vy * 2, f.X, f.Y);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#7A7A7A'; ctx.lineWidth = 2; ctx.stroke(p); ctx.globalAlpha = 1;
    }
    function drawTelemetry(){
      const top = restTop - h * k, x = bx - bw / 2 - bw * 0.6 - 14;
      const y = Math.min(Math.max(top + len * 0.3, 60), GY - 150);
      const label = phase === 'coast' ? 'Coasting' : phase === 'burn' ? 'Landing burn' : 'Caught';
      readout(x, y, [label, 'Altitude ' + Math.round(h) + ' m', 'Speed ' + Math.round(v) + ' m/s',
        'Throttle ' + Math.round(thr * 100) + '%', 'Deceleration ' + (phase === 'burn' ? (A / 9.81).toFixed(1) : '0.0') + ' g'], 'right');
      // altitude trace
      const pw = mobile ? 90 : 130, ph = mobile ? 40 : 54, px0 = x - pw, py0 = y + (mobile ? 84 : 98);
      ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = 1; ctx.strokeRect(px0, py0, pw, ph);
      if (hist.length > 1){
        const n = Math.round(((HC - HB) / V0 + V0 / A) * 60);
        ctx.beginPath();
        hist.forEach((hv, i) => { const X = px0 + (i / n) * pw, Y = py0 + ph - (hv / HC) * ph; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.strokeStyle = '#39C6D6'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.font = '11px "Hanken Grotesk", Arial, sans-serif'; ctx.fillStyle = MUTE; ctx.textAlign = 'right';
      ctx.fillText('Altitude over time', x, py0 + ph + 14);
    }
    function draw(){
      clear(); drawStars(stars); drawGround(); drawTower();
      drawArm(true);
      drawFire(fire, mobile ? 1.8 : 2.4, 2.5, 0.85); drawDust();
      drawBooster(); drawCarriage(); drawArm(false); drawTelemetry();
      if (phase === 'out'){ ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, tHold) + ')'; ctx.fillRect(0, 0, W, H); }
    }

    return {
      caption: 'A booster coming back to the tower. The landing burn is a constant deceleration, timed so speed hits zero right at the arms.',
      legend: null,
      init(){
        if (mobile){ bw = 18; bx = W * 0.5; len = H * 0.32; restTop = H * 0.19; GY = H * 0.64; tTop = H * 0.14; }
        else { bw = Math.max(22, Math.min(36, W * 0.022)); bx = W * 0.64; len = H * 0.46; restTop = H * 0.18; GY = H * 0.9; tTop = H * 0.08; }
        tX = bx + bw / 2 + bw * 1.2; tW = bw * 1.3; armY = restTop + len * 0.07;
        k = (restTop + len * 0.6) / HB;
        stars = makeStars(mobile ? 60 : 130, GY * 0.85);
        reset();
      },
      frame(){ update(); draw(); },
      still(){ reset(); for (let i = 0; i < 520; i++) update(); phase = 'caught'; h = 0; v = 0; arm = 0; thr = 0; settle = 1; draw(); }
    };
  }

  // =========================================================
  // Race car: stream-function model of air over and under a hill-climb car
  // =========================================================
  function Car(){
    // Top profile of the body, in car lengths (x from nose to tail, y above ground)
    const TOP = [[0,.035],[.03,.055],[.14,.085],[.3,.12],[.41,.2],[.48,.27],[.58,.28],[.69,.225],[.86,.18],[.99,.17],[1,.13]];
    const BOTTOM = [[1,.09],[.86,.03],[.1,.03],[0,.035]];
    const GAP = [[-0.2,.07],[-0.02,.06],[.02,.034],[.1,.027],[.8,.027],[.86,.03],[1,.085],[1.15,.12],[1.6,.16]];
    const WG = { x0: .83, x1: 1.03, y: .29, t: .026 }, WHEELS = [.19, .8], WR = .072, LAM = .42, N = 900;
    let L, X0, GY, xa, xb, hNear, hFar, parts, under, maxY0, px, base, dash = 0, wrot = 0;

    function body(x){
      if (x < 0 || x > 1) return 0;
      return table(TOP, x);
    }
    function build(){
      xa = -X0 / L - 0.3; xb = (W - X0) / L + 0.3;
      const dx = (xb - xa) / (N - 1), hEnd = WG.y + WG.t, raw = new Float32Array(N);
      for (let i = 0; i < N; i++){
        const x = xa + i * dx;
        raw[i] = x <= WG.x1 ? Math.max(body(x), x >= WG.x0 ? hEnd : 0) : hEnd * Math.exp(-(x - WG.x1) / 0.35);
      }
      const blur = sigL => {
        const sig = sigL / dx, r = Math.ceil(sig * 3), out = new Float32Array(N);
        for (let i = 0; i < N; i++){
          let s = 0, w = 0;
          for (let j = -r; j <= r; j++){ const q = i + j; if (q < 0 || q >= N) continue; const g = Math.exp(-j * j / (2 * sig * sig)); s += raw[q] * g; w += g; }
          out[i] = s / w;
        }
        return out;
      };
      hNear = blur(0.03).map((v, i) => Math.max(raw[i], v) + 0.012);
      hFar = blur(0.18).map(v => v + 0.012);
    }
    function interp(arr, x){
      const f = (x - xa) / (xb - xa) * (N - 1);
      if (f <= 0) return arr[0]; if (f >= N - 1) return arr[N - 1];
      const i = f | 0, t = f - i; return arr[i] * (1 - t) + arr[i + 1] * t;
    }
    // Over the car: streamline from height y0 upstream -> height and speed at x
    function map(x, y0){
      const w = Math.exp(-y0 / 0.12), hh = w * interp(hNear, x) + (1 - w) * interp(hFar, x), e = Math.exp(-y0 / LAM);
      return [y0 + hh * e, 1 / (1 - (hh / LAM) * e)];
    }
    // Under the car: air squeezed between floor and road speeds up (continuity)
    const gapAt = x => table(GAP, x);
    const bucket = (s, x, y0) => (x > WG.x1 - 0.02 && y0 < 0.18) ? 0 : s < 1.04 ? 1 : s < 1.25 ? 2 : s < 1.7 ? 3 : 4;
    const ubucket = (s, x) => (x > 1.02 && x < 1.5) ? 0 : s < 1.04 ? 1 : s < 1.5 ? 2 : s < 2.1 ? 3 : 4;
    function spawn(p, any){ p.y0 = maxY0 * Math.pow(Math.random(), 1.7); p.x = any ? xa + Math.random() * (xb - xa) : xa - Math.random() * 0.05; }
    function spawnU(p, any){ p.e = 0.08 + Math.random() * 0.84; p.x = any ? xa + Math.random() * (xb - xa) : xa - Math.random() * 0.05; }
    const P = (x, y) => [X0 + x * L, GY - y * L];

    function drawRoad(){
      ctx.fillStyle = '#000'; ctx.fillRect(0, GY, W, H - GY);
      ctx.strokeStyle = leftFade('#3A3A3A'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
      const per = 0.24 * L, off = dash % per, y = GY + Math.max(10, 0.05 * L);
      ctx.strokeStyle = leftFade('#2A2A2A'); ctx.lineWidth = 3; ctx.beginPath();
      for (let x = -off; x < W; x += per){ ctx.moveTo(x, y); ctx.lineTo(x + per / 2, y); }
      ctx.stroke();
    }
    function drawCar(){
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.fillStyle = FILL; ctx.lineCap = 'round';
      // splitter
      ctx.beginPath(); ctx.moveTo(...P(-0.03, .028)); ctx.lineTo(...P(.12, .028)); ctx.stroke();
      // canard
      ctx.beginPath(); ctx.moveTo(...P(.05, .07)); ctx.lineTo(...P(.1, .085)); ctx.stroke();
      // wing struts (swan neck)
      ctx.beginPath(); ctx.moveTo(...P(.9, .17)); ctx.quadraticCurveTo(...P(.93, .3), ...P(.9, WG.y + .02));
      ctx.moveTo(...P(.97, .168)); ctx.quadraticCurveTo(...P(1.0, .3), ...P(.97, WG.y + .022)); ctx.stroke();
      // body
      ctx.beginPath();
      TOP.concat(BOTTOM).forEach((q, i) => { const [a, b] = P(q[0], q[1]); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // diffuser strakes
      ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath();
      [.9, .95].forEach(x => { ctx.moveTo(...P(x, .03 + (x - .86) * .43)); ctx.lineTo(...P(x, .012)); });
      ctx.stroke();
      // cockpit glass, side intake, panel lines
      ctx.beginPath();
      ctx.moveTo(...P(.44, .215)); ctx.lineTo(...P(.49, .258)); ctx.lineTo(...P(.57, .262)); ctx.lineTo(...P(.62, .235));
      ctx.moveTo(...P(.62, .11)); ctx.lineTo(...P(.7, .13)); ctx.lineTo(...P(.7, .09));
      ctx.moveTo(...P(.3, .06)); ctx.lineTo(...P(.68, .06));
      ctx.stroke(); ctx.restore();
      // rear wing (upside down, it makes downforce) + gurney flap
      const { x0, x1, y, t } = WG;
      ctx.beginPath();
      ctx.moveTo(...P(x0, y + t * 0.4));
      ctx.bezierCurveTo(...P(x0 + .03, y + t), ...P(x1 - .05, y + t), ...P(x1, y + t * 0.95));
      ctx.bezierCurveTo(...P(x1 - .06, y + t * 0.2), ...P(x0 + .03, y - t * 0.35), ...P(x0, y + t * 0.4));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...P(x1, y + t * 0.95)); ctx.lineTo(...P(x1, y + t * 1.5)); ctx.stroke();
      ctx.save(); ctx.globalAlpha = 0.55;
      const [ex0, ey0] = P(x0 + .005, y + t + .035), [ex1, ey1] = P(x1 + .005, y - .04);
      ctx.strokeRect(ex0, ey0, ex1 - ex0, ey1 - ey0); ctx.restore();
      // wheels with brake discs glowing through the spokes
      WHEELS.forEach((wx, wi) => {
        const [cx, cy] = P(wx, WR), r = WR * L;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(F * 0.07 + wi);
        ctx.fillStyle = '#FF7A2E'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#8C8C8C'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, TAU); ctx.arc(cx, cy, r * 0.84, 0, TAU);
        for (let s = 0; s < 10; s++){
          const a = wrot + s * TAU / 10;
          ctx.moveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15);
          ctx.lineTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
        }
        ctx.stroke(); ctx.lineWidth = 1.5;
      });
    }
    function flowPaths(){
      const paths = newPaths(5);
      for (const p of parts){
        const [y, s] = map(p.x, p.y0);
        const xs = X0 + p.x * L, ys = GY - y * L;
        p.x += base * s;
        if (p.x > 1 && p.y0 < 0.2) p.y0 = Math.max(0, p.y0 + (Math.random() - 0.5) * 0.006);
        if (p.x > xb){ spawn(p, false); continue; }
        const [y1] = map(p.x, p.y0);
        seg(paths[bucket(s, p.x, p.y0)], xs, ys, X0 + p.x * L, GY - y1 * L);
      }
      for (const p of under){
        const g0 = gapAt(p.x), s = 0.07 / g0 * 0.95;
        const xs = X0 + p.x * L, ys = GY - p.e * g0 * L;
        p.x += base * s;
        if (p.x > 1) p.e = clamp(p.e + (Math.random() - 0.5) * 0.04, 0.05, 0.95);
        if (p.x > xb){ spawnU(p, false); continue; }
        seg(paths[ubucket(s, p.x)], xs, ys, X0 + p.x * L, GY - p.e * gapAt(p.x) * L);
      }
      return paths;
    }

    return {
      caption: 'Air over and under a hill-climb race car, from a stream-function model. The squeezed air under the floor is the fastest. Color is local airspeed.',
      legend: { grad: GRAD_SPEED, lo: 'slower', hi: 'faster' },
      init(){
        L = mobile ? W * 0.8 : Math.min(W * 0.42, H * 0.95);
        X0 = mobile ? W * 0.09 : W * 0.4;
        GY = mobile ? H * 0.42 : H * 0.6;
        px = mobile ? 4 : 5; base = px / L;
        build(); maxY0 = GY / L + 0.05;
        const n = Math.round(Math.min(1300, W * H / 900));
        parts = Array.from({ length: n }, () => { const p = {}; spawn(p, true); return p; });
        under = Array.from({ length: mobile ? 90 : 160 }, () => { const p = {}; spawnU(p, true); return p; });
      },
      frame(){
        fade(0.1);
        strokePaths(flowPaths(), PAL, 1.2);
        dash += px; wrot += px / (WR * L);
        drawRoad(); drawCar();
        readout(mobile ? 16 : X0 + L * 0.38, mobile ? GY + 40 : GY + 52, ['Hill-climb car', 'Road speed 160 km/h', 'Rear wing and diffuser add downforce'], 'left');
      },
      still(){
        clear();
        for (let i = 0; i < 160; i++) flowPaths();
        const paths = newPaths(5);
        for (let i = 1; i <= 45; i++){
          const y0 = maxY0 * Math.pow(i / 45, 1.7);
          let [yPrev] = map(xa, y0), xPrev = xa;
          for (let x = xa + 0.01; x < xb; x += 0.01){
            const [y, s] = map(x, y0);
            seg(paths[bucket(s, x, y0)], X0 + xPrev * L, GY - yPrev * L, X0 + x * L, GY - y * L);
            xPrev = x; yPrev = y;
          }
        }
        strokePaths(paths, PAL, 1.1);
        drawRoad(); drawCar();
      }
    };
  }

  // =========================================================
  // Rocket ascent: potential flow past a Rankine half-body (rocket frame)
  // plus a simple 1D ascent model for the telemetry
  // =========================================================
  function Ascent(){
    const K = 1.9, DT = 1 / 60, THRUST = 650e3, M0 = 50000, MDOT = 250, CDA = 3, TMAX = 48;
    const vel = (x, y) => { const r2 = x * x + y * y + 1e-6; return [1 + x / r2, y / r2]; };
    const inside = (x, y) => { const ay = Math.abs(y); return ay + Math.atan2(ay, x) < PI; };
    let cx, y0, s, L, dt, air, fire, right, yb, noseY, botY, nozBot, nozHalf, stars;
    let tA, alt, vA, mA, out;
    const SX = y => cx + y * s, SY = x => y0 + x * s * K;
    const bucket = v => v < 0.75 ? 0 : v < 1.03 ? 1 : v < 1.12 ? 2 : 3;

    function resetFlight(){ tA = 0; alt = 0; vA = 0; mA = M0; out = 0; }
    function physics(){
      if (out > 0){ out += DT; if (out > 1){ resetFlight(); } return; }
      const rho = 1.225 * Math.exp(-alt / 8500), drag = 0.5 * rho * vA * vA * CDA;
      const a = (THRUST - drag) / mA - 9.81;
      vA += a * DT; alt += vA * DT; mA -= MDOT * DT; tA += DT;
      if (tA > TMAX) out = 0.0001;
    }
    function spawnAir(p, init){
      for (let t = 0; t < 10; t++){
        p.y = Math.random() < 0.5 ? gauss() * 6 : ((Math.random() * W) - cx) / s;
        p.x = init ? ((Math.random() * H) - y0) / (s * K) : (-y0) / (s * K) - Math.random() * 1.5;
        if (!inside(p.x, p.y)) return;
      }
    }
    function stepAir(p, d){
      const k1 = vel(p.x, p.y), k2 = vel(p.x + k1[0] * d / 2, p.y + k1[1] * d / 2);
      return [p.x + k2[0] * d, p.y + k2[1] * d, Math.hypot(k2[0], k2[1])];
    }
    function emit(n){
      for (let i = 0; i < n; i++){
        const off = (Math.random() * 2 - 1) * nozHalf * 0.85;
        fire.push({ X: cx + off, Y: nozBot, px: cx + off, py: nozBot,
          vx: off / nozHalf * 1.1 + (Math.random() - .5) * 1.2, vy: (mobile ? 5 : 7) + Math.random() * 5, age: 0, life: 30 + Math.random() * 50 });
      }
    }
    function stepFire(f){ f.px = f.X; f.py = f.Y; f.vx += (Math.random() - .5) * 0.5; f.X += f.vx; f.Y += f.vy; f.vx *= 1.015; f.age++; }
    function tickFire(){ emit(mobile ? 6 : 9); fire.forEach(stepFire); fire = fire.filter(f => f.age < f.life && f.Y < H + 10); }

    function drawRocket(){
      const bw = yb * s, finH = (botY - noseY) * 0.16, finW = bw * 1.05;
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.fillStyle = FILL;
      [1, -1].forEach(d => {
        ctx.beginPath();
        ctx.moveTo(cx + d * bw, botY - finH); ctx.lineTo(cx + d * (bw + finW), botY - finH * 0.3);
        ctx.lineTo(cx + d * (bw + finW), botY + finH * 0.12); ctx.lineTo(cx + d * bw, botY);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.5, botY); ctx.quadraticCurveTo(cx - bw * 0.55, nozBot - bw * 0.4, cx - nozHalf, nozBot);
      ctx.lineTo(cx + nozHalf, nozBot); ctx.quadraticCurveTo(cx + bw * 0.55, nozBot - bw * 0.4, cx + bw * 0.5, botY);
      ctx.closePath(); ctx.fillStyle = '#161616'; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      right.forEach((p, i) => { const X = SX(p[1]), Y = SY(p[0]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(SX(-right[i][1]), SY(right[i][0]));
      ctx.closePath(); ctx.fillStyle = FILL; ctx.fill(); ctx.stroke();
      // interstage, raceway, tank domes
      ctx.save(); ctx.globalAlpha = 0.45; ctx.beginPath();
      [0.2, 0.42, 0.44, 0.78].forEach(f => { const sy = noseY + (botY - noseY) * f; ctx.moveTo(cx - bw * 0.97, sy); ctx.lineTo(cx + bw * 0.97, sy); });
      ctx.moveTo(cx + bw * 0.55, noseY + (botY - noseY) * 0.22); ctx.lineTo(cx + bw * 0.55, botY - 4);
      ctx.stroke(); ctx.restore();
    }
    function drawDiamonds(){
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 4; i++){
        const y = nozBot + i * nozHalf * 1.4, a = (0.1 - i * 0.018) * (0.8 + Math.random() * 0.2), w = nozHalf * 0.32, hh = nozHalf * 0.55;
        ctx.globalAlpha = a; ctx.fillStyle = '#FFF4DA';
        ctx.beginPath(); ctx.moveTo(cx, y - hh); ctx.lineTo(cx + w, y); ctx.lineTo(cx, y + hh); ctx.lineTo(cx - w, y); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    function drawTelemetry(){
      const mach = vA / Math.max(295, 340 - 0.004 * alt);
      const tt = Math.floor(tA), ss = String(tt % 60).padStart(2, '0'), mm = String(Math.floor(tt / 60)).padStart(2, '0');
      const x = mobile ? 16 : cx - s * 16, y = mobile ? H * 0.2 : H * 0.18;
      readout(x, y, ['T+ ' + mm + ':' + ss, 'Altitude ' + (alt / 1000).toFixed(2) + ' km', 'Speed ' + Math.round(vA) + ' m/s',
        'Mach ' + mach.toFixed(2), 'Mass ' + (mA / 1000).toFixed(1) + ' t'], mobile ? 'left' : 'right');
    }

    return {
      caption: 'Air flowing past a rocket in ascent, solved live in your browser. Telemetry comes from a simple thrust, drag and gravity model. Color is local airspeed.',
      legend: { grad: GRAD_SPEED, lo: 'slower', hi: 'faster' },
      init(){
        s = mobile ? Math.max(5.5, W * 0.017) : Math.min(12, W * 0.0085);
        cx = mobile ? W * 0.62 : W * 0.7;
        noseY = H * (mobile ? 0.1 : 0.12); y0 = noseY + s * K;
        botY = H * (mobile ? 0.5 : 0.6); L = (botY - y0) / (s * K);
        dt = (mobile ? 3.2 : 4) / (s * K);
        right = [];
        for (let th = PI - 0.002; th > 0.01; th -= 0.004){
          const r = (PI - th) / Math.sin(th), x = r * Math.cos(th), y = r * Math.sin(th);
          if (x > L) break; right.push([x, y]);
        }
        yb = right[right.length - 1][1];
        nozHalf = yb * s * 0.78; nozBot = botY + yb * s * 0.95;
        const n = Math.round(Math.min(1500, W * H / 750));
        air = Array.from({ length: n }, () => { const p = {}; spawnAir(p, true); return p; });
        fire = []; stars = makeStars(mobile ? 40 : 90, H);
        resetFlight();
      },
      frame(){
        physics();
        fade(0.12);
        // the sky darkens and stars come out as altitude rises
        const sa = clamp(alt / 6000, 0, 1) * 0.6;
        if (sa > 0.02){ ctx.globalAlpha = sa; drawStars(stars.map(st => ({ ...st, y: (st.y + tA * 30) % H }))); ctx.globalAlpha = 1; }
        const d = dt * (0.6 + Math.min(vA, 300) / 300 * 0.8);
        const paths = newPaths(4);
        for (const p of air){
          const X0 = SX(p.y), Y0 = SY(p.x), [nx, ny, v] = stepAir(p, d);
          if (inside(nx, ny) || SY(nx) > H + 5){ spawnAir(p, false); continue; }
          p.x = nx; p.y = ny; seg(paths[bucket(v)], X0, Y0, SX(ny), SY(nx));
        }
        strokePaths(paths, PAL, 1.2);
        tickFire(); drawFire(fire, mobile ? 1.4 : 1.8); drawDiamonds(); drawRocket();
        drawTelemetry();
        if (out > 0){ ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, out) + ')'; ctx.fillRect(0, 0, W, H); }
      },
      still(){
        clear();
        const paths = newPaths(4), seeds = [];
        for (let y = -20; y <= 20; y += 0.9) seeds.push(y);
        for (let y = (0 - cx) / s; y < (W - cx) / s; y += 4) seeds.push(y);
        for (const y of seeds){
          const p = { x: (-y0) / (s * K) - 1, y };
          for (let i = 0; i < 3000; i++){
            const X0 = SX(p.y), Y0 = SY(p.x), [nx, ny, v] = stepAir(p, dt);
            if (inside(nx, ny) || SY(nx) > H + 5) break;
            p.x = nx; p.y = ny; seg(paths[bucket(v)], X0, Y0, SX(ny), SY(nx));
          }
        }
        strokePaths(paths, PAL, 1.1);
        for (let i = 0; i < 90; i++) tickFire();
        for (let i = 0; i < 60 * 20; i++) physics();
        drawFire(fire, 1.8); drawDiamonds(); drawRocket(); drawTelemetry();
      }
    };
  }

  // =========================================================
  // Inverted wing: Joukowski airfoil, potential flow with the Kutta condition.
  // Angle of attack sweeps slowly; downforce coefficient is computed live.
  // =========================================================
  function Wing(){
    const U = 1, mu = [-0.1, 0.12], R = Math.hypot(1 - mu[0], mu[1]), R2 = R * R, om = [1 - mu[0], -mu[1]];
    const toZ = z => add(z, div([1, 0], z));
    let a, e, e2, Gamma, chord, cx, cy, s, xmin, xmax, ymin, ymax, parts, circle, t = 0;

    function setAlpha(deg){
      a = deg * PI / 180; e = [Math.cos(a), -Math.sin(a)]; e2 = [Math.cos(a), Math.sin(a)];
      Gamma = sc(mul(om, sub(e, sc(div(e2, mul(om, om)), R2))), -2 * PI * U)[1];
    }
    function vz(zeta){
      const d = sub(zeta, mu);
      const w = add(sc(sub(e, sc(div(e2, mul(d, d)), R2)), U), div([0, Gamma / (2 * PI)], d));
      const J = sub([1, 0], div([1, 0], mul(zeta, zeta)));
      const Wz = div(w, J);
      return [div([Wz[0], -Wz[1]], J), Math.hypot(Wz[0], Wz[1])];
    }
    function adv(zeta, dt){
      const [k1] = vz(zeta), [k2, sp] = vz(add(zeta, sc(k1, dt / 2)));
      let d = sc(k2, dt); const l = Math.hypot(d[0], d[1]); if (l > 0.08) d = sc(d, 0.08 / l);
      return [add(zeta, d), sp];
    }
    // Render in a frame where the free stream is horizontal, so the wing visibly pitches
    const toScreen = z => { const r = rot(z, -a); return [cx + r[0] * s, cy + r[1] * s]; };
    const dead = z => Math.hypot(z[0] - mu[0], z[1] - mu[1]) < R * 1.002;
    const bucket = v => v < 0.85 ? 0 : v < 1.08 ? 1 : v < 1.3 ? 2 : v < 1.6 ? 3 : 4;
    function spawn(p, any){
      const zr = [any ? xmin + Math.random() * (xmax - xmin) : xmin - Math.random() * 0.5, ymin + Math.random() * (ymax - ymin)];
      p.z = rot(zr, a);
      if (Math.hypot(p.z[0] - mu[0], p.z[1] - mu[1]) < R * 1.05) p.z = rot([xmin - 0.3, zr[1]], a);
      p.life = 200 + Math.random() * 400;
    }
    function drawFoil(){
      const pts = circle.map(zc => toScreen(toZ(zc)));
      ctx.beginPath(); pts.forEach(([X, Y], i) => i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)); ctx.closePath();
      ctx.fillStyle = FILL; ctx.fill();
      // surface colored by local speed: this is the pressure distribution
      const paths = newPaths(5);
      for (let i = 0; i < circle.length - 1; i++){
        const th = i / (circle.length - 1) * TAU;
        const [, sp] = vz([mu[0] + R * 1.02 * Math.cos(th), mu[1] + R * 1.02 * Math.sin(th)]);
        seg(paths[bucket(sp)], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      }
      strokePaths(paths, PAL, 3);
      ctx.beginPath(); pts.forEach(([X, Y], i) => i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)); ctx.closePath();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    }
    function drawInfo(){
      const cl = 2 * Gamma / (U * chord);
      const x = mobile ? 16 : cx - s * 2.3, y = mobile ? H * 0.62 : cy - s * 1.9;
      readout(x, y, ['Inverted wing', 'Angle of attack ' + (a * 180 / PI).toFixed(1) + '°', 'Downforce coefficient ' + cl.toFixed(2)], 'left');
      // little arrow showing downforce, scaled by coefficient
      const [fx, fy] = toScreen(add(mu, [0.4, 0]));
      ctx.strokeStyle = '#F4C542'; ctx.fillStyle = '#F4C542'; ctx.lineWidth = 2;
      const Lr = cl * s * 0.45;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + Lr); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 6, fy + Lr - 8); ctx.lineTo(fx, fy + Lr); ctx.lineTo(fx + 6, fy + Lr - 8); ctx.stroke();
    }

    return {
      caption: 'Potential flow around an inverted race wing, solved live in your browser. The angle of attack sweeps slowly and the downforce updates with it. Color is local airspeed.',
      legend: { grad: GRAD_SPEED, lo: 'slower', hi: 'faster' },
      init(){
        cx = mobile ? W * 0.55 : W * 0.64; cy = mobile ? H * 0.34 : H * 0.4;
        s = mobile ? W * 0.19 : Math.min(W * 0.1, H * 0.15);
        xmin = -cx / s; xmax = (W - cx) / s; ymin = -cy / s; ymax = (H - cy) / s;
        circle = [];
        for (let i = 0; i <= 200; i++){ const th = i / 200 * TAU; circle.push([mu[0] + R * Math.cos(th), mu[1] + R * Math.sin(th)]); }
        const xs = circle.map(z => toZ(z)[0]); chord = Math.max(...xs) - Math.min(...xs);
        t = 0; setAlpha(8);
        const n = Math.round(Math.min(1100, W * H / 1100));
        parts = Array.from({ length: n }, () => { const p = {}; spawn(p, true); return p; });
      },
      frame(){
        t++;
        setAlpha(6.5 + 3.5 * Math.sin(t / 1500 * TAU));
        fade(0.09);
        const paths = newPaths(5);
        for (const p of parts){
          const [X0, Y0] = toScreen(toZ(p.z)), [nz, sp] = adv(p.z, 0.03);
          p.life--;
          const zr = rot(toZ(nz), -a);
          if (dead(nz) || zr[0] > xmax + 1 || zr[1] < ymin - 1 || zr[1] > ymax + 1 || p.life < 0){ spawn(p, p.life < 0); continue; }
          p.z = nz;
          const [X1, Y1] = toScreen(toZ(nz));
          seg(paths[bucket(sp)], X0, Y0, X1, Y1);
        }
        strokePaths(paths, PAL, 1.3); drawFoil(); drawInfo();
      },
      still(){
        clear();
        const paths = newPaths(5), rows = Math.round((ymax - ymin) / 0.12);
        for (let r = 0; r <= rows; r++){
          let z = rot([xmin - 0.5, ymin + r * (ymax - ymin) / rows], a);
          for (let i = 0; i < 1500; i++){
            const [X0, Y0] = toScreen(toZ(z)), [nz, sp] = adv(z, 0.03);
            if (dead(nz) || rot(toZ(nz), -a)[0] > xmax + 0.5) break;
            z = nz; const [X1, Y1] = toScreen(toZ(nz));
            seg(paths[bucket(sp)], X0, Y0, X1, Y1);
          }
        }
        strokePaths(paths, PAL, 1.1); drawFoil(); drawInfo();
      }
    };
  }

  // =========================================================
  // Orbital transfer: Hohmann transfer up to a high orbit and back down.
  // Real two-body gravity integrated with velocity Verlet; burns are impulsive.
  // =========================================================
  function Orbit(){
    const SUB = 8, GM_EARTH = 398600; // km^3/s^2
    let cx, cy, Rp, r1, r2, GM, T1, T2, x, y, vx, vy, phase, tPhase, trail, stars, flame, dv, kmPerPx, vScale, spin, lastDr, burnT, burnDir, label;

    const circ = r => Math.sqrt(GM / r);
    function reset(){
      x = cx + r1; y = cy; vx = 0; vy = -circ(r1);
      phase = 'low'; tPhase = 0; trail = []; flame = []; dv = 0; lastDr = 0; burnT = 0; label = 'Parking orbit';
    }
    function setSpeed(target){
      const sp = Math.hypot(vx, vy), ux = vx / sp, uy = vy / sp;
      dv += Math.abs(target - sp) * vScale * 1000;
      burnDir = target > sp ? [-ux, -uy] : [ux, uy]; // exhaust direction
      vx = ux * target; vy = uy * target; burnT = 26;
    }
    function step(){
      const h = 1 / SUB;
      for (let i = 0; i < SUB; i++){
        let dx = x - cx, dy = y - cy, r3 = Math.pow(dx * dx + dy * dy, 1.5);
        const ax = -GM * dx / r3, ay = -GM * dy / r3;
        x += vx * h + 0.5 * ax * h * h; y += vy * h + 0.5 * ay * h * h;
        dx = x - cx; dy = y - cy; r3 = Math.pow(dx * dx + dy * dy, 1.5);
        vx += 0.5 * (ax - GM * dx / r3) * h; vy += 0.5 * (ay - GM * dy / r3) * h;
      }
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), dr = (dx * vx + dy * vy) / r;
      tPhase++;
      if (phase === 'low' && tPhase > T1 * 1.2){
        setSpeed(Math.sqrt(GM * 2 * r2 / (r * (r + r2)))); phase = 'up'; label = 'Transfer burn';
      } else if (phase === 'up'){
        if (burnT < 1) label = 'Coasting to apoapsis';
        if (lastDr > 0 && dr <= 0){ setSpeed(circ(r)); phase = 'high'; tPhase = 0; label = 'Circularizing'; }
      } else if (phase === 'high'){
        if (burnT < 1) label = 'High orbit';
        if (tPhase > T2 * 0.9){ setSpeed(Math.sqrt(GM * 2 * r1 / (r * (r + r1)))); phase = 'down'; label = 'Deorbit burn'; }
      } else if (phase === 'down'){
        if (burnT < 1) label = 'Falling to periapsis';
        if (lastDr < 0 && dr >= 0){ setSpeed(circ(r)); phase = 'low'; tPhase = 0; label = 'Circularizing'; dv = 0; }
      }
      if (phase === 'low' && burnT < 1 && tPhase > 30) label = 'Parking orbit';
      lastDr = dr;
      trail.push([x, y, Math.hypot(vx, vy)]); if (trail.length > 1400) trail.shift();
      if (burnT > 0){
        burnT--;
        for (let i = 0; i < 6; i++) flame.push({ X: x, Y: y, vx: burnDir[0] * (2 + Math.random() * 2) + (Math.random() - .5) * 0.8,
          vy: burnDir[1] * (2 + Math.random() * 2) + (Math.random() - .5) * 0.8, age: 0, life: 14 + Math.random() * 12 });
      }
      flame.forEach(f => { f.X += f.vx; f.Y += f.vy; f.age++; });
      flame = flame.filter(f => f.age < f.life);
      spin += 0.0025;
    }
    function drawPlanet(){
      ctx.save();
      // atmosphere
      const g = ctx.createRadialGradient(cx, cy, Rp * 0.95, cx, cy, Rp * 1.18);
      g.addColorStop(0, 'rgba(61,123,255,0.35)'); g.addColorStop(1, 'rgba(61,123,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rp * 1.18, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.fillStyle = '#07111D'; ctx.fill();
      ctx.clip();
      // rotating meridians and parallels
      ctx.strokeStyle = 'rgba(57,198,214,0.28)'; ctx.lineWidth = 1;
      for (let k = 0; k < 12; k++){
        const ph = spin + k * PI / 6, c = Math.cos(ph);
        if (Math.sin(ph) < 0) continue;
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(c) * Rp, Rp, 0, 0, TAU); ctx.stroke();
      }
      for (let k = -2; k <= 2; k++){
        const yy = cy + k * Rp * 0.33, hw = Math.sqrt(Math.max(0, Rp * Rp - (yy - cy) ** 2));
        ctx.beginPath(); ctx.moveTo(cx - hw, yy); ctx.lineTo(cx + hw, yy); ctx.stroke();
      }
      // night side
      const sh = ctx.createLinearGradient(cx - Rp, cy, cx + Rp, cy);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(0,0,0,0.15)'); sh.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = sh; ctx.fillRect(cx - Rp, cy - Rp, Rp * 2, Rp * 2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(242,242,242,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.stroke();
    }
    function drawOrbits(){
      ctx.setLineDash([3, 6]); ctx.strokeStyle = '#2E2E2E'; ctx.lineWidth = 1;
      [r1, r2].forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); });
      // current osculating orbit from the state vector
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), v2 = vx * vx + vy * vy;
      const eps = v2 / 2 - GM / r, a = -GM / (2 * eps), rv = dx * vx + dy * vy;
      const ex = ((v2 - GM / r) * dx - rv * vx) / GM, ey = ((v2 - GM / r) * dy - rv * vy) / GM, e = Math.hypot(ex, ey);
      if (a > 0 && e < 0.98){
        ctx.strokeStyle = 'rgba(57,198,214,0.45)'; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.ellipse(cx - a * ex, cy - a * ey, a, a * Math.sqrt(1 - e * e), Math.atan2(ey, ex), 0, TAU); ctx.stroke();
        // apsis markers
        if (e > 0.02){
          const ux = ex / e, uy = ey / e, rp = a * (1 - e), ra = a * (1 + e);
          ctx.setLineDash([]); ctx.fillStyle = MUTE; ctx.font = '11px "Hanken Grotesk", Arial, sans-serif'; ctx.textAlign = 'center';
          [[rp, 'Periapsis'], [-ra, 'Apoapsis']].forEach(([d, t]) => {
            const px = cx + ux * d, py = cy + uy * d;
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill(); ctx.fillText(t, px, py - 8);
          });
        }
      }
      ctx.setLineDash([]);
    }
    function drawTrail(){
      const paths = newPaths(5), vc = circ(r1);
      for (let i = 1; i < trail.length; i++){
        const r = trail[i][2] / vc, b = r < 0.55 ? 0 : r < 0.8 ? 1 : r < 1.05 ? 2 : r < 1.2 ? 3 : 4;
        seg(paths[b], trail[i - 1][0], trail[i - 1][1], trail[i][0], trail[i][1]);
      }
      ctx.globalAlpha = 0.8; strokePaths(paths, PAL, 1.6); ctx.globalAlpha = 1;
    }
    function drawCraft(){
      const a = Math.atan2(vy, vx);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = FILL; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(-5, -3.5, 10, 7); ctx.strokeRect(-5, -3.5, 10, 7);
      ctx.strokeStyle = '#39C6D6'; ctx.beginPath(); ctx.moveTo(-1, -4); ctx.lineTo(-1, -13); ctx.moveTo(-1, 4); ctx.lineTo(-1, 13); ctx.stroke();
      ctx.fillStyle = 'rgba(57,198,214,0.35)'; ctx.fillRect(-4, -13, 6, 8); ctx.fillRect(-4, 5, 6, 8);
      ctx.restore();
    }
    function drawInfo(){
      const r = Math.hypot(x - cx, y - cy), altKm = (r - Rp) * kmPerPx, sp = Math.hypot(vx, vy) * vScale;
      const X = mobile ? 16 : cx - r2 - 30, Y = mobile ? cy + r2 + 36 : cy - 30;
      readout(X, Y, [label, 'Altitude ' + Math.round(altKm).toLocaleString('en-US') + ' km', 'Speed ' + sp.toFixed(2) + ' km/s',
        'Delta-v this cycle ' + Math.round(dv).toLocaleString('en-US') + ' m/s'], mobile ? 'left' : 'right');
    }
    function draw(){
      clear(); drawStars(stars); drawOrbits(); drawTrail(); drawPlanet();
      drawFire(flame, 2, 2, 0.8); drawCraft(); drawInfo();
    }

    return {
      caption: 'A Hohmann transfer: burn to raise the orbit, coast half an ellipse, burn again to circularize, then come back down. Real two-body gravity, scaled to Earth.',
      legend: { grad: GRAD_SPEED, lo: 'slower', hi: 'faster' },
      init(){
        cx = mobile ? W * 0.5 : W * 0.66; cy = mobile ? H * 0.34 : H * 0.46;
        Rp = mobile ? W * 0.1 : Math.min(W, H) * 0.07;
        r1 = Rp * 1.7; r2 = mobile ? Math.min(W * 0.44, H * 0.27) : Math.min(H * 0.37, W * 0.25);
        T1 = 360; const w = TAU / T1; GM = w * w * r1 * r1 * r1;
        T2 = TAU * Math.sqrt(r2 * r2 * r2 / GM);
        kmPerPx = 6371 / Rp;
        vScale = Math.sqrt(GM_EARTH / (r1 * kmPerPx)) / circ(r1);
        stars = makeStars(mobile ? 70 : 160, H); spin = 0;
        reset();
      },
      frame(){ step(); draw(); },
      still(){ reset(); for (let i = 0; i < T1 * 1.2 + 250; i++) step(); flame = []; draw(); }
    };
  }

  // =========================================================
  // Turbofan cutaway: gas colored by temperature through fan, compressor,
  // combustor, turbine and nozzle. Blades spin at their spool speeds.
  // =========================================================
  function Jet(){
    const HUB = [[0,0],[.03,.12],[.1,.26],[.14,.28],[.3,.32],[.48,.36],[.52,.3],[.62,.3],[.78,.26],[.9,.18],[1,.08],[1.06,0]];
    const CORE = [[0,.5],[.12,.56],[.2,.55],[.3,.52],[.48,.44],[.52,.5],[.58,.52],[.62,.48],[.78,.54],[.9,.48],[1,.42]];
    const COWL = [[.2,.56],[.26,.62],[.5,.62],[.7,.6],[.82,.58],[1,.44]];
    const NIN = [[0,.92],[.05,.98],[.12,1],[.3,.98],[.5,.93],[.68,.84],[.72,.82]];
    const NOUT = [[-.01,.97],[.02,1.06],[.12,1.1],[.35,1.1],[.55,1.03],[.72,.86]];
    const UCORE = [[-.3,1],[.1,.9],[.2,.8],[.48,.55],[.58,.5],[.66,1.2],[.78,1.6],[1,2.6],[1.7,2.2]];
    const UBYP = [[-.3,1],[.2,.9],[.6,1],[.72,1.7],[1.7,1.4]];
    const TCORE = [[-.3,288],[.12,300],[.2,340],[.3,450],[.48,850],[.52,1400],[.58,1750],[.62,1500],[.66,1150],[.78,850],[1,780],[1.7,480]];
    const TBYP = [[-.3,288],[.12,290],[.16,330],[1.7,315]];
    const STAGES = [
      { x: .11, w: .035, n: 22, sp: 1, lw: 1.3, fan: true },
      { x: .225, w: .012, n: 34, sp: 1 }, { x: .255, w: .012, n: 34, sp: 1 },
      { x: .31, w: .012, n: 44, sp: 2.6 }, { x: .345, w: .012, n: 44, sp: 2.6 }, { x: .38, w: .012, n: 44, sp: 2.6 },
      { x: .415, w: .011, n: 44, sp: 2.6 }, { x: .45, w: .011, n: 44, sp: 2.6 },
      { x: .625, w: .014, n: 40, sp: 2.6, hot: true }, { x: .69, w: .016, n: 36, sp: 1, hot: true },
      { x: .73, w: .016, n: 36, sp: 1, hot: true }, { x: .77, w: .016, n: 36, sp: 1, hot: true },
    ];
    let X0, Le, Rn, cy, parts, amb, base, shaft = 0;
    const cIn = x => x < 1.06 ? table(HUB, x) : 0;
    const cOut = x => x <= 1 ? table(CORE, x) : 0.42 + (x - 1) * 0.12;
    const bIn = x => x < 0.2 ? table(CORE, x) : x <= 1 ? table(COWL, x) : cOut(x);
    const bOut = x => x <= 0.72 ? table(NIN, x) : 0.82 + (x - 0.72) * 0.06;
    const radius = p => p.core ? cIn(p.x) + p.e * (cOut(p.x) - cIn(p.x)) : bIn(p.x) + p.e * (bOut(p.x) - bIn(p.x));
    const scr = (x, r, side) => [X0 + x * Le, cy - side * r * Rn];

    function spawn(p, any){
      p.side = Math.random() < 0.5 ? 1 : -1; p.core = Math.random() < 0.42; p.e = 0.06 + Math.random() * 0.88;
      p.x = any ? -X0 / Le + Math.random() * (1.7 + X0 / Le) : -X0 / Le - Math.random() * 0.05;
    }
    function spawnAmb(p, any){ p.x = any ? Math.random() * W : -Math.random() * 40; p.y = Math.random() * H; p.v = 3 + Math.random() * 1.5; }

    function wallPath(fnTop, fnBot, x0, x1, side){
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1e-6; x += 0.005){ const [X, Y] = scr(x, fnTop(x), side); x === x0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      for (let x = x1; x >= x0 - 1e-6; x -= 0.005){ const [X, Y] = scr(x, fnBot(x), side); ctx.lineTo(X, Y); }
      ctx.closePath(); ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    }
    function drawBlades(){
      for (const st of STAGES){
        const rin = st.fan ? table(HUB, st.x) : table(HUB, st.x) + 0.005, rout = st.fan ? table(NIN, st.x) - 0.01 : table(CORE, st.x) - 0.005;
        ctx.strokeStyle = st.hot ? '#B8865A' : '#9AA3AD'; ctx.lineWidth = st.lw || 0.9;
        ctx.beginPath();
        for (let k = 0; k < st.n; k++){
          const ph = shaft * st.sp + k * TAU / st.n, c = Math.cos(ph), sn = Math.sin(ph);
          if (sn < 0) continue; // only the far half is visible in the cutaway
          const side = c >= 0 ? 1 : -1, ac = Math.abs(c);
          const r2 = Math.max(rin, rout * ac); if (r2 <= rin + 0.01) continue;
          const [xa, ya] = scr(st.x + st.w * 0.5 * c, rin, side), [xb, yb] = scr(st.x - st.w * 0.5 * c, r2, side);
          ctx.moveTo(xa, ya); ctx.lineTo(xb, yb);
        }
        ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
        // stator vanes: fixed thin lines just behind each rotor
        if (!st.fan){
          ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 1; ctx.beginPath();
          [1, -1].forEach(side => { const [a1, b1] = scr(st.x + st.w * 1.2, rin, side), [a2, b2] = scr(st.x + st.w * 1.2, rout, side); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); });
          ctx.stroke();
        }
      }
    }
    function drawEngine(){
      [1, -1].forEach(side => {
        wallPath(x => table(NOUT, x), x => table(NIN, x), 0, 0.72, side);   // nacelle
        wallPath(x => table(COWL, x), x => table(CORE, x), 0.2, 1, side);   // core cowl
      });
      // spool / hub, one solid shape top to bottom
      ctx.beginPath();
      for (let x = 0; x <= 1.06; x += 0.005){ const [X, Y] = scr(x, table(HUB, x), 1); x === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      for (let x = 1.06; x >= 0; x -= 0.005){ const [X, Y] = scr(x, table(HUB, x), -1); ctx.lineTo(X, Y); }
      ctx.closePath(); ctx.fillStyle = '#0B0B0B'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      // shafts inside the hub
      ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 1; ctx.beginPath();
      [0.06, -0.06, 0.12, -0.12].forEach((r, i) => { const x0 = i < 2 ? 0.1 : 0.3, x1 = i < 2 ? 0.8 : 0.64; const [a, b] = scr(x0, r, 1), [c] = scr(x1, r, 1); ctx.moveTo(a, b); ctx.lineTo(c, b); });
      ctx.stroke();
      // combustor liners
      ctx.setLineDash([4, 3]); ctx.strokeStyle = '#5A4A3A'; ctx.beginPath();
      [1, -1].forEach(side => [0.2, 0.8].forEach(f => {
        for (let x = 0.5; x <= 0.6; x += 0.01){ const r = table(HUB, x) + f * (table(CORE, x) - table(HUB, x)); const [X, Y] = scr(x, r, side); x === 0.5 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      }));
      ctx.stroke(); ctx.setLineDash([]);
      // combustor glow
      ctx.globalCompositeOperation = 'lighter';
      [1, -1].forEach(side => {
        const [gx, gy] = scr(0.555, (table(HUB, 0.555) + table(CORE, 0.555)) / 2, side);
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Rn * 0.3);
        g.addColorStop(0, 'rgba(255,160,60,' + (0.35 + 0.1 * Math.sin(F * 0.3)) + ')'); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, Rn * 0.3, 0, TAU); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawLabels(){
      if (mobile) return;
      ctx.font = '11.5px "Hanken Grotesk", Arial, sans-serif'; ctx.fillStyle = MUTE; ctx.textAlign = 'center';
      const y = cy + Rn * 1.3;
      [['Fan', .11], ['Compressor', .36], ['Combustor', .555], ['Turbine', .7], ['Nozzle', .95]].forEach(([t, x]) => {
        const X = X0 + x * Le; ctx.fillText(t, X, y + 14);
        ctx.strokeStyle = '#2A2A2A'; ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X, y - 6); ctx.stroke();
      });
    }
    function flow(){
      const paths = newPaths(5), ambP = new Path2D();
      for (const p of amb){
        const x0 = p.x; p.x += p.v;
        if (p.x > W){ spawnAmb(p, false); continue; }
        const xe = (p.x - X0) / Le;
        if (xe > -0.02 && xe < 1.05 && Math.abs(p.y - cy) < 1.12 * Rn) continue;
        seg(ambP, x0, p.y, p.x, p.y);
      }
      for (const p of parts){
        const r0 = radius(p), [xa, ya] = scr(p.x, r0, p.side);
        const u = table(p.core ? UCORE : UBYP, p.x), T = table(p.core ? TCORE : TBYP, p.x);
        p.x += base * u;
        if ((p.core && p.x > 0.5) || p.x > 0.72) p.e = clamp(p.e + (Math.random() - 0.5) * 0.02, 0.02, 0.98);
        if (p.x > 1.7){ spawn(p, false); continue; }
        const [xb, yb] = scr(p.x, radius(p), p.side);
        seg(paths[tBucket(T)], xa, ya, xb, yb);
      }
      shaft += 0.09;
      return [paths, ambP];
    }

    return {
      caption: 'A turbofan cutaway. Most air bypasses the core; the rest is compressed, burned and expanded through the turbine. Color is gas temperature.',
      legend: { grad: GRAD_TEMP, lo: 'cooler', hi: 'hotter' },
      init(){
        Le = mobile ? W * 0.72 : Math.min(W * 0.46, H * 1.05);
        X0 = mobile ? W * 0.14 : W * 0.43;
        Rn = Le * 0.17; cy = mobile ? H * 0.33 : H * 0.42;
        base = (mobile ? 3.2 : 4) / Le;
        parts = Array.from({ length: mobile ? 900 : 1700 }, () => { const p = {}; spawn(p, true); return p; });
        amb = Array.from({ length: mobile ? 120 : 260 }, () => { const p = {}; spawnAmb(p, true); return p; });
      },
      frame(){
        fade(0.16);
        const [paths, ambP] = flow();
        ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.strokeStyle = PAL[1]; ctx.stroke(ambP); ctx.globalAlpha = 1;
        strokePaths(paths, TCOL, 1.3);
        drawEngine(); drawBlades(); drawLabels();
        readout(mobile ? 16 : X0, mobile ? cy + Rn * 1.6 : cy - Rn * 1.55, ['Turbofan', 'Peak gas temperature 1,750 K', 'Low and high pressure spools'], 'left');
      },
      still(){ clear(); for (let i = 0; i < 40; i++){ fade(0.16); strokePaths(flow()[0], TCOL, 1.3); } drawEngine(); drawBlades(); drawLabels(); }
    };
  }

  // =========================================================
  // Four-stroke engine: slider-crank kinematics, valve timing from the cams,
  // ideal-gas cylinder pressure, and a live pressure-volume diagram
  // =========================================================
  function Engine(){
    const CR = 10, GAM = 1.32, P1 = 0.95, T1 = 330, SPEED = TAU / 150, PMAX = 72;
    const vc = 1 / (CR - 1), vB = vc + 1;
    let cx, B, rc, rodL, pinOff, yTDC, yc, clr, yHead, headTop, camY, th, pv, gas, runI, runE, pathI, pathE, plot;

    const pistonTop = a => yc - (rc * Math.cos(a) + Math.sqrt(rodL * rodL - rc * rc * Math.sin(a) ** 2)) - pinOff;
    const vol = a => vc + (pistonTop(a) - yTDC) / (2 * rc);
    const degOf = a => ((a * 180 / PI) % 720 + 720) % 720;
    function lift(d, intake){
      let x = d, o, c;
      if (intake){ o = -10; c = 220; if (x > 700) x -= 720; } else { o = 500; c = 730; if (x < 20) x += 720; }
      return x > o && x < c ? Math.sin(PI * (x - o) / (c - o)) : 0;
    }
    function state(d){
      const v = vol(d * PI / 180);
      const Pc = P1 * Math.pow(vB / v, GAM), P3 = P1 * Math.pow(vB / vc, GAM) * 3.4, Pe = P3 * Math.pow(vc / v, GAM);
      const T = P => T1 * P * v / (P1 * vB);
      if (d < 180) return [P1, T1, v];
      if (d < 345) return [Pc, T(Pc), v];
      if (d < 395){ const xb = 1 - Math.exp(-5 * Math.pow((d - 345) / 50, 3)), P = (1 - xb) * Pc + xb * Pe; return [P, T(P), v]; }
      if (d < 540) return [Pe, T(Pe), v];
      const PeB = P3 * Math.pow(vc / vB, GAM), TeB = T1 * PeB / P1, k = Math.exp(-(d - 540) / 18);
      return [1.1 + (PeB - 1.1) * k, 900 + (TeB - 900) * k, v];
    }
    function polyline(pts){
      const L = [0];
      for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, L, total: L[L.length - 1] };
    }
    function along(pl, t, off){
      const d = t * pl.total; let i = 1;
      while (i < pl.L.length - 1 && pl.L[i] < d) i++;
      const [x0, y0] = pl.pts[i - 1], [x1, y1] = pl.pts[i], f = (d - pl.L[i - 1]) / (pl.L[i] - pl.L[i - 1] || 1);
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      return [x0 + dx * f - dy / l * off, y0 + dy * f + dx / l * off];
    }
    function update(){
      th = (th + SPEED) % (4 * PI);
      const d = degOf(th), [P, T, v] = state(d);
      pv.push([v, P, T]); if (pv.length > 300) pv.shift();
      // in-cylinder tumble
      for (const g of gas){
        g.u += -(g.w - 0.5) * 0.045 + (Math.random() - 0.5) * 0.012;
        g.w += (g.u - 0.5) * 0.045 + (Math.random() - 0.5) * 0.012;
        g.u = clamp(g.u, 0.03, 0.97); g.w = clamp(g.w, 0.03, 0.97);
      }
      const li = lift(d, true), le = lift(d, false);
      runI.forEach(r => { r.t += li * 0.02; if (r.t > 1) r.t -= 1; });
      runE.forEach(r => { r.t += le * 0.02; if (r.t > 1) r.t -= 1; });
    }
    function draw(){
      clear();
      const d = degOf(th), [P, T] = state(d), pt = pistonTop(th), li = lift(d, true), le = lift(d, false), ml = B * 0.12;
      const wall = B * 0.14, yBot = yTDC + 2 * rc + B * 0.8;
      // block and water jacket
      ctx.fillStyle = '#0B0B0B'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      [-1, 1].forEach(s => {
        const x = s < 0 ? cx - B / 2 - wall : cx + B / 2;
        ctx.fillRect(x, yHead, wall, yBot - yHead); ctx.strokeRect(x, yHead, wall, yBot - yHead);
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = '#2E4A5A';
        const jx = s < 0 ? x - B * 0.12 : x + wall + B * 0.12;
        ctx.beginPath(); ctx.moveTo(jx, yHead + 4); ctx.lineTo(jx, yTDC + rc * 1.6); ctx.stroke(); ctx.restore();
      });
      // gas in the chamber
      const cb = tBucket(T);
      ctx.globalAlpha = 0.14; ctx.fillStyle = TCOL[cb]; ctx.fillRect(cx - B / 2, yHead, B, pt - yHead); ctx.globalAlpha = 1;
      const plugX = cx, plugY = yHead, flameR = d >= 345 && d < 400 ? B * 1.3 * clamp((d - 348) / 40, 0, 1) : (d >= 400 && d < 540 ? 1e9 : 0);
      const Tun = state(Math.min(d, 344))[1];
      for (const g of gas){
        const X = cx - B / 2 + g.u * B, Y = yHead + g.w * (pt - yHead);
        let b = cb;
        if (d >= 345 && d < 400) b = Math.hypot(X - plugX, Y - plugY) < flameR ? 4 : tBucket(Tun);
        ctx.fillStyle = TCOL[b]; ctx.fillRect(X - 1.2, Y - 1.2, 2.4, 2.4);
      }
      // flame front and spark
      if (d >= 345 && d < 400){
        ctx.save(); ctx.beginPath(); ctx.rect(cx - B / 2, yHead, B, pt - yHead); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(plugX, plugY, 0, plugX, plugY, Math.max(1, flameR));
        g.addColorStop(0, 'rgba(255,244,218,0.5)'); g.addColorStop(0.8, 'rgba(255,122,46,0.35)'); g.addColorStop(1, 'rgba(255,122,46,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - B / 2, yHead, B, pt - yHead); ctx.restore();
      }
      // piston
      const ph = B * 0.75;
      ctx.fillStyle = '#141414'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.fillRect(cx - B / 2 + 1, pt, B - 2, ph); ctx.strokeRect(cx - B / 2 + 1, pt, B - 2, ph);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath();
      [0.08, 0.14, 0.2].forEach(f => { ctx.moveTo(cx - B / 2 + 1, pt + B * f); ctx.lineTo(cx + B / 2 - 1, pt + B * f); });
      ctx.stroke(); ctx.restore();
      // connecting rod
      const pinY = pt + pinOff, cpx = cx + rc * Math.sin(th), cpy = yc - rc * Math.cos(th);
      const ang = Math.atan2(cpy - pinY, cpx - cx), nx = -Math.sin(ang), ny = Math.cos(ang);
      ctx.beginPath();
      ctx.moveTo(cx + nx * B * 0.07, pinY + ny * B * 0.07); ctx.lineTo(cpx + nx * B * 0.1, cpy + ny * B * 0.1);
      ctx.lineTo(cpx - nx * B * 0.1, cpy - ny * B * 0.1); ctx.lineTo(cx - nx * B * 0.07, pinY - ny * B * 0.07); ctx.closePath();
      ctx.fillStyle = '#1C1C1C'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, pinY, B * 0.09, 0, TAU); ctx.fillStyle = FILL; ctx.fill(); ctx.stroke();
      // crank: counterweight, web, pins
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath(); ctx.moveTo(cx, yc); ctx.arc(cx, yc, rc * 1.35, th, th + PI); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, yc, rc * 0.55, 0, TAU); ctx.fillStyle = FILL; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, yc); ctx.lineTo(cpx, cpy); ctx.lineWidth = B * 0.16; ctx.strokeStyle = '#2A2A2A'; ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(cpx, cpy, B * 0.12, 0, TAU); ctx.fillStyle = FILL; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, yc, B * 0.08, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = '#2A2A2A'; ctx.beginPath(); ctx.arc(cx, yc, rc * 1.9, 0, TAU); ctx.stroke(); ctx.restore();
      // head with ports
      ctx.fillStyle = '#0B0B0B'; ctx.fillRect(cx - B * 1.35, headTop, B * 2.7, yHead - headTop);
      ctx.strokeStyle = INK; ctx.strokeRect(cx - B * 1.35, headTop, B * 2.7, yHead - headTop);
      const pw = B * 0.22;
      [pathI, pathE].forEach(pl => {
        ctx.beginPath(); pl.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        ctx.lineWidth = pw + 2.6; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = pw; ctx.strokeStyle = '#050505'; ctx.stroke();
      });
      ctx.lineWidth = 1.3;
      // runner flow
      runI.forEach(r => { const [x, y] = along(pathI, r.t, r.o * pw); ctx.fillStyle = TCOL[0]; ctx.globalAlpha = 0.3 + 0.7 * li; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); });
      runE.forEach(r => { const [x, y] = along(pathE, r.t, r.o * pw); ctx.fillStyle = TCOL[le > 0 ? tBucket(T) : 2]; ctx.globalAlpha = 0.3 + 0.7 * le; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); });
      ctx.globalAlpha = 1;
      // valves, springs, cams
      [[-1, li, 105], [1, le, 615]].forEach(([s, L, peak]) => {
        const vx = cx + s * B * 0.22, open = L * ml, stemTop = camY + B * 0.12 + open;
        ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(vx, stemTop); ctx.lineTo(vx, yHead + open); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx - B * 0.15, yHead + open); ctx.lineTo(vx + B * 0.15, yHead + open);
        ctx.lineTo(vx + B * 0.05, yHead + open - B * 0.06); ctx.lineTo(vx - B * 0.05, yHead + open - B * 0.06); ctx.closePath();
        ctx.fillStyle = '#1A1A1A'; ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8C8C8C'; ctx.lineWidth = 1; coil(vx, headTop - 1, vx, stemTop + B * 0.04, B * 0.18, 6);
        ctx.fillStyle = INK; ctx.fillRect(vx - B * 0.1, stemTop, B * 0.2, B * 0.04);
        // cam lobe
        const bc = th / 2 + (PI / 2 - (peak * PI / 180) / 2);
        ctx.beginPath();
        for (let i = 0; i <= 60; i++){
          const ph = i / 60 * TAU, r = B * 0.12 + ml * Math.pow(Math.max(0, Math.cos(ph - bc)), 4);
          const X = vx + Math.cos(ph) * r, Y = camY + Math.sin(ph) * r;
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.closePath(); ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.beginPath(); ctx.arc(vx, camY, 2, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      });
      // spark plug and spark
      ctx.fillStyle = '#D8D8D8'; ctx.fillRect(cx - B * 0.05, headTop - B * 0.14, B * 0.1, yHead - headTop + B * 0.14 - B * 0.02);
      if (d >= 336 && d < 352){
        ctx.strokeStyle = '#FFF4DA'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, yHead);
        for (let i = 1; i < 5; i++) ctx.lineTo(cx + (Math.random() - 0.5) * B * 0.12, yHead + i * B * 0.025);
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,244,218,0.5)';
        ctx.beginPath(); ctx.arc(cx, yHead + B * 0.05, B * 0.12, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      }
      // readout
      const stroke = d < 180 ? 'Intake' : d < 360 ? 'Compression' : d < 540 ? 'Power' : 'Exhaust';
      const lines = [stroke + ' stroke', 'Crank ' + Math.round(d) + '°', 'Cylinder pressure ' + P.toFixed(1) + ' bar', 'Gas temperature ' + Math.round(T) + ' K', 'Shown at about 1/100 speed'];
      if (mobile) readout(16, H * 0.6, lines.slice(0, 4), 'left');
      else readout(cx - B * 1.55, yTDC + B * 0.6, lines, 'right');
      if (plot) drawPV();
    }
    function drawPV(){
      const { x, y, w, h } = plot, X = v => x + (v / (vB * 1.05)) * w, Y = P => y + h - (P / PMAX) * h;
      ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
      const paths = newPaths(5);
      for (let i = 1; i < pv.length; i++) seg(paths[tBucket(pv[i][2])], X(pv[i - 1][0]), Y(pv[i - 1][1]), X(pv[i][0]), Y(pv[i][1]));
      strokePaths(paths, TCOL, 1.6);
      const last = pv[pv.length - 1];
      if (last){ ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 3, 0, TAU); ctx.fill(); }
      ctx.font = '11px "Hanken Grotesk", Arial, sans-serif'; ctx.fillStyle = MUTE;
      ctx.textAlign = 'left'; ctx.fillText('Pressure', x + 4, y + 10);
      ctx.textAlign = 'right'; ctx.fillText('Volume', x + w, y + h + 14);
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText('Pressure vs volume', x, y - 10);
    }

    return {
      caption: 'A four-stroke engine: intake, compression, power, exhaust. Crank, rod and cams move together, and the pressure-volume loop is traced live. Color is gas temperature.',
      legend: { grad: GRAD_TEMP, lo: 'cooler', hi: 'hotter' },
      init(){
        cx = mobile ? W * 0.62 : W * 0.6;
        B = mobile ? W * 0.2 : Math.min(W * 0.085, H * 0.15);
        rc = B * 0.42; rodL = rc * 3.4; pinOff = B * 0.35; clr = B * 0.18;
        yTDC = (mobile ? H * 0.19 : H * 0.07) + B * 1.6;
        yc = yTDC + rc + rodL + pinOff; yHead = yTDC - clr; headTop = yHead - B * 0.75; camY = headTop - B * 0.4;
        const sI = cx - B * 0.22, sE = cx + B * 0.22;
        pathI = polyline([[cx - B * 1.35, yHead - B * 0.5], [cx - B * 0.75, yHead - B * 0.46], [cx - B * 0.35, yHead - B * 0.3], [sI, yHead - B * 0.02]]);
        pathE = polyline([[sE, yHead - B * 0.02], [cx + B * 0.35, yHead - B * 0.3], [cx + B * 0.75, yHead - B * 0.46], [cx + B * 1.35, yHead - B * 0.5]]);
        gas = Array.from({ length: 110 }, () => ({ u: Math.random(), w: Math.random() }));
        runI = Array.from({ length: 34 }, () => ({ t: Math.random(), o: (Math.random() - 0.5) * 0.7 }));
        runE = Array.from({ length: 34 }, () => ({ t: Math.random(), o: (Math.random() - 0.5) * 0.7 }));
        plot = mobile ? null : { x: cx + B * 1.7, y: H * 0.3, w: Math.min(220, W * 0.15), h: H * 0.24 };
        th = 0; pv = [];
        for (let i = 0; i < 300; i++) update();
      },
      frame(){ update(); draw(); },
      still(){ for (let i = 0; i < 160; i++) update(); draw(); }
    };
  }

  // =========================================================
  // Karman vortex street: point vortices shed alternately behind a cylinder
  // (with image vortices so the cylinder stays a solid wall), Strouhal number 0.2
  // =========================================================
  function Vortex(){
    const G = 3.4, ST = 0.2;
    let cx, cy, a, dt, vort, dye, bg, shedEvery, fcount, sign, shed, xmaxU, ymaxU;

    function vel(x, y, skip){
      const r2 = x * x + y * y, r4 = r2 * r2;
      let u = 1 - (x * x - y * y) / r4, v = -(2 * x * y) / r4;
      for (let i = 0; i < vort.length; i++){
        const q = vort[i];
        if (i !== skip){ const dx = x - q.x, dy = y - q.y, d2 = dx * dx + dy * dy + q.d * q.d; u -= q.g * dy / (TAU * d2); v += q.g * dx / (TAU * d2); }
        const m = q.x * q.x + q.y * q.y, ix = q.x / m, iy = q.y / m;
        let dx = x - ix, dy = y - iy, d2 = dx * dx + dy * dy + 0.02;
        u += q.g * dy / (TAU * d2); v -= q.g * dx / (TAU * d2);
        d2 = r2 + 0.02; u -= q.g * y / (TAU * d2); v += q.g * x / (TAU * d2);
      }
      return [u, v];
    }
    function step(withDye){
      fcount++;
      if (fcount % shedEvery === 0){
        vort.push({ x: 1.35, y: sign * 0.72, g: -sign * G, d: 0.3, age: 0 });
        sign = -sign; shed++;
      }
      const moves = vort.map((q, i) => vel(q.x, q.y, i));
      vort.forEach((q, i) => { q.x += moves[i][0] * dt; q.y += moves[i][1] * dt; q.age++; q.d = Math.min(1.1, 0.3 + q.age * 0.003); q.g *= 0.9994; });
      vort = vort.filter(q => q.x < xmaxU + 3);
      if (withDye){
        for (let s = -1; s <= 1; s += 2){
          for (let i = 0; i < (mobile ? 4 : 6); i++){
            const t = (100 + (Math.random() - 0.5) * 12) * PI / 180;
            dye.push({ x: Math.cos(t) * 1.04, y: s * Math.sin(t) * 1.04, c: s < 0 ? 0 : 1 });
          }
        }
        for (const p of dye){
          const [u, v] = vel(p.x, p.y, -1); p.x += u * dt; p.y += v * dt;
          const r = Math.hypot(p.x, p.y); if (r < 1.02){ p.x *= 1.02 / r; p.y *= 1.02 / r; }
        }
        dye = dye.filter(p => p.x < xmaxU + 1 && Math.abs(p.y) < ymaxU + 2);
        const cap = mobile ? 3500 : 6500; if (dye.length > cap) dye.splice(0, dye.length - cap);
      }
    }
    function spawnBg(p, any){ p.x = any ? -cx / a + Math.random() * (xmaxU + cx / a) : -cx / a - Math.random(); p.y = (Math.random() * H - cy) / a; }
    function drawBody(){
      ctx.beginPath(); ctx.arc(cx, cy, a, 0, TAU); ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - a * 0.7, cy); ctx.lineTo(cx + a * 0.7, cy); ctx.moveTo(cx, cy - a * 0.7); ctx.lineTo(cx, cy + a * 0.7);
      ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = 1; ctx.stroke();
    }
    function drawAll(){
      const bgp = new Path2D();
      for (const p of bg){
        const X0 = cx + p.x * a, Y0 = cy + p.y * a, [u, v] = vel(p.x, p.y, -1);
        p.x += u * dt; p.y += v * dt;
        if (p.x > xmaxU + 1 || Math.hypot(p.x, p.y) < 1.01){ spawnBg(p, false); continue; }
        seg(bgp, X0, Y0, cx + p.x * a, cy + p.y * a);
      }
      ctx.globalAlpha = 0.45; ctx.strokeStyle = PAL[1]; ctx.lineWidth = 1; ctx.stroke(bgp); ctx.globalAlpha = 1;
      const cols = ['#39C6D6', '#F4C542'];
      for (let c = 0; c < 2; c++){
        ctx.fillStyle = cols[c]; ctx.globalAlpha = 0.75;
        for (const p of dye) if (p.c === c) ctx.fillRect(cx + p.x * a - 0.8, cy + p.y * a - 0.8, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      drawBody();
      readout(mobile ? 16 : cx - a, mobile ? H * 0.56 : cy - a * 3.6, ['Kármán vortex street', 'Strouhal number ' + ST.toFixed(2), 'Vortices shed ' + shed], 'left');
    }

    return {
      caption: 'Vortices peel off alternately behind a cylinder and drift downstream as a Kármán street. Point-vortex model with a Strouhal number of 0.2. Dye marks the two sides.',
      legend: null,
      init(){
        a = mobile ? W * 0.06 : Math.min(W, H) * 0.045;
        cx = mobile ? W * 0.18 : W * 0.3; cy = mobile ? H * 0.32 : H * 0.4;
        dt = (mobile ? 2.2 : 2.6) / a;
        xmaxU = (W - cx) / a; ymaxU = Math.max(cy, H - cy) / a;
        shedEvery = Math.round((1 / ST) / dt); // half of the shedding period D/(St U), with D = 2a
        vort = []; dye = []; fcount = 0; sign = -1; shed = 0;
        const warm = Math.round((xmaxU * 1.1) / dt);
        for (let i = 0; i < warm; i++) step(i > warm - 260);
        bg = Array.from({ length: mobile ? 250 : 550 }, () => { const p = {}; spawnBg(p, true); return p; });
      },
      frame(){ step(true); fade(0.22); drawAll(); },
      still(){ clear(); drawAll(); }
    };
  }

  // =========================================================
  // Quarter-car suspension: sprung mass, unsprung mass, spring, damper and tire,
  // integrated live over a bumpy hill-climb road
  // =========================================================
  function Suspension(){
    const MS = 300, MU = 40, KS = 22000, CS = 1600, KT = 190000, V = 20, EXA = 3, SUB = 12, RP = 0.32;
    let S, xw, GY, Rw, sPos, zs, vs, zu, vu, as, hist, wr, chart;

    function road(s){
      let z = 0.05 * Math.sin(s * 0.12) + 0.015 * Math.sin(s * 0.9 + 1.3) + 0.005 * Math.sin(s * 2.6);
      const m = ((s % 22) + 22) % 22;
      if (m > 6 && m < 6.7) z += 0.075 * Math.sin(PI * (m - 6) / 0.7) ** 2;
      if (m > 15 && m < 15.9) z -= 0.05 * Math.sin(PI * (m - 15) / 0.9) ** 2;
      return z;
    }
    function update(){
      const h = 1 / 60 / SUB;
      for (let i = 0; i < SUB; i++){
        const zr = road(sPos), fs = KS * (zu - zs) + CS * (vu - vs);
        as = fs / MS;
        const au = (-fs - KT * (zu - zr)) / MU;
        vs += as * h; vu += au * h; zs += vs * h; zu += vu * h; sPos += V * h;
      }
      hist.push([road(sPos), zu, zs]); if (hist.length > chart.w) hist.shift();
      wr += V / 60 / RP;
    }
    const roadY = s => GY - road(s) * S * EXA;
    function draw(){
      clear();
      // roadside posts
      const s0 = sPos - xw / S, s1 = sPos + (W - xw) / S;
      ctx.lineWidth = 2;
      for (let sk = Math.ceil(s0 / 2) * 2; sk < s1; sk += 2){
        const X = xw + (sk - sPos) * S, y = roadY(sk) - Rw * 0.3;
        if (!mobile && X < W * 0.45) continue;
        ctx.strokeStyle = '#5A5A5A'; ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X, y - Rw * 1.1); ctx.stroke();
        ctx.fillStyle = '#F2603A'; ctx.fillRect(X - 1.5, y - Rw * 1.05, 3, Rw * 0.15);
      }
      // road
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let X = 0; X <= W + 3; X += 3) ctx.lineTo(X, roadY(sPos + (X - xw) / S));
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
      ctx.beginPath();
      for (let X = 0; X <= W + 3; X += 3){ const Y = roadY(sPos + (X - xw) / S); X ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.strokeStyle = leftFade('#6E6E6E'); ctx.lineWidth = 1.5; ctx.stroke();
      // body (fender section with wheel arch)
      const wcY = GY - zu * S * EXA - Rw, baseY = GY - Rw - zs * S * EXA - Rw * 1.25, archC = baseY + Rw * 1.25;
      ctx.beginPath();
      ctx.moveTo(xw - Rw * 2.6, baseY + Rw * 0.35); ctx.lineTo(xw - Rw * 2.6, baseY - Rw * 0.6);
      ctx.quadraticCurveTo(xw - Rw * 1.2, baseY - Rw * 0.95, xw + Rw * 0.5, baseY - Rw * 0.95);
      ctx.lineTo(xw + Rw * 2.6, baseY - Rw * 0.85); ctx.lineTo(xw + Rw * 2.6, baseY + Rw * 0.35);
      ctx.lineTo(xw + Rw * 0.867, baseY + Rw * 0.35);
      ctx.arc(xw, archC, Rw * 1.25, Math.atan2(-0.9, 0.867), Math.atan2(-0.9, -0.867), true);
      ctx.lineTo(xw - Rw * 2.6, baseY + Rw * 0.35); ctx.closePath();
      ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      // tire and wheel
      ctx.beginPath(); ctx.arc(xw, wcY, Rw, 0, TAU); ctx.fillStyle = '#0B0B0B'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#8C8C8C';
      ctx.beginPath(); ctx.arc(xw, wcY, Rw * 0.62, 0, TAU);
      for (let k = 0; k < 6; k++){ const an = wr + k * TAU / 6; ctx.moveTo(xw + Math.cos(an) * Rw * 0.15, wcY + Math.sin(an) * Rw * 0.15); ctx.lineTo(xw + Math.cos(an) * Rw * 0.62, wcY + Math.sin(an) * Rw * 0.62); }
      ctx.stroke();
      // lower control arm
      ctx.strokeStyle = '#8C8C8C'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xw, wcY); ctx.lineTo(xw - Rw * 1.9, baseY + Rw * 0.3); ctx.stroke();
      // coilover: damper + spring
      const x = xw + Rw * 0.12, yLow = wcY - Rw * 0.12, yUp = baseY - Rw * 0.4, mid = (yLow + yUp) / 2;
      ctx.lineWidth = 1.3; ctx.strokeStyle = MUTE;
      ctx.beginPath(); ctx.moveTo(x, yLow); ctx.lineTo(x, mid); ctx.stroke();
      ctx.fillStyle = '#1A1A1A'; ctx.fillRect(x - Rw * 0.08, yUp, Rw * 0.16, mid - yUp + Rw * 0.05); ctx.strokeRect(x - Rw * 0.08, yUp, Rw * 0.16, mid - yUp + Rw * 0.05);
      ctx.strokeStyle = '#F4C542'; ctx.lineWidth = 1.6; coil(x, yLow - Rw * 0.08, x, yUp + Rw * 0.08, Rw * 0.42, 7);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, yLow, 3, 0, TAU); ctx.arc(x, yUp, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(xw, wcY, 4, 0, TAU); ctx.fill();
      drawChart();
    }
    function drawChart(){
      const { x, y, w, h } = chart, mid = y + h / 2, k = h / 2 / 0.12;
      ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
      ctx.beginPath(); ctx.moveTo(x, mid); ctx.lineTo(x + w, mid); ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
      const cols = ['#6E7F92', '#39C6D6', '#F4C542'], names = ['Road', 'Wheel', 'Body'];
      for (const c of [1, 0, 2]){
        ctx.beginPath();
        hist.forEach((hh, i) => { const X = x + w - (hist.length - i), Y = mid - clamp(hh[c], -0.12, 0.12) * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.strokeStyle = cols[c]; ctx.lineWidth = c === 2 ? 2 : 1.3; ctx.stroke();
      }
      ctx.font = '11.5px "Hanken Grotesk", Arial, sans-serif'; ctx.textAlign = 'left';
      let lx = x + 8; names.forEach((n, i) => { ctx.fillStyle = cols[i]; ctx.fillText(n, lx, y + 16); lx += ctx.measureText(n).width + 14; });
      ctx.fillStyle = MUTE; ctx.textAlign = 'right'; ctx.fillText('Height over the last few seconds', x + w, y + h + 15);
      const lines = ['Quarter-car suspension', 'Speed ' + Math.round(V * 3.6) + ' km/h', 'Body travel ' + (zs * 100).toFixed(1) + ' cm',
        'Wheel travel ' + (zu * 100).toFixed(1) + ' cm', 'Body acceleration ' + (as / 9.81).toFixed(2) + ' g', 'Vertical motion shown 3x'];
      readout(x, y + h + 40, mobile ? [lines[0], lines[2], lines[5]] : lines, 'left');
    }

    return {
      caption: 'A quarter-car suspension on a bumpy hill-climb road. Spring, damper and tire are integrated live; the chart shows how much of the road the body actually feels.',
      legend: null,
      init(){
        S = mobile ? W * 0.4 : Math.min(W * 0.16, H * 0.26); Rw = RP * S;
        xw = mobile ? W * 0.52 : W * 0.7; GY = mobile ? H * 0.6 : H * 0.66;
        chart = mobile ? { x: 16, y: H * 0.15, w: W - 32, h: H * 0.12 } : { x: W * 0.04, y: H * 0.15, w: Math.min(W * 0.34, 480), h: H * 0.2 };
        chart.w = Math.round(chart.w);
        sPos = 0; zs = 0; vs = 0; zu = 0; vu = 0; as = 0; wr = 0; hist = [];
        for (let i = 0; i < chart.w; i++) update();
      },
      frame(){ update(); draw(); },
      still(){ draw(); }
    };
  }

  // =========================================================
  // Controller
  // =========================================================
  const scenes = {
    catch: Catch(),
    car: Car(),
    ascent: Ascent(),
    wing: Wing(),
    orbit: Orbit(),
    jet: Jet(),
    engine: Engine(),
    vortex: Vortex(),
    suspension: Suspension(),
  };
  const order = Object.keys(scenes);
  const capEl = document.getElementById('sim-caption');
  const legendEl = document.getElementById('sim-legend');
  const nextBtn = document.getElementById('sim-next');
  let cur, name;

  function size(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mobile = W < 720;
  }
  function start(n){
    name = n; cur = scenes[n];
    if (capEl) capEl.textContent = cur.caption;
    if (legendEl){
      legendEl.hidden = !cur.legend;
      if (cur.legend){
        const bar = legendEl.querySelector('.scale'), lo = document.getElementById('sim-lo'), hi = document.getElementById('sim-hi');
        if (bar) bar.style.background = cur.legend.grad;
        if (lo) lo.textContent = cur.legend.lo;
        if (hi) hi.textContent = cur.legend.hi;
      }
    }
    try { localStorage.setItem('lastSim', n); } catch (e) {}
    clear(); cur.init();
    if (reduce) cur.still();
  }
  function pick(){
    const q = new URLSearchParams(location.search).get('sim');
    if (q && scenes[q]) return q;
    let last = null;
    try { last = localStorage.getItem('lastSim'); } catch (e) {}
    const opts = order.length > 1 ? order.filter(o => o !== last) : order;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  size(); start(pick());
  if (nextBtn) nextBtn.addEventListener('click', () => start(order[(order.indexOf(name) + 1) % order.length]));

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { size(); clear(); cur.init(); if (reduce) cur.still(); }, 150);
  });

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  (function loop(){
    if (!reduce && visible && !document.hidden){ F++; cur.frame(); }
    requestAnimationFrame(loop);
  })();
})();

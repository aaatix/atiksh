/*
  Hero simulations. One is picked at random per page load (never the same twice in a row).
  Force one for testing with ?sim=catch, ?sim=car, ?sim=ascent or ?sim=wing in the URL.
  To remove a simulation, delete its line in the `scenes` object near the bottom.
*/
(function(){
  const cv = document.getElementById('flow');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PI = Math.PI;

  // Shared palette: slow, freestream, faster, fast, fastest
  const PAL = ['#3D7BFF', '#6E7F92', '#39C6D6', '#F4C542', '#F2603A'];
  const FIRE = ['#FFF4DA', '#FFC24A', '#FF7A2E', '#A8301A'];
  const INK = '#F2F2F2', FILL = '#050505';
  let W = 0, H = 0, mobile = false;

  // ---------- helpers ----------
  const fade = a => { ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(0, 0, W, H); };
  const clear = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); };
  const newPaths = n => Array.from({ length: n }, () => new Path2D());
  const seg = (p, x0, y0, x1, y1) => { p.moveTo(x0, y0); p.lineTo(x1, y1); };
  function strokePaths(paths, cols, lw){
    ctx.lineWidth = lw; ctx.lineCap = 'round';
    paths.forEach((p, i) => { ctx.strokeStyle = cols[i]; ctx.stroke(p); });
  }
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += Math.random(); return (u - 2) * 1.7; };
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
  // complex numbers as [re, im]
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const div = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
  const sc = (p, k) => [p[0] * k, p[1] * k];

  // =========================================================
  // 1. Booster catch: constant-deceleration landing burn into tower arms
  // =========================================================
  function Catch(){
    const V0 = 160, A = 25, HB = V0 * V0 / (2 * A), HC = HB + 220, DT = 1 / 60;
    let bx, bw, len, restTop, GY, tX, tW, tTop, armY, k, stars, fire;
    let phase, t, h, v, arm, thr, tHold;

    function reset(){ phase = 'coast'; h = HC; v = V0; arm = 1; thr = 0; t = 0; tHold = 0; fire = []; }

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
        if (phase === 'caught'){ thr = 0; arm = 0; }
      } else if (phase === 'caught'){
        tHold += DT; thr = 0; v = 0; h = 0; arm = 0;
        if (tHold > 3.2){ phase = 'out'; tHold = 0; }
      } else if (phase === 'out'){
        tHold += DT;
        if (tHold > 1) reset();
      }
      // exhaust
      const top = restTop - h * k, bot = top + len;
      if (thr > 0){
        const n = Math.round((mobile ? 8 : 12) * thr), vpx = v * k * DT;
        for (let i = 0; i < n; i++){
          const o = [-0.28, 0, 0.28][i % 3] * bw + (Math.random() - 0.5) * bw * 0.15;
          fire.push({ X: bx + o, Y: bot + bw * 0.3, vx: (Math.random() - 0.5) * 1.2 + o * 0.02,
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

    function drawStars(){
      for (const s of stars){ ctx.globalAlpha = s.a; ctx.fillStyle = INK; ctx.fillRect(s.x, s.y, s.r, s.r); }
      ctx.globalAlpha = 1;
    }
    function drawGround(){
      ctx.fillStyle = '#000'; ctx.fillRect(0, GY, W, H - GY);
      ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(Math.max(0, bx - bw * 8), GY); ctx.lineTo(W, GY); ctx.stroke();
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
      ctx.fillStyle = '#141414'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(tX - 2, armY - bw * 0.45, tW + 4, bw * 0.9);
      ctx.strokeRect(tX - 2, armY - bw * 0.45, tW + 4, bw * 0.9);
    }
    function drawBooster(){
      const x0 = bx - bw / 2, top = restTop - h * k, bot = top + len;
      if (bot < -20) return;
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
      [-0.28, 0, 0.28].forEach(o => {
        const ex = bx + o * bw;
        ctx.beginPath();
        ctx.moveTo(ex - bw * 0.08, bot); ctx.lineTo(ex - bw * 0.13, bot + bw * 0.3);
        ctx.lineTo(ex + bw * 0.13, bot + bw * 0.3); ctx.lineTo(ex + bw * 0.08, bot);
        ctx.closePath(); ctx.fillStyle = '#161616'; ctx.fill(); ctx.stroke();
      });
      ctx.fillStyle = FILL; ctx.fillRect(x0, top, bw, len); ctx.strokeRect(x0, top, bw, len);
      // grid fins
      [-1, 1].forEach(d => {
        const fw = bw * 0.42, fh = bw * 0.36, fx = d < 0 ? x0 - fw : x0 + bw, fy = top + len * 0.025;
        ctx.fillStyle = FILL; ctx.fillRect(fx, fy, fw, fh); ctx.strokeRect(fx, fy, fw, fh);
        ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let i = 1; i < 3; i++){
          ctx.moveTo(fx + fw * i / 3, fy); ctx.lineTo(fx + fw * i / 3, fy + fh);
          ctx.moveTo(fx, fy + fh * i / 3); ctx.lineTo(fx + fw, fy + fh * i / 3);
        }
        ctx.stroke(); ctx.restore();
      });
      // catch pins, sitting just above where the arm lands
      const pinY = top + (armY - restTop) - bw * 0.1 - bw * 0.14;
      ctx.fillStyle = INK;
      ctx.fillRect(x0 - bw * 0.18, pinY, bw * 0.18, bw * 0.14);
      ctx.fillRect(x0 + bw, pinY, bw * 0.18, bw * 0.14);
      ctx.save(); ctx.globalAlpha = 0.4; ctx.beginPath();
      [0.12, 0.55, 0.9].forEach(f => { ctx.moveTo(x0, top + len * f); ctx.lineTo(x0 + bw, top + len * f); });
      ctx.stroke(); ctx.restore();
    }
    function drawArm(){
      const reach = tX - (bx - bw / 2) + bw * 0.3, th = arm * 1.1;
      ctx.strokeStyle = '#BDBDBD'; ctx.lineWidth = bw * 0.2; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(tX, armY);
      ctx.lineTo(tX - Math.cos(th) * reach, armY - Math.sin(th) * reach); ctx.stroke();
    }
    function drawDust(){
      const p = new Path2D();
      for (const f of fire) if (f.dust) seg(p, f.X - f.vx * 2, f.Y - f.vy * 2, f.X, f.Y);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#7A7A7A'; ctx.lineWidth = 2; ctx.stroke(p); ctx.globalAlpha = 1;
    }
    function drawTelemetry(){
      const top = restTop - h * k, x = bx - bw / 2 - bw * 0.6 - 12;
      const y = Math.min(Math.max(top + len * 0.3, 60), GY - 80);
      const label = phase === 'coast' ? 'Coasting' : phase === 'burn' ? 'Landing burn' : 'Caught';
      ctx.font = (mobile ? 11 : 12.5) + 'px "Hanken Grotesk", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = INK; ctx.fillText(label, x, y);
      ctx.fillStyle = '#8C8C8C';
      ctx.fillText('Altitude ' + Math.round(h) + ' m', x, y + 17);
      ctx.fillText('Speed ' + Math.round(v) + ' m/s', x, y + 34);
      ctx.fillText('Throttle ' + Math.round(thr * 100) + '%', x, y + 51);
    }
    function draw(){
      clear(); drawStars(); drawGround(); drawTower();
      drawFire(fire, mobile ? 1.8 : 2.4, 2.5, 0.85); drawDust();
      drawBooster(); drawArm(); drawTelemetry();
      if (phase === 'out'){ ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, tHold) + ')'; ctx.fillRect(0, 0, W, H); }
    }

    return {
      caption: 'A booster coming back to the tower. The landing burn is timed so speed hits zero right at the arms.',
      legend: false,
      init(){
        if (mobile){ bw = 18; bx = W * 0.44; len = H * 0.32; restTop = H * 0.19; GY = H * 0.64; tTop = H * 0.14; }
        else { bw = Math.max(22, Math.min(36, W * 0.022)); bx = W * 0.64; len = H * 0.46; restTop = H * 0.18; GY = H * 0.9; tTop = H * 0.08; }
        tX = bx + bw / 2 + bw * 1.2; tW = bw * 1.3; armY = restTop + len * 0.07;
        k = (restTop + len * 0.6) / HB;
        stars = Array.from({ length: mobile ? 60 : 130 }, () => ({
          x: Math.random() * W, y: Math.random() * GY * 0.85, a: 0.15 + Math.random() * 0.5, r: Math.random() < 0.1 ? 1.5 : 0.9 }));
        reset();
      },
      frame(){ update(); draw(); },
      still(){ reset(); phase = 'caught'; h = 0; v = 0; arm = 0; thr = 0; draw(); }
    };
  }

  // =========================================================
  // 2. Race car: stream-function model of air over a hill-climb car
  // =========================================================
  function Car(){
    // Top profile of the body, in car lengths (x from nose to tail, y above ground)
    const TOP = [[0,.035],[.03,.055],[.14,.085],[.3,.12],[.41,.2],[.48,.27],[.58,.28],[.69,.225],[.86,.18],[.99,.17],[1,.13],[1,.035]];
    const WG = { x0: .83, x1: 1.03, y: .29, t: .026 }, WHEELS = [.19, .8], WR = .072, LAM = .42, N = 900;
    let L, X0, GY, xa, xb, hNear, hFar, parts, maxY0, px, base, dash = 0, rot = 0;

    function body(x){
      if (x < 0 || x > 1) return 0;
      for (let i = 1; i < TOP.length; i++){
        if (x <= TOP[i][0]){
          const [a0, b0] = TOP[i - 1], [a1, b1] = TOP[i];
          return a1 === a0 ? Math.max(b0, b1) : b0 + (b1 - b0) * (x - a0) / (a1 - a0);
        }
      }
      return 0;
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
      // near the car the flow follows the body closely; higher up it only feels a smoothed shape
      hNear = blur(0.03).map((v, i) => Math.max(raw[i], v) + 0.012);
      hFar = blur(0.18).map(v => v + 0.012);
    }
    function interp(arr, x){
      const f = (x - xa) / (xb - xa) * (N - 1);
      if (f <= 0) return arr[0]; if (f >= N - 1) return arr[N - 1];
      const i = f | 0, t = f - i; return arr[i] * (1 - t) + arr[i + 1] * t;
    }
    // streamline starting at height y0 far upstream: height and speed at x
    function map(x, y0){
      const w = Math.exp(-y0 / 0.12), hh = w * interp(hNear, x) + (1 - w) * interp(hFar, x), e = Math.exp(-y0 / LAM);
      return [y0 + hh * e, 1 / (1 - (hh / LAM) * e)];
    }
    const bucket = (s, x, y0) => (x > WG.x1 - 0.02 && y0 < 0.18) ? 0 : s < 1.04 ? 1 : s < 1.25 ? 2 : s < 1.7 ? 3 : 4;
    function spawn(p, any){ p.y0 = maxY0 * Math.pow(Math.random(), 1.7); p.x = any ? xa + Math.random() * (xb - xa) : xa - Math.random() * 0.05; }
    const P = (x, y) => [X0 + x * L, GY - y * L];

    function drawRoad(){
      ctx.fillStyle = '#000'; ctx.fillRect(0, GY, W, H - GY);
      ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
      const per = 0.24 * L, off = dash % per, y = GY + Math.max(10, 0.05 * L);
      ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = -off; x < W; x += per){ ctx.moveTo(x, y); ctx.lineTo(x + per / 2, y); }
      ctx.stroke();
    }
    function drawCar(){
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.fillStyle = FILL; ctx.lineCap = 'round';
      // splitter
      ctx.beginPath(); ctx.moveTo(...P(-0.02, .03)); ctx.lineTo(...P(.12, .03)); ctx.stroke();
      // wing struts
      ctx.beginPath(); ctx.moveTo(...P(.9, .17)); ctx.lineTo(...P(.9, WG.y)); ctx.moveTo(...P(.97, .17)); ctx.lineTo(...P(.97, WG.y)); ctx.stroke();
      // body
      ctx.beginPath();
      TOP.forEach((q, i) => { const [a, b] = P(q[0], q[1]); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // cockpit glass
      ctx.save(); ctx.globalAlpha = 0.45; ctx.beginPath();
      ctx.moveTo(...P(.44, .215)); ctx.lineTo(...P(.49, .258)); ctx.lineTo(...P(.57, .262)); ctx.lineTo(...P(.62, .235)); ctx.stroke(); ctx.restore();
      // rear wing: flat top, curved bottom (it's upside down, it makes downforce)
      const { x0, x1, y, t } = WG;
      ctx.beginPath();
      ctx.moveTo(...P(x0, y + t * 0.4));
      ctx.bezierCurveTo(...P(x0 + .03, y + t), ...P(x1 - .05, y + t), ...P(x1, y + t * 0.95));
      ctx.bezierCurveTo(...P(x1 - .06, y + t * 0.2), ...P(x0 + .03, y - t * 0.35), ...P(x0, y + t * 0.4));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = 0.55;
      const [ex0, ey0] = P(x0 + .005, y + t + .035), [ex1, ey1] = P(x1 + .005, y - .04);
      ctx.strokeRect(ex0, ey0, ex1 - ex0, ey1 - ey0); ctx.restore();
      // wheels
      WHEELS.forEach(wx => {
        const [cx, cy] = P(wx, WR), r = WR * L;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * PI); ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
        ctx.strokeStyle = '#8C8C8C'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 2 * PI);
        for (let s = 0; s < 5; s++){
          const a = rot + s * 2 * PI / 5;
          ctx.moveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15);
          ctx.lineTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
        }
        ctx.stroke(); ctx.lineWidth = 1.5;
      });
    }

    return {
      caption: 'Air over a hill-climb race car with a big rear wing, from a stream-function model. Color is local airspeed.',
      legend: true,
      init(){
        L = mobile ? W * 0.8 : Math.min(W * 0.42, H * 0.95);
        X0 = mobile ? W * 0.09 : W * 0.4;
        GY = mobile ? H * 0.42 : H * 0.6;
        px = mobile ? 4 : 5; base = px / L;
        build(); maxY0 = GY / L + 0.05;
        const n = Math.round(Math.min(1300, W * H / 900));
        parts = Array.from({ length: n }, () => { const p = {}; spawn(p, true); return p; });
      },
      frame(){
        fade(0.1);
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
        strokePaths(paths, PAL, 1.2);
        dash += px; rot += px / (WR * L);
        drawRoad(); drawCar();
      },
      still(){
        clear();
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
  // 3. Rocket ascent: potential flow past a Rankine half-body, rocket frame
  // =========================================================
  function Ascent(){
    const K = 1.9;
    const vel = (x, y) => { const r2 = x * x + y * y + 1e-6; return [1 + x / r2, y / r2]; };
    const inside = (x, y) => { const ay = Math.abs(y); return ay + Math.atan2(ay, x) < PI; };
    let cx, y0, s, L, dt, air, fire, right, yb, noseY, botY, nozBot, nozHalf;
    const SX = y => cx + y * s, SY = x => y0 + x * s * K;
    const bucket = v => v < 0.75 ? 0 : v < 1.03 ? 1 : v < 1.12 ? 2 : 3;

    function spawnAir(p, init){
      for (let t = 0; t < 10; t++){
        p.y = Math.random() < 0.5 ? gauss() * 6 : ((Math.random() * W) - cx) / s;
        p.x = init ? ((Math.random() * H) - y0) / (s * K) : (-y0) / (s * K) - Math.random() * 1.5;
        if (!inside(p.x, p.y)) return;
      }
    }
    function stepAir(p){
      const k1 = vel(p.x, p.y), k2 = vel(p.x + k1[0] * dt / 2, p.y + k1[1] * dt / 2);
      return [p.x + k2[0] * dt, p.y + k2[1] * dt, Math.hypot(k2[0], k2[1])];
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
      const sy = noseY + (botY - noseY) * 0.42;
      ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.moveTo(cx - bw * 0.97, sy); ctx.lineTo(cx + bw * 0.97, sy); ctx.stroke(); ctx.globalAlpha = 1;
    }

    return {
      caption: 'Air flowing past a rocket in ascent, solved live in your browser. Color is local airspeed.',
      legend: true,
      init(){
        s = mobile ? Math.max(5.5, W * 0.017) : Math.min(12, W * 0.0085);
        cx = mobile ? W * 0.5 : W * 0.7;
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
        fire = [];
      },
      frame(){
        fade(0.12);
        const paths = newPaths(4);
        for (const p of air){
          const X0 = SX(p.y), Y0 = SY(p.x), [nx, ny, v] = stepAir(p);
          if (inside(nx, ny) || SY(nx) > H + 5){ spawnAir(p, false); continue; }
          p.x = nx; p.y = ny; seg(paths[bucket(v)], X0, Y0, SX(ny), SY(nx));
        }
        strokePaths(paths, PAL, 1.2);
        tickFire(); drawFire(fire, mobile ? 1.4 : 1.8); drawRocket();
      },
      still(){
        clear();
        const paths = newPaths(4), seeds = [];
        for (let y = -20; y <= 20; y += 0.9) seeds.push(y);
        for (let y = (0 - cx) / s; y < (W - cx) / s; y += 4) seeds.push(y);
        for (const y of seeds){
          const p = { x: (-y0) / (s * K) - 1, y };
          for (let i = 0; i < 3000; i++){
            const X0 = SX(p.y), Y0 = SY(p.x), [nx, ny, v] = stepAir(p);
            if (inside(nx, ny) || SY(nx) > H + 5) break;
            p.x = nx; p.y = ny; seg(paths[bucket(v)], X0, Y0, SX(ny), SY(nx));
          }
        }
        strokePaths(paths, PAL, 1.1);
        for (let i = 0; i < 90; i++) tickFire();
        drawFire(fire, 1.8); drawRocket();
      }
    };
  }

  // =========================================================
  // 4. Inverted wing: Joukowski airfoil, potential flow with Kutta condition
  // =========================================================
  function Wing(){
    const U = 1, a = 8 * PI / 180, mu = [-0.1, 0.12], R = Math.hypot(1 - mu[0], mu[1]), R2 = R * R;
    const e = [Math.cos(a), -Math.sin(a)], e2 = [Math.cos(a), Math.sin(a)], om = [1 - mu[0], -mu[1]];
    const Gamma = sc(mul(om, sub(e, sc(div(e2, mul(om, om)), R2))), -2 * PI * U)[1];
    const toZ = z => add(z, div([1, 0], z));
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
    const dead = z => Math.hypot(z[0] - mu[0], z[1] - mu[1]) < R * 1.002;
    const bucket = v => v < 0.85 ? 0 : v < 1.08 ? 1 : v < 1.3 ? 2 : v < 1.6 ? 3 : 4;
    let cx, cy, s, xmin, xmax, ymin, ymax, parts, foil;
    function spawn(p, any){
      p.z = [any ? xmin + Math.random() * (xmax - xmin) : xmin - Math.random() * 0.5, ymin + Math.random() * (ymax - ymin)];
      if (Math.hypot(p.z[0] - mu[0], p.z[1] - mu[1]) < R * 1.05) p.z = [xmin - 0.3, p.z[1]];
      p.life = 200 + Math.random() * 400;
    }
    function drawFoil(){
      ctx.beginPath();
      foil.forEach((z, i) => { const X = cx + z[0] * s, Y = cy + z[1] * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.closePath(); ctx.fillStyle = FILL; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    }
    return {
      caption: 'Potential flow around an inverted race wing, solved live in your browser. Color is local airspeed.',
      legend: true,
      init(){
        cx = mobile ? W * 0.55 : W * 0.64; cy = mobile ? H * 0.34 : H * 0.4;
        s = mobile ? W * 0.19 : Math.min(W * 0.1, H * 0.15);
        xmin = -cx / s; xmax = (W - cx) / s; ymin = -cy / s; ymax = (H - cy) / s;
        foil = [];
        for (let i = 0; i <= 160; i++){ const t = i / 160 * 2 * PI; foil.push(toZ([mu[0] + R * Math.cos(t), mu[1] + R * Math.sin(t)])); }
        const n = Math.round(Math.min(1100, W * H / 1100));
        parts = Array.from({ length: n }, () => { const p = {}; spawn(p, true); return p; });
      },
      frame(){
        fade(0.09);
        const paths = newPaths(5);
        for (const p of parts){
          const z0 = toZ(p.z), [nz, sp] = adv(p.z, 0.03);
          p.life--;
          if (dead(nz) || nz[0] > xmax + 1 || nz[1] < ymin - 1 || nz[1] > ymax + 1 || p.life < 0){ spawn(p, p.life < 0); continue; }
          p.z = nz; const z1 = toZ(nz);
          seg(paths[bucket(sp)], cx + z0[0] * s, cy + z0[1] * s, cx + z1[0] * s, cy + z1[1] * s);
        }
        strokePaths(paths, PAL, 1.3); drawFoil();
      },
      still(){
        clear();
        const paths = newPaths(5), rows = Math.round((ymax - ymin) / 0.12);
        for (let r = 0; r <= rows; r++){
          let z = [xmin - 0.5, ymin + r * (ymax - ymin) / rows];
          for (let i = 0; i < 1500; i++){
            const z0 = toZ(z), [nz, sp] = adv(z, 0.03);
            if (dead(nz) || nz[0] > xmax + 0.5) break;
            z = nz; const z1 = toZ(nz);
            seg(paths[bucket(sp)], cx + z0[0] * s, cy + z0[1] * s, cx + z1[0] * s, cy + z1[1] * s);
          }
        }
        strokePaths(paths, PAL, 1.1); drawFoil();
      }
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
    if (legendEl) legendEl.hidden = !cur.legend;
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
    if (!reduce && visible && !document.hidden) cur.frame();
    requestAnimationFrame(loop);
  })();
})();

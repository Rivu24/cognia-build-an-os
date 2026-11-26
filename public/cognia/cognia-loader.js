/* COGNIA loader: while a COGNIA site loads, the camera pulls back from Earth, turns to the Sun, rushes through the
   stars and comes out among real galaxies (90,000 from the Sloan Digital Sky Survey). Distances are artistic.
   Original rendering, raw WebGL2, no dependencies. Use on any site:
     <script src="cognia-loader.js" data-cognia-auto data-product="Build an OS" data-base="./"></script>
   (data-base: folder holding galaxies.bin, earth_atmos_2048.jpg, earth_clouds_1024.png). It shows at once and finishes
   on window load; add data-manual and call window.cogniaLoader.finish() yourself. From code:
     const l = CogniaLoader.create({ product: 'Build an OS', base: './' }); l.setProgress(0.4); await l.finish()
   Data: Sloan Digital Sky Survey (sdss.org). Earth maps: NASA imagery via the three.js examples.
   Code © 2026 Dron Guin, Founder, Cognia Labs. */
;(function () {
  'use strict'
  const MARK = '<svg viewBox="0 0 40 40" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="square" aria-hidden="true"><path d="M30 6H8v28h22"/><circle cx="21" cy="20" r="3.6"/></svg>'
  const CSS = `
:host{all:initial;position:fixed;inset:0;z-index:2147483000;background:#000;color:#ececea;font-family:'Instrument Sans',system-ui,sans-serif;transition:opacity .9s cubic-bezier(.4,0,.2,1)}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.l{position:absolute;left:clamp(16px,3vw,40px);top:clamp(16px,3vw,34px);display:flex;align-items:center;gap:14px;pointer-events:none}
.l svg{width:30px;height:30px}
.w{font-size:15px;letter-spacing:.32em}
.p{font-size:13px;color:#a2a2a0;border-left:1px solid rgba(255,255,255,.25);padding-left:14px}
.m{font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace}
.b{position:absolute;left:clamp(16px,3vw,40px);right:clamp(16px,3vw,40px);bottom:clamp(22px,5vh,44px);display:flex;justify-content:space-between;align-items:flex-end;gap:16px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a8a88;text-shadow:0 1px 8px #000}
.n{font-size:clamp(26px,3.2vw,40px);color:#ececea;letter-spacing:-.02em;text-transform:none;font-variant-numeric:tabular-nums}
.bar{position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(255,255,255,.12)}
.bar i{display:block;height:100%;background:#ececea;transform-origin:left;transform:scaleX(0);transition:transform .3s}
button{all:unset;cursor:pointer;position:absolute;top:clamp(14px,2.6vw,28px);right:clamp(16px,3vw,40px);border:1px solid rgba(255,255,255,.22);padding:7px 12px;font:11px 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#c4c4c2;background:rgba(0,0,0,.25)}
button:hover,button:focus-visible{border-color:#fff;color:#fff}
@media (max-width:520px){.p{display:none}}
@media (prefers-reduced-motion:reduce){:host{transition:none}}`

  /* full-screen pass: Earth (ray-traced sphere) with its atmosphere, a Milky Way band, the Sun and its flare */
  const BG_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
out vec2 vN; void main(){ vN = P[gl_VertexID]; gl_Position = vec4(vN, 0, 1); }`
  const BG_FS = `#version 300 es
precision highp float;
in vec2 vN; out vec4 o;
uniform vec3 uEye, uF, uR, uU, uSun; uniform float uTan, uAsp, uT, uEarthOn, uSunOn, uTex;
uniform vec2 uSunScr; uniform sampler2D uDay, uClouds;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 rd = normalize(uF + vN.x * uR * uTan * uAsp + vN.y * uU * uTan);
  vec3 col = vec3(0);
  vec3 bn = normalize(vec3(0.25, 1.0, -0.35));
  float bd = dot(rd, bn);
  vec2 bp = vec2(atan(rd.z, rd.x) * 3.0, bd * 9.0);
  col += exp(-bd * bd * 28.0) * (0.45 + 0.55 * vn(bp * 2.0)) * (0.6 + 0.4 * vn(bp * 7.0)) * vec3(0.09, 0.08, 0.1);
  float c = max(dot(rd, uSun), 0.0);
  col += uSunOn * (pow(c, 9000.0) * 40.0 + pow(c, 600.0) * 2.2 + pow(c, 40.0) * 0.12) * vec3(1.0, 0.93, 0.82);
  vec2 sp = vN - uSunScr; sp.x *= uAsp;
  float vis = uSunOn * step(0.0, dot(uF, uSun));
  col += vis * exp(-abs(sp.y) * 260.0) * exp(-abs(sp.x) * 1.8) * vec3(0.75, 0.8, 1.0) * 0.9;
  float r = length(sp);
  col += vis * 0.1 * vec3(exp(-pow((r - 0.62) * 9.0, 2.0)), exp(-pow((r - 0.59) * 9.0, 2.0)) * 0.6, exp(-pow((r - 0.56) * 9.0, 2.0)) * 0.9);
  vec3 oc = uEye; float b = dot(oc, rd); float k = dot(oc, oc) - 1.0; float disc = b * b - k;
  if (disc > 0.0 && uEarthOn > 0.0) {
    float tt = -b - sqrt(disc);
    if (tt > 0.0) {
      vec3 n = normalize(uEye + rd * tt);
      float lon = atan(n.x, n.z) + uT * 0.02;
      vec2 uv = vec2(lon / 6.28318 + 0.5, acos(clamp(n.y, -1.0, 1.0)) / 3.14159);
      vec3 day = uTex > 0.5 ? texture(uDay, uv).rgb : mix(vec3(0.05, 0.12, 0.3), vec3(0.3, 0.32, 0.2), step(0.55, vn(uv * vec2(18, 9))));
      float cl = uTex > 0.5 ? texture(uClouds, uv + vec2(uT * 0.002, 0)).a : 0.0;
      float nl = dot(n, uSun);
      vec3 e = mix(day, vec3(1.0), cl * 0.9) * (0.04 + 1.05 * smoothstep(-0.1, 0.35, nl));
      e += vec3(0.3, 0.55, 1.0) * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.8 * smoothstep(-0.3, 0.5, nl);
      col = mix(col, e, uEarthOn);
    }
  }
  float cd = sqrt(max(k - b * b + 1.0, 0.0));
  if (b < 0.0 && cd > 1.0) col += uEarthOn * vec3(0.3, 0.55, 1.0) * exp(-(cd - 1.0) * 28.0) * 0.9;
  o = vec4(col, 1.0);
}`

  /* stars: line segments stretched along the camera's motion */
  const ST_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC;
uniform mat4 uPV; uniform vec3 uCam, uVel; uniform float uBox, uOn;
out vec4 vC;
void main(){
  float end = float(gl_VertexID % 2);
  vec3 p = mod(aP - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  p -= uVel * end;
  vC = vec4(aC.rgb, aC.a * uOn * smoothstep(uBox * 0.5, uBox * 0.15, length(p)) * (1.0 - end * 0.85));
  gl_Position = uPV * vec4(p, 1.0);
}`
  const ST_FS = `#version 300 es
precision mediump float; in vec4 vC; out vec4 o; void main(){ o = vec4(vC.rgb * vC.a, 1.0); }`

  /* galaxies at their real positions: small tilted discs with bright cores */
  const GX_VS = `#version 300 es
layout(location=0) in vec4 aG;
uniform mat4 uPV; uniform mat3 uRot; uniform vec3 uCam; uniform float uPx, uOn, uSpan;
out float vA; out vec2 vO; out float vS; out vec3 vC;
void main(){
  vec3 p = uRot * (aG.xyz / 8.0) - uCam;
  p.z = mod(p.z + uSpan * 0.5, uSpan) - uSpan * 0.5;
  gl_Position = uPV * vec4(p, 1.0);
  float d = max(length(p), 0.05), b = aG.w / 255.0;
  float hh = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5453);
  float px = (0.35 + 1.5 * b) * (0.6 + hh) * uPx / d;
  gl_PointSize = clamp(px, 1.4, 44.0);
  vA = uOn * (0.4 + 0.6 * b) * smoothstep(uSpan * 0.5, uSpan * 0.08, d) * smoothstep(0.1, 1.2, d) * min(1.0, 0.35 + px * 0.5);
  vO = vec2(hh * 6.2832, fract(hh * 7.31)); vS = gl_PointSize;
  vC = mix(vec3(1.0, 0.86, 0.7), vec3(0.75, 0.85, 1.0), fract(hh * 3.7));
}`
  const GX_FS = `#version 300 es
precision mediump float;
in float vA; in vec2 vO; in float vS; in vec3 vC; out vec4 o;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float ca = cos(vO.x), sa = sin(vO.x);
  q = mat2(ca, -sa, sa, ca) * q; q.y /= mix(0.25, 1.0, vO.y);
  float r = length(q); if (r > 1.0) discard;
  float core = exp(-r * r * 30.0);
  float disk = exp(-r * 3.5) * (vS > 8.0 ? 0.75 + 0.25 * sin(atan(q.y, q.x) * 2.0 - r * 9.0) : 1.0);
  o = vec4((vec3(1.0, 0.95, 0.85) * core * 1.6 + vC * disk * 0.8) * vA, 1.0);
}`

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
  const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3)
  function persp(fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2), m = new Float32Array(16)
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f)
    return m
  }
  const view = (r, u, f) => new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, 0, 0, 0, 1])
  function mul(a, b) {
    const o = new Float32Array(16)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s }
    return o
  }
  function toZ(d) {
    const z = norm(d), x = norm(cross([0, 1, 0], z)), y = cross(z, x)
    return new Float32Array([x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]])
  }
  function procedural(n) {
    const a = new Int16Array(n * 4); let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const nodes = Array.from({ length: 60 }, () => [(r() - 0.5) * 500, (r() - 0.5) * 300, (r() - 0.5) * 500])
    for (let i = 0; i < n; i++) {
      const A = nodes[(r() * 60) | 0], B = nodes[(r() * 60) | 0], t = r(), j = r() < 0.5 ? 6 : 25
      a.set([(A[0] + (B[0] - A[0]) * t + (r() - 0.5) * j) * 8, (A[1] + (B[1] - A[1]) * t + (r() - 0.5) * j) * 8, (A[2] + (B[2] - A[2]) * t + (r() - 0.5) * j) * 8, (r() ** 3 * 255) | 0], i * 4)
    }
    return a
  }

  function create(opts) {
    opts = opts || {}
    const base = opts.base ?? ''
    const minDuration = opts.minDuration ?? 5600
    const host = document.createElement('div')
    host.id = opts.id || 'cognia-loader'
    host.setAttribute('role', 'progressbar')
    host.setAttribute('aria-label', (opts.product || 'COGNIA') + ' is loading')
    host.setAttribute('aria-valuemin', '0'); host.setAttribute('aria-valuemax', '100'); host.setAttribute('aria-valuenow', '0')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>${CSS}</style><canvas></canvas><div class="l">${MARK}<span class="w">COGNIA</span>${opts.product ? `<span class="p">${opts.product}</span>` : ''}</div>
<div class="b"><span class="m d">Earth</span><span class="m"><span class="n">000</span> %</span></div><div class="bar"><i></i></div><button type="button">Skip</button>`
    ;(opts.parent || document.body || document.documentElement).appendChild(host)
    const $ = (s) => root.querySelector(s)
    const elN = $('.n'), elBar = $('.bar i'), elD = $('.d'), canvas = $('canvas')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let target = 0, shown = 0, done = null, exitAt = -1, raf = 0, dead = false

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' })
    const P = {}
    let gxCount = 0, stCount = 0, texOn = 0
    if (gl) {
      const prog = (vs, fs, names) => {
        const p = gl.createProgram()
        for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); gl.attachShader(p, sh) }
        gl.linkProgram(p)
        const u = {}; for (const n of names) u[n] = gl.getUniformLocation(p, n)
        return { p, u }
      }
      P.bg = prog(BG_VS, BG_FS, ['uEye', 'uF', 'uR', 'uU', 'uSun', 'uTan', 'uAsp', 'uT', 'uEarthOn', 'uSunOn', 'uSunScr', 'uDay', 'uClouds', 'uTex'])
      P.st = prog(ST_VS, ST_FS, ['uPV', 'uCam', 'uVel', 'uBox', 'uOn'])
      P.gx = prog(GX_VS, GX_FS, ['uPV', 'uRot', 'uCam', 'uPx', 'uOn', 'uSpan'])
      P.bgVao = gl.createVertexArray()
      const N = 9000, pos = new Float32Array(N * 6), col = new Float32Array(N * 8)
      let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      const tint = [[0.62, 0.72, 1.0], [0.85, 0.9, 1.0], [1, 1, 1], [1, 0.9, 0.72], [1, 0.72, 0.45]]
      for (let i = 0; i < N; i++) {
        const p = [(r() - 0.5) * 400, (r() - 0.5) * 400, (r() - 0.5) * 400], c = tint[(r() * r() * 5) | 0], a = 0.25 + r() ** 3 * 1.6
        pos.set(p, i * 6); pos.set(p, i * 6 + 3); col.set([...c, a], i * 8); col.set([...c, a], i * 8 + 4)
      }
      stCount = N * 2
      P.stVao = gl.createVertexArray(); gl.bindVertexArray(P.stVao)
      const b1 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b1); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
      const b2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b2); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0)
      P.gxVao = gl.createVertexArray(); gl.bindVertexArray(P.gxVao)
      const gxBuf = gl.createBuffer()
      const upload = (arr) => { gl.bindVertexArray(P.gxVao); gl.bindBuffer(gl.ARRAY_BUFFER, gxBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gxCount = arr.length / 4 }
      upload(procedural(30000))
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.SHORT, false, 0, 0)
      fetch(base + 'galaxies.bin').then((x) => (x.ok ? x.arrayBuffer() : Promise.reject())).then((b) => { if (!dead) upload(new Int16Array(b)) }).catch(() => {})
      let loaded = 0
      const tex = (unit, url) => {
        const t = gl.createTexture(); const img = new Image()
        img.onload = () => {
          if (dead) return
          gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          if (++loaded === 2) texOn = 1
        }
        img.src = url
      }
      tex(0, base + 'earth_atmos_2048.jpg')
      tex(1, base + 'earth_clouds_1024.png')
      gl.blendFunc(gl.ONE, gl.ONE)
    }

    const SUN = norm([0.95, 0.2, -0.25])
    const GDIR = toZ(norm([-0.84, 0.1, 0.53]))
    let mx = 0, my = 0
    const onMove = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5 }
    addEventListener('pointermove', onMove, { passive: true })
    let travel = 0, last = start, vel = 0

    function frame(now) {
      raf = 0
      if (dead || !host.isConnected) return cleanup()
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const t = reduce ? 1.2 : (now - start) / 1000
      const w = canvas.clientWidth, h = canvas.clientHeight, pr = Math.min(devicePixelRatio || 1, 1.75)
      if (canvas.width !== Math.round(w * pr)) { canvas.width = Math.round(w * pr); canvas.height = Math.round(h * pr) }
      const ex = exitAt < 0 ? 0 : Math.min(1, (now - exitAt) / 1100)
      // pull back from Earth → turn to the Sun → rush through the stars → out among the galaxies
      const back = easeOut(t / 2.6)
      // look at Earth, turn to the Sun and hold it, then turn into the flight
      const a = ease((t - 1.5) / 1.3), b = ease((t - 3.5) / 1.1)
      const g = [-SUN[0] * 0 + SUN[0] * a, SUN[1] * a, -1 + (SUN[2] + 1) * a]
      const f = norm([g[0] * (1 - b) + mx * 0.12, g[1] * (1 - b) - my * 0.08, g[2] * (1 - b) + b])
      const r = norm(cross(f, [0, 1, 0])), u = cross(r, f)
      const warpOn = clamp01((t - 3.9) / 1.2)
      const want = warpOn * (6 + 90 * clamp01((t - 3.9) / 2.2)) * (1 + ex * 4)
      vel += (want - vel) * (1 - Math.exp(-dt * 2.5))
      travel += vel * dt
      const eye = [0.35 * back + f[0] * travel * 0.02, 0.15 + 0.2 * back, 1.32 + 5.5 * back + travel * 0.02]
      const asp = w / h, fov = (50 + warpOn * 14 + ex * 20) * Math.PI / 180, tan = Math.tan(fov / 2)
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.disable(gl.BLEND)
        const pv0 = mul(persp(fov, asp, 0.05, 4000), view(r, u, f))
        const sv = [dot(SUN, r), dot(SUN, u), -dot(SUN, f)]
        const sc = [(sv[0] / -sv[2]) / (tan * asp), (sv[1] / -sv[2]) / tan]
        gl.useProgram(P.bg.p); gl.bindVertexArray(P.bgVao)
        const U = P.bg.u
        gl.uniform3fv(U.uEye, eye); gl.uniform3fv(U.uF, f); gl.uniform3fv(U.uR, r); gl.uniform3fv(U.uU, u); gl.uniform3fv(U.uSun, SUN)
        gl.uniform1f(U.uTan, tan); gl.uniform1f(U.uAsp, asp); gl.uniform1f(U.uT, t)
        gl.uniform1f(U.uEarthOn, 1 - clamp01((t - 4.2) / 1.5)); gl.uniform1f(U.uSunOn, clamp01((t - 1.2) / 1.2) * (1 - 0.7 * warpOn))
        gl.uniform2fv(U.uSunScr, sc); gl.uniform1i(U.uDay, 0); gl.uniform1i(U.uClouds, 1); gl.uniform1f(U.uTex, texOn)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.enable(gl.BLEND)
        gl.useProgram(P.st.p); gl.bindVertexArray(P.stVao)
        gl.uniformMatrix4fv(P.st.u.uPV, false, pv0)
        const streak = Math.max(0.35, Math.min(60, vel * 0.25))
        gl.uniform3fv(P.st.u.uCam, [f[0] * travel, f[1] * travel, f[2] * travel]); gl.uniform3fv(P.st.u.uVel, [f[0] * streak, f[1] * streak, f[2] * streak])
        gl.uniform1f(P.st.u.uBox, 400); gl.uniform1f(P.st.u.uOn, 0.8 + warpOn * 0.6 - clamp01((t - 7) / 3) * 0.6)
        gl.drawArrays(gl.LINES, 0, stCount)
        const gOn = clamp01((t - 5.6) / 1.8)
        if (gOn > 0) {
          gl.useProgram(P.gx.p); gl.bindVertexArray(P.gxVao)
          gl.uniformMatrix4fv(P.gx.u.uPV, false, mul(persp(fov, asp, 0.05, 1600), view(r, u, f)))
          gl.uniformMatrix3fv(P.gx.u.uRot, false, GDIR)
          gl.uniform3fv(P.gx.u.uCam, [0, 0, 60 + travel * 0.35])
          gl.uniform1f(P.gx.u.uPx, (canvas.height / 2) / tan * 0.9); gl.uniform1f(P.gx.u.uOn, gOn * (1 + ex)); gl.uniform1f(P.gx.u.uSpan, 520)
          gl.drawArrays(gl.POINTS, 0, gxCount)
        }
      }
      const elapsed = now - start
      const cap = done ? 1 : Math.min(0.97, target * 0.7 + Math.min(1, elapsed / (minDuration * 1.4)) * 0.3)
      shown += (cap - shown) * 0.08
      const pc = String(Math.floor(shown * 100 + (done && shown > 0.995 ? 1 : 0))).padStart(3, '0')
      if (elN.textContent !== pc) { elN.textContent = pc; host.setAttribute('aria-valuenow', String(+pc)) }
      elBar.style.transform = `scaleX(${shown.toFixed(3)})`
      elD.textContent = t < 1.8 ? 'Earth' : t < 3.9 ? 'The Sun' : t < 5.6 ? 'The Milky Way' : `${Math.round(100 + travel * 0.35 * 3.26)} million light years`
      if (done && exitAt < 0 && elapsed >= minDuration && shown > 0.97) { exitAt = now; host.style.opacity = '0' }
      if (exitAt >= 0 && ex >= 1) return finishNow()
      if (!reduce || exitAt >= 0 || !done) raf = requestAnimationFrame(frame)
    }
    function finishNow() { cleanup(); host.remove(); done && done.resolve() }
    function cleanup() { dead = true; cancelAnimationFrame(raf); removeEventListener('pointermove', onMove) }
    $('button').addEventListener('click', () => { opts.onSkip && opts.onSkip(); api.finish(); exitAt = performance.now(); host.style.opacity = '0' })
    raf = requestAnimationFrame(frame)

    const api = {
      element: host,
      setProgress(x) { target = Math.max(target, Math.min(1, +x || 0)) },
      setStatus(text) { host.setAttribute('aria-label', String(text)) },
      finish() {
        if (!done) { let res; const p = new Promise((r) => (res = r)); done = { resolve: res, promise: p }; if (!raf && !dead) raf = requestAnimationFrame(frame) }
        return done.promise
      },
      destroy() { finishNow() },
    }
    return api
  }

  window.CogniaLoader = { create }
  const me = document.currentScript
  if (me && me.hasAttribute('data-cognia-auto') && document.documentElement.dataset.noLoader == null) {
    const l = create({ product: me.dataset.product, base: me.dataset.base, id: me.dataset.id })
    window.cogniaLoader = l
    if (!me.hasAttribute('data-manual')) addEventListener('load', () => Promise.resolve(window.cogniaReady).then(() => l.finish()))
  }
})()

/* GLSL for the home journey. Monochrome throughout: the grade pass removes any colour the models bring. */

/** Ashima 3D simplex noise + fbm */
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
`

/** Pointer interaction for particles: they part around the cursor in screen space, then drift back. */
export const REPEL = /* glsl */ `
uniform vec2 uMouse;
uniform float uAspect;
uniform float uRepel;
vec4 repel(vec4 clip){
  if (clip.w <= 0.0) return clip;
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uMouse; d.x *= uAspect;
  float l = length(d);
  float f = uRepel * smoothstep(0.34, 0.0, l);
  vec2 dir = l > 1e-4 ? d / l : vec2(0.0);
  // push outwards and swirl a little around the cursor
  vec2 push = (dir * 0.11 + vec2(-dir.y, dir.x) * 0.035) * f;
  push.x /= uAspect;
  clip.xy = (ndc + push) * clip.w;
  return clip;
}
`

export const POINT_FRAG = /* glsl */ `
varying float vA;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = dot(c, c);
  if (r > 1.0) discard;
  float a = exp(-r * 4.0) * vA;
  gl_FragColor = vec4(vec3(1.0), a);
}
`

/** the singularity's glow, the Big Bang flash and the shock ring (a camera-facing quad) */
export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
export const GLOW_FRAG = /* glsl */ `
uniform float uCore; uniform float uHalo; uniform float uRing; uniform float uRingR; uniform float uT;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float core = uCore * exp(-r * r * 900.0) * 6.0;
  float halo = uHalo * (exp(-r * 22.0) * 1.1 + exp(-r * 7.0) * 0.12);
  float a = atan(q.y, q.x);
  float rays = 0.65 + 0.35 * snoise(vec3(cos(a) * 3.0, sin(a) * 3.0, uT * 0.4));
  float ring = uRing * exp(-pow((r - uRingR) * 26.0, 2.0)) * (0.6 + 0.4 * snoise(vec3(q * 6.0, uT)));
  float v = core + halo * rays + ring;
  gl_FragColor = vec4(vec3(v), 1.0);
}
`

/* ── the Sun ── */
export const SUN_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){
  vP = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const SUN_FRAG = /* glsl */ `
uniform float uT; uniform float uBright;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float mu = clamp(dot(normalize(vN), V), 0.0, 1.0);
  float t = uT;
  // supergranulation and the slow churn of the surface
  float big = fbm(vP * 3.2 + vec3(0.0, t * 0.018, t * 0.011));
  // granulation: bright convection cells divided by dark lanes
  float g1 = abs(snoise(vP * 34.0 + vec3(t * 0.06, -t * 0.05, t * 0.04)));
  float g2 = abs(snoise(vP * 71.0 + vec3(-t * 0.09, t * 0.07, 0.0)));
  float lanes = smoothstep(0.0, 0.42, g1) * (0.75 + 0.25 * smoothstep(0.0, 0.5, g2));
  // sunspots: umbra and penumbra
  float sp = fbm(vP * 1.6 + vec3(11.3, 2.1, 7.7));
  float umbra = smoothstep(0.47, 0.56, sp);
  float pen = smoothstep(0.36, 0.47, sp) * (0.6 + 0.4 * snoise(vP * 90.0));
  // faculae: bright patches near the limb
  float fac = smoothstep(0.1, 0.5, big) * pow(1.0 - mu, 2.0) * 0.6;
  float limb = 0.28 + 0.72 * pow(mu, 0.5);
  float I = (0.42 + 0.62 * lanes + 0.26 * big + fac) * limb;
  I *= 1.0 - 0.45 * pen - 0.5 * umbra;
  // bright magnetic veins threading the surface
  float vein = pow(1.0 - abs(snoise(vP * 9.0 + vec3(0.0, t * 0.02, 0.0))), 10.0) * (0.6 + 0.4 * snoise(vP * 30.0));
  vec3 c = mix(vec3(0.75, 0.16, 0.02), vec3(1.0, 0.68, 0.25), clamp(I, 0.0, 1.0)) * I + vec3(1.0, 0.85, 0.5) * vein * limb * 0.9;
  gl_FragColor = vec4(c * uBright, 1.0);
}
`

/** corona: streamers and plumes on a camera-facing quad through the Sun's centre (additive) */
export const CORONA_FRAG = /* glsl */ `
uniform float uT; uniform float uI; uniform float uSpan; uniform float uMouseA; uniform float uLean;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q) * uSpan; // in solar radii
  float a = atan(q.y, q.x);
  vec2 ca = vec2(cos(a), sin(a));
  float n1 = snoise(vec3(ca * 2.2, uT * 0.03 + r * 0.05));
  float n2 = snoise(vec3(ca * 7.0, uT * 0.07 - r * 0.22));
  float n3 = snoise(vec3(ca * 19.0, uT * 0.11 - r * 0.5));
  float n4 = snoise(vec3(ca * 41.0, uT * 0.17 - r * 0.9 + 3.0));
  // feathers: fine strands combed outwards, slowly writhing
  float fe = pow(0.5 + 0.5 * snoise(vec3(ca * 120.0 + n1 * 2.0, r * 0.8 - uT * 0.12)), 7.0) * smoothstep(1.0, 1.6, r) * 1.4;
  float streamers = pow(0.5 + 0.5 * n1, 3.2) * 1.9 + pow(0.5 + 0.5 * n2, 4.0) * 0.9 + pow(0.5 + 0.5 * n3, 5.0) * 0.6 + pow(0.5 + 0.5 * n4, 6.0) * 0.5;
  float fall = pow(1.0 / max(r, 1.0), 2.7);
  float inner = exp(-max(r - 1.0, 0.0) * 9.0) * 1.4; // chromosphere: a bright thin shell at the limb
  float lean = 1.0 + uLean * pow(max(cos(a - uMouseA), 0.0), 10.0) * 1.4;
  float I = (fall * (0.12 + streamers + fe) * lean + inner) * smoothstep(uSpan, uSpan * 0.45, r);
  gl_FragColor = vec4(mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.72, 0.4), smoothstep(1.0, 3.5, r)) * I * uI, 1.0);
}
`

/** prominences: arcs of plasma flowing along magnetic loops (additive tubes) */
export const PROM_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
export const PROM_FRAG = /* glsl */ `
uniform float uT; uniform float uI; uniform float uSeed;
varying vec2 vUv;
${NOISE}
void main(){
  float n = snoise(vec3(vUv.x * 9.0 - uT * 0.35, vUv.y * 3.0, uSeed));
  float m = snoise(vec3(vUv.x * 30.0 - uT * 0.8, vUv.y * 6.0, uSeed + 4.0));
  float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  // plasma flowing along the loop, with bright blasts racing from one footpoint to the other
  float blast = pow(max(sin(vUv.x * 3.14159 * 2.0 - uT * 1.7 + uSeed * 3.0), 0.0), 18.0) * 2.2;
  // feathery strands along the loop
  float strand = pow(0.5 + 0.5 * snoise(vec3(vUv.x * 4.0, vUv.y * 40.0, uSeed + uT * 0.2)), 3.0);
  float v = (pow(0.5 + 0.5 * n, 2.0) * (0.4 + 0.6 * m) * (0.35 + 1.2 * strand) + blast) * ends;
  gl_FragColor = vec4(mix(vec3(1.0, 0.4, 0.08), vec3(1.0, 0.85, 0.5), clamp(v * 0.6, 0.0, 1.0)) * v * uI, 1.0);
}
`

/* ── Earth ── */
export const EARTH_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay; uniform sampler2D uNight; uniform sampler2D uSpec; uniform sampler2D uNormal; uniform sampler2D uClouds;
uniform vec3 uSun; uniform float uCloudOff;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
vec3 perturb(vec3 N, vec3 p, vec2 uv, vec3 mapN){
  vec3 q0 = dFdx(p); vec3 q1 = dFdy(p); vec2 st0 = dFdx(uv); vec2 st1 = dFdy(uv);
  vec3 q1perp = cross(q1, N); vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x; vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B)); float s = det == 0.0 ? 0.0 : inversesqrt(det);
  return normalize(T * (mapN.x * s) + B * (mapN.y * s) + N * mapN.z);
}
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec3 N = normalize(vN);
  vec3 L = normalize(uSun - vW);
  vec3 V = normalize(cameraPosition - vW);
  vec3 mapN = texture2D(uNormal, vUv).xyz * 2.0 - 1.0; mapN.xy *= 1.4;
  vec3 Np = perturb(N, vW, vUv, mapN);
  float ndl = dot(N, L);
  float day = smoothstep(-0.12, 0.3, ndl);
  float relief = clamp(dot(Np, L), 0.0, 1.0);
  vec3 albedo = pow(texture2D(uDay, vUv).rgb, vec3(1.1)) * 0.9;
  float cl = texture2D(uClouds, vUv + vec2(uCloudOff - 0.0035, 0.0012)).b; // cloud shadows
  float spec = 1.0 - texture2D(uSpec, vUv).g; // smooth oceans shine
  vec3 H = normalize(L + V);
  float glint = spec * pow(max(dot(N, H), 0.0), 220.0) * 0.5 * day;
  vec3 col = albedo * (0.15 + 0.85 * relief) * day * (1.0 - 0.45 * cl) + glint * vec3(1.0, 0.92, 0.8);
  // city lights on the night side
  vec3 nightC = texture2D(uNight, vUv).rgb;
  float night = pow(dot(nightC, vec3(0.33)), 1.4) * smoothstep(0.08, -0.2, ndl) * 1.6;
  // a thin haze towards the limb, brightest on the day side
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.35, 0.6, 1.0) * pow(1.0 - max(dot(N, V), 0.0), 1.8) * 0.32 * smoothstep(-0.25, 0.6, ndl);
  gl_FragColor = vec4(col + vec3(1.0, 0.72, 0.38) * night, 1.0);
}
`
export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds; uniform vec3 uSun; uniform float uCloudOff;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 N = normalize(vN);
  vec3 L = normalize(uSun - vW);
  float a = smoothstep(0.05, 0.9, texture2D(uClouds, vUv + vec2(uCloudOff, 0.0)).b);
  float lit = smoothstep(-0.1, 0.45, dot(N, L));
  gl_FragColor = vec4(vec3(0.02 + lit * 0.82), a * 0.88);
}
`
export const ATMO_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec3 vVN;
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vVN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun; uniform float uI;
varying vec3 vN; varying vec3 vW; varying vec3 vVN;
void main(){
  vec3 L = normalize(uSun - vW);
  float k = pow(max(0.74 + dot(normalize(vVN), vec3(0.0, 0.0, 1.0)) * 0.8, 0.0), 1.7) * 0.55;
  float sun = smoothstep(-0.35, 0.5, dot(normalize(vN), L));
  gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * k * sun * uI, 1.0);
}
`

/* ── particle systems ── */

/** stars on the far sky: twinkle and a slow drift */
export const STARS_VERT = /* glsl */ `
attribute float aSize; attribute float aSeed;
uniform float uT; uniform float uPR; uniform float uOn;
varying float vA;
${REPEL}
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  gl_Position = repel(clip);
  float tw = 0.65 + 0.35 * sin(uT * (0.6 + aSeed * 2.4) + aSeed * 40.0);
  gl_PointSize = aSize * uPR;
  vA = uOn * tw * (0.25 + 0.75 * aSeed);
}
`

/** The universe: from the singularity, a burst that settles into the cosmic web (clusters and filaments). */
export const COSMOS_VERT = /* glsl */ `
attribute vec3 aDir; attribute vec3 aWeb; attribute float aSeed; attribute float aClump;
uniform float uE;      // expansion 0..1
uniform float uT; uniform float uPR; uniform float uScale; uniform float uOn; uniform float uR;
varying float vA;
${REPEL}
void main(){
  float e = uE;
  float burst = 1.0 - pow(1.0 - clamp(e * 1.6, 0.0, 1.0), 3.0);
  vec3 radial = aDir * uR * (0.25 + aSeed) * burst;
  float settle = smoothstep(0.18, 0.95, e);
  vec3 p = mix(radial, aWeb * (0.55 + 0.45 * e), settle);
  // before the bang: a quivering foam packed into the singularity
  if (e <= 0.0) p = aDir * (6.0 + 10.0 * aSeed) * (1.0 + 0.25 * sin(uT * 3.0 + aSeed * 60.0));
  // idle drift: clusters slowly churn
  p += vec3(sin(uT * 0.13 + aSeed * 31.0), cos(uT * 0.11 + aSeed * 17.0), sin(uT * 0.09 + aSeed * 7.0)) * 120.0 * settle;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = repel(projectionMatrix * mv);
  float hot = 1.0 - smoothstep(0.0, 0.5, e); // it cools as it expands
  float size = mix(50.0, 40.0 + aClump * 170.0, settle) * (1.0 + hot * 1.5);
  float px = size * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px, 0.0, 9.0) * uPR;
  vA = uOn * smoothstep(0.0, 1.2, px) * mix(0.32, 0.05 + aClump * 0.38, settle) * (e <= 0.0 ? 0.25 : 1.0);
}
`

/** our galaxy: a barred spiral of ~100k stars and dust lanes, turning slowly */
export const GALAXY_VERT = /* glsl */ `
attribute float aR; attribute float aA; attribute float aY; attribute float aSeed; attribute float aB;
uniform float uT; uniform float uPR; uniform float uScale; uniform float uOn;
varying float vA;
${REPEL}
void main(){
  float ang = aA + uT * 0.006 * (4000.0 / (aR + 600.0));
  vec3 p = vec3(cos(ang) * aR, aY, sin(ang) * aR);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = repel(projectionMatrix * mv);
  float px = (10.0 + aB * 26.0) * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px, 0.0, 2.6) * uPR;
  vA = uOn * smoothstep(0.0, 1.0, px) * (0.12 + aB * 0.6) * (0.7 + 0.3 * sin(uT * (1.0 + aSeed * 3.0) + aSeed * 50.0));
}
`

/** solar wind: particles streaming out from the Sun (they rush past the camera in the corona) */
export const WIND_VERT = /* glsl */ `
attribute vec3 aDir; attribute float aSeed;
uniform float uT; uniform float uPR; uniform float uScale; uniform float uOn; uniform float uR0; uniform float uLen;
varying float vA;
${REPEL}
void main(){
  float d = mod(aSeed * uLen + uT * (2.0 + aSeed * 5.0), uLen);
  vec3 p = aDir * (uR0 + d);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = repel(projectionMatrix * mv);
  float px = 0.5 * uScale / max(-mv.z, 0.5);
  gl_PointSize = clamp(px, 0.0, 6.0) * uPR;
  vA = uOn * smoothstep(0.0, 1.0, px) * (1.0 - d / uLen) * 0.8;
}
`

/** matter spiralling into the wormhole (in the plane of the COGNIA circle) */
export const SWIRL_VERT = /* glsl */ `
attribute float aR0; attribute float aA0; attribute float aSeed;
uniform float uT; uniform float uPR; uniform float uScale; uniform float uOn; uniform float uIn; uniform float uOut; uniform float uSpin;
varying float vA;
${REPEL}
void main(){
  float life = fract(aSeed + uT * 0.05 * (0.6 + aSeed));
  float r = mix(aR0, uIn, pow(life, 1.6));
  float ang = aA0 + uSpin * 1.6 / pow(max(r / uIn, 0.4), 1.5);
  vec3 p = vec3(cos(ang) * r, sin(ang) * r, (aSeed - 0.5) * 0.12 * r / uOut);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = repel(projectionMatrix * mv);
  float px = 0.07 * uScale / max(-mv.z, 0.3);
  gl_PointSize = clamp(px, 0.0, 3.5) * uPR;
  float bright = (uIn / r) * smoothstep(1.0, 0.85, life) * smoothstep(0.0, 0.1, life);
  vA = uOn * smoothstep(0.0, 1.0, px) * bright * 1.2;
}
`

/** light streaks inside the wormhole, flowing past the camera */
export const WARP_VERT = /* glsl */ `
attribute float aEnd; attribute float aSeed; attribute vec2 aXY;
uniform float uFlow; uniform float uLen; uniform float uStretch;
varying float vA;
void main(){
  float z = -mod(aSeed * uLen + uFlow * (0.7 + aSeed * 0.6), uLen);
  z += aEnd * uStretch * (0.5 + aSeed);
  vec3 p = vec3(aXY, z);
  vA = (1.0 - aEnd * 0.9) * smoothstep(-uLen, -uLen * 0.6, z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
export const WARP_FRAG = /* glsl */ `
uniform float uOn;
varying float vA;
void main(){ gl_FragColor = vec4(vec3(1.0), vA * uOn); }
`

/** final grade: monochrome, flash, vignette, film grain, fade to black */
export const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uFlash: { value: 0 },
    uFade: { value: 0 },
    uT: { value: 0 },
    uVig: { value: 0.35 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uFlash; uniform float uFade; uniform float uT; uniform float uVig;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  vec3 l = c;
  vec2 q = vUv - 0.5;
  l *= 1.0 - uVig * dot(q, q) * 2.2;
  l += (hash(vUv * 1024.0 + fract(uT * 7.0)) - 0.5) * 0.028;
  l = mix(l, vec3(1.0), uFlash);
  l *= 1.0 - uFade;
  gl_FragColor = vec4(max(l, vec3(0.0)), 1.0);
}
`,
}

/* ── planets and moons: procedural surfaces lit by the Sun ── */
export const PLANET_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){
  vP = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const PLANET_FRAG = /* glsl */ `
uniform vec3 uSun; uniform vec3 uC1; uniform vec3 uC2; uniform float uType; uniform float uSeed; uniform float uT; uniform float uR;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){
  vec3 n = normalize(vP);
  vec3 col;
  if (uType < 0.5) {            // rocky: mottled with craters and maria
    float f = fbm(n * 3.0 + uSeed);
    float c = smoothstep(0.55, 0.6, abs(snoise(n * 9.0 + uSeed))) * 0.25;
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, f)) * (1.0 - c);
  } else if (uType < 1.5) {     // gas giant: turbulent bands and a storm
    float lat = n.y;
    float w = fbm(vec3(n.x * 2.0, lat * 9.0, n.z * 2.0) + vec3(uT * 0.01, 0.0, uSeed));
    float b = sin(lat * 22.0 + w * 3.0) * 0.5 + 0.5;
    col = mix(uC1, uC2, b) * (0.85 + 0.25 * snoise(n * 18.0 + uSeed));
    float storm = smoothstep(0.16, 0.0, length(vec2(atan(n.z, n.x) - 1.0 - uT * 0.004, (lat + 0.35) * 2.6)));
    col = mix(col, uC2 * 1.25, storm * 0.8);
  } else {                      // ice giant / clouded: soft, nearly featureless
    float f = fbm(vec3(n.x, n.y * 4.0, n.z) * 2.0 + uSeed);
    col = mix(uC1, uC2, 0.5 + 0.5 * f);
  }
  vec3 N = normalize(vN);
  vec3 L = normalize(uSun - vW);
  vec3 V = normalize(cameraPosition - vW);
  float lit = max(dot(N, L), 0.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(-0.2, 0.5, dot(N, L));
  gl_FragColor = vec4(col * (0.015 + 1.1 * lit) + uC1 * rim * (uType > 0.5 ? 0.35 : 0.08), 1.0);
}
`
export const RING_FRAG = /* glsl */ `
uniform vec3 uSun; uniform float uIn; uniform float uOut;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){
  float r = length(vP.xy);
  float x = (r - uIn) / (uOut - uIn);
  if (x < 0.0 || x > 1.0) discard;
  float bands = 0.55 + 0.45 * sin(x * 140.0 + snoise(vec3(x * 30.0, 0.0, 1.0)) * 3.0);
  float gap = 1.0 - smoothstep(0.0, 0.02, 0.025 - abs(x - 0.62)); // the Cassini division
  float a = bands * gap * smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.9, x) * 0.85;
  float lit = 0.35 + 0.65 * abs(dot(normalize(vN), normalize(uSun - vW)));
  gl_FragColor = vec4(vec3(0.86, 0.78, 0.64) * lit, a);
}
`
/** the Van Allen belts: charged particles trapped in two tori around Earth's magnetic axis */
export const BELT_VERT = /* glsl */ `
attribute float aR; attribute float aA; attribute float aB; attribute float aSeed;
uniform float uT; uniform float uPR; uniform float uScale; uniform float uOn;
varying float vA;
${REPEL}
void main(){
  float a = aA + uT * (0.05 + aSeed * 0.08);
  float tube = aR * 0.28;
  vec3 p = vec3((aR + cos(aB) * tube) * cos(a), sin(aB) * tube * 1.6, (aR + cos(aB) * tube) * sin(a));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = repel(projectionMatrix * mv);
  float px = 0.05 * uScale / max(-mv.z, 0.3);
  gl_PointSize = clamp(px, 0.0, 3.0) * uPR;
  vA = uOn * smoothstep(0.0, 1.0, px) * (0.25 + 0.5 * aSeed);
}
`
export const BELT_FRAG = /* glsl */ `
varying float vA;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = dot(c, c);
  if (r > 1.0) discard;
  gl_FragColor = vec4(vec3(0.45, 0.72, 1.0), exp(-r * 4.0) * vA);
}
`

/** the arrival beyond the wormhole: particles rushing in from everywhere to build a colossal COGNIA mark */
export const FORM_VERT = /* glsl */ `
attribute vec3 aStart; attribute vec3 aEnd; attribute float aSeed;
uniform float uForm; uniform float uT; uniform float uPR; uniform float uScale; uniform float uOn;
varying float vA; varying vec3 vC;
${REPEL}
void main(){
  float k = clamp((uForm - aSeed * 0.35) / 0.65, 0.0, 1.0);
  k = 1.0 - pow(1.0 - k, 3.0);
  vec3 p = mix(aStart, aEnd, k);
  // a spiral path on the way in, and a slow shimmer once in place
  float sw = (1.0 - k) * 6.0;
  p.xy = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * p.xy;
  p += vec3(sin(uT * 1.3 + aSeed * 40.0), cos(uT * 1.1 + aSeed * 23.0), sin(uT * 0.9 + aSeed * 11.0)) * (0.25 + 2.0 * (1.0 - k));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = repel(projectionMatrix * mv);
  float px = (0.5 + aSeed) * 0.55 * uScale / max(-mv.z, 0.5);
  gl_PointSize = clamp(px, 1.0, 4.0) * uPR;
  vA = uOn * smoothstep(0.0, 1.0, px) * (0.2 + 0.5 * k);
  // cyan → violet → gold across the mark
  vC = mix(mix(vec3(0.35, 0.85, 1.0), vec3(0.7, 0.45, 1.0), smoothstep(-40.0, 10.0, aEnd.x)), vec3(1.0, 0.78, 0.4), smoothstep(0.85, 1.0, fract(aSeed * 7.13)));
}
`
export const FORM_FRAG = /* glsl */ `
varying float vA; varying vec3 vC;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = dot(c, c);
  if (r > 1.0) discard;
  gl_FragColor = vec4(vC * (exp(-r * 4.0) * 1.6) * vA, 1.0);
}
`

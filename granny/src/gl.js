/* ------------------------------------------------------------------ *
 *  gl.js — the thin layer over WebGL: matrix maths, shader programs,
 *  buffers and textures. No libraries; GLSL ES 1.00 so it runs on a
 *  WebGL1 context just as happily as a WebGL2 one.
 * ------------------------------------------------------------------ */
'use strict';

/* ------------------------------------------------------------------ *
 *  4x4 matrices (column-major, the order WebGL wants)
 * ------------------------------------------------------------------ */
const M4 = {
  create() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },

  identity(o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  },

  multiply(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
          a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
          a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
          a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },

  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    M4.identity(o);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf;
    o[11] = -1; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  },

  /** Camera at `eye` looking down yaw/pitch, as a view matrix. */
  fpsView(o, ex, ey, ez, yaw, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // forward, right and up of the camera basis
    const fx = cp * cy, fy = sp, fz = cp * sy;
    const rx = -sy, ry = 0, rz = cy;
    const ux = -sp * cy, uy = cp, uz = -sp * sy;
    o[0] = rx; o[1] = ux; o[2] = -fx; o[3] = 0;
    o[4] = ry; o[5] = uy; o[6] = -fy; o[7] = 0;
    o[8] = rz; o[9] = uz; o[10] = -fz; o[11] = 0;
    o[12] = -(rx * ex + ry * ey + rz * ez);
    o[13] = -(ux * ex + uy * ey + uz * ez);
    o[14] = fx * ex + fy * ey + fz * ez;
    o[15] = 1;
    return o;
  },

  translation(o, x, y, z) {
    M4.identity(o);
    o[12] = x; o[13] = y; o[14] = z;
    return o;
  },

  rotationY(o, a) {
    const c = Math.cos(a), s = Math.sin(a);
    M4.identity(o);
    o[0] = c; o[2] = -s; o[8] = s; o[10] = c;
    return o;
  },

  rotationX(o, a) {
    const c = Math.cos(a), s = Math.sin(a);
    M4.identity(o);
    o[5] = c; o[6] = s; o[9] = -s; o[10] = c;
    return o;
  },

  rotationZ(o, a) {
    const c = Math.cos(a), s = Math.sin(a);
    M4.identity(o);
    o[0] = c; o[1] = s; o[4] = -s; o[5] = c;
    return o;
  },

  scaling(o, x, y, z) {
    M4.identity(o);
    o[0] = x; o[5] = y; o[10] = z;
    return o;
  },

  /** Convenience: T * Ry * S, the transform almost every object wants. */
  trs(o, x, y, z, yaw, sx, sy, sz) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    o[0] = c * sx; o[1] = 0; o[2] = -s * sx; o[3] = 0;
    o[4] = 0; o[5] = sy; o[6] = 0; o[7] = 0;
    o[8] = s * sz; o[9] = 0; o[10] = c * sz; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  },

  transformPoint(m, x, y, z, out) {
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
  },
};

/* ------------------------------------------------------------------ *
 *  shaders
 * ------------------------------------------------------------------ */

const MAX_LIGHTS = 6;

const VERT_SRC = `
precision highp float;
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec4 aColor;      // rgb tint, a = baked ambient occlusion

uniform mat4 uProj, uView, uModel;

varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUV;
varying vec4 vColor;

void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vPos = world.xyz;
  // models never use non-uniform scale, so the upper 3x3 is fine as-is
  vNormal = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uProj * uView * world;
}`;

const FRAG_SRC = `
precision highp float;

varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUV;
varying vec4 vColor;

uniform sampler2D uTex;
uniform float uUseTex;

uniform vec3  uCamPos;
uniform vec3  uTorchDir;
uniform float uTorchOn;
uniform float uTorchPower;
uniform float uCosInner, uCosOuter;

uniform vec3  uAmbient;      // sky-ish ambient
uniform vec3  uGround;       // bounce colour from below
uniform float uFogDensity;
uniform vec3  uFogColor;

uniform int   uLightCount;
uniform vec3  uLightPos[${MAX_LIGHTS}];
uniform vec3  uLightColor[${MAX_LIGHTS}];
uniform float uLightRange[${MAX_LIGHTS}];

uniform float uRim;          // characters get a cold edge light
uniform float uEmissive;     // items glint so you can find them

void main() {
  vec4 base = vColor;
  if (uUseTex > 0.5) base *= texture2D(uTex, vUV);

  vec3 N = normalize(vNormal);
  vec3 toCam = uCamPos - vPos;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 0.0001);

  /* hemispheric ambient, modulated by baked AO */
  float hemi = 0.5 + 0.5 * N.y;
  vec3 light = mix(uGround, uAmbient, hemi) * vColor.a;

  /* the torch: a spotlight riding on the camera, plus the spill around it */
  float ndl = max(dot(N, V), 0.0);
  float spot = smoothstep(uCosOuter, uCosInner, dot(-V, uTorchDir));
  float atten = 1.0 / (1.0 + 0.16 * dist + 0.085 * dist * dist);
  vec3 beam = vec3(1.0, 0.95, 0.84);
  light += beam * (uTorchOn * uTorchPower * spot * atten * (0.12 + 0.88 * ndl));
  // spill: unconstrained by the cone but dying off fast, so the floor at your
  // feet and the item in your hand are never pitch black
  light += beam * (uTorchOn * uTorchPower * 0.55 * ndl / (1.0 + dist * dist * 0.95));

  /* and a trace of light even with the torch off */
  light += vec3(0.4, 0.42, 0.5) * (0.06 * ndl / (1.0 + dist * dist * 0.8));

  /* static lights: windows, the boiler, a bare bulb */
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec3 d = uLightPos[i] - vPos;
    float dl = length(d);
    float a = max(0.0, 1.0 - dl / uLightRange[i]);
    light += uLightColor[i] * a * a * (0.3 + 0.7 * max(dot(N, d / max(dl, 0.001)), 0.0));
  }

  vec3 col = base.rgb * light;

  /* rim light keeps her readable when she is almost on top of you */
  if (uRim > 0.0) {
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    col += vec3(0.30, 0.33, 0.42) * rim * uRim;
  }
  col += base.rgb * uEmissive;

  float fog = exp(-uFogDensity * dist * dist);
  col = mix(uFogColor, col, clamp(fog, 0.0, 1.0));

  gl_FragColor = vec4(col, base.a);
}`;

/* ------------------------------------------------------------------ *
 *  context wrapper
 * ------------------------------------------------------------------ */

const GL = {
  gl: null,
  canvas: null,
  program: null,
  loc: {},
  dpr: 1,

  init(canvas) {
    this.canvas = canvas;
    const opts = { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl) return false;
    this.gl = gl;

    this.program = this.buildProgram(VERT_SRC, FRAG_SRC);
    if (!this.program) return false;
    gl.useProgram(this.program);

    const names = ['uProj', 'uView', 'uModel', 'uTex', 'uUseTex', 'uCamPos', 'uTorchDir',
      'uTorchOn', 'uTorchPower', 'uCosInner', 'uCosOuter', 'uAmbient', 'uGround',
      'uFogDensity', 'uFogColor', 'uLightCount', 'uRim', 'uEmissive'];
    names.forEach(n => { this.loc[n] = gl.getUniformLocation(this.program, n); });
    for (let i = 0; i < MAX_LIGHTS; i++) {
      this.loc['uLightPos' + i] = gl.getUniformLocation(this.program, `uLightPos[${i}]`);
      this.loc['uLightColor' + i] = gl.getUniformLocation(this.program, `uLightColor[${i}]`);
      this.loc['uLightRange' + i] = gl.getUniformLocation(this.program, `uLightRange[${i}]`);
    }
    this.attr = {
      pos: gl.getAttribLocation(this.program, 'aPos'),
      normal: gl.getAttribLocation(this.program, 'aNormal'),
      uv: gl.getAttribLocation(this.program, 'aUV'),
      color: gl.getAttribLocation(this.program, 'aColor'),
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 1);
    return true;
  },

  buildProgram(vsrc, fsrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('shader:', gl.getShaderInfoLog(s), src);
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vsrc), fs = compile(gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('link:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  },

  resize() {
    const c = this.canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.floor(window.innerWidth * this.dpr);
    const h = Math.floor(window.innerHeight * this.dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
    }
    this.gl.viewport(0, 0, c.width, c.height);
    return c.width / c.height;
  },

  /** Upload one of the procedural 64x64 buffers as a repeating texture. */
  makeTexture(buf) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const pixels = new Uint8Array(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, buf.w, buf.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
    return t;
  },
};

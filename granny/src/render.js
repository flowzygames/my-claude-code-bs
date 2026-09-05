/* ------------------------------------------------------------------ *
 *  render.js — draws a frame.
 *
 *  Static level geometry goes out in one call per surface texture, then
 *  the door leaves, then everything made of flat-shaded primitives
 *  (furniture, items, granny), then contact shadows, then the thing in
 *  your hands. All lit by one spotlight riding on the camera.
 * ------------------------------------------------------------------ */
'use strict';

const Render = {
  ready: false,
  tex: {},                 // tile id -> GL texture
  proj: M4.create(),
  view: M4.create(),
  model: M4.create(),
  _tmp: M4.create(),
  fov: 1.15,
  torchSway: { yaw: 0, pitch: 0 },

  init(canvas) {
    if (!GL.init(canvas)) return false;
    const gl = GL.gl;

    TEX.forEach((buf, tile) => { if (buf) this.tex[tile] = GL.makeTexture(buf); });
    Models.build(gl);

    gl.uniform1i(GL.loc.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    this.ready = true;
    return true;
  },

  buildWorld(levels) { World.buildAll(GL.gl, levels); },

  /* --------------------------------------------------------------- *
   *  one frame
   * --------------------------------------------------------------- */
  frame(cam, level, scene, light, dt) {
    const gl = GL.gl;
    const aspect = GL.resize();

    /* the torch lags a little behind the look direction */
    const sway = this.torchSway;
    sway.yaw += U.angleDiff(sway.yaw, cam.yaw) * Math.min(1, (dt || 0.016) * 7);
    sway.pitch += (cam.pitch - sway.pitch) * Math.min(1, (dt || 0.016) * 7);

    M4.perspective(this.proj, this.fov, aspect, 0.02, 60);
    M4.fpsView(this.view, cam.x, cam.y, cam.z, cam.yaw, cam.pitch);

    const fogR = 0.016, fogG = 0.015, fogB = 0.018;
    gl.clearColor(fogR, fogG, fogB, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    const L = GL.loc;
    gl.uniformMatrix4fv(L.uProj, false, this.proj);
    gl.uniformMatrix4fv(L.uView, false, this.view);
    gl.uniform3f(L.uCamPos, cam.x, cam.y, cam.z);

    const cp = Math.cos(sway.pitch);
    gl.uniform3f(L.uTorchDir, cp * Math.cos(sway.yaw), Math.sin(sway.pitch), cp * Math.sin(sway.yaw));
    gl.uniform1f(L.uTorchOn, light.on ? 1 : 0);
    gl.uniform1f(L.uTorchPower, light.power * light.flicker);
    gl.uniform1f(L.uCosInner, Math.cos(0.55));
    gl.uniform1f(L.uCosOuter, Math.cos(1.25));

    const amb = level.ambient * light.ambientMul;
    gl.uniform3f(L.uAmbient, amb * 2.3, amb * 2.2, amb * 2.6);
    gl.uniform3f(L.uGround, amb * 1.1, amb * 0.98, amb * 0.9);
    gl.uniform1f(L.uFogDensity, 1 / (level.fog * level.fog));
    gl.uniform3f(L.uFogColor, fogR, fogG, fogB);
    gl.uniform1f(L.uRim, 0);
    gl.uniform1f(L.uEmissive, 0);

    this._setLights(level, cam);

    /* ---- static geometry ---- */
    gl.uniform1f(L.uUseTex, 1);
    M4.identity(this.model);
    gl.uniformMatrix4fv(L.uModel, false, this.model);
    for (const g of level.geo) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex[g.tile] || this.tex[T.BRICK]);
      drawMesh(gl, g.mesh);
    }

    /* ---- door leaves ---- */
    gl.bindTexture(gl.TEXTURE_2D, this.tex[T.DOOR]);
    const leaf = Models.get('doorleaf');
    for (const d of level.doors) {
      M4.trs(this.model, d.hingeX, 0, d.hingeZ, d.baseYaw + d.swing * d.anim, 1, 1, 1);
      gl.uniformMatrix4fv(L.uModel, false, this.model);
      drawMesh(gl, leaf);
    }

    /* ---- flat-shaded objects ----
       Culling off from here on: the player hides *inside* the furniture, and
       seeing the back of a wardrobe door from within is the whole point. */
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(L.uUseTex, 0);
    for (const o of scene) {
      if (o.parts) continue;
      gl.uniform1f(L.uEmissive, o.emissive || 0);
      // Props are modelled facing +Z (a wardrobe's doors, a clock's face), so
      // this maps the object's game-space `yaw` onto that axis. Granny and the
      // door leaves are modelled facing +X and set their own matrices.
      M4.trs(this.model, o.x, o.y || 0, o.z, Math.PI / 2 - (o.yaw || 0),
             o.s || 1, o.s || 1, o.s || 1);
      gl.uniformMatrix4fv(L.uModel, false, this.model);
      drawMesh(gl, Models.get(o.model));
    }
    gl.uniform1f(L.uEmissive, 0);

    /* ---- characters (posed part hierarchies) ---- */
    for (const o of scene) {
      if (!o.parts) continue;
      gl.uniform1f(L.uRim, o.rim === undefined ? 0.75 : o.rim);
      for (const part of o.parts) {
        gl.uniformMatrix4fv(L.uModel, false, part.mat);
        drawMesh(gl, part.mesh);
      }
      gl.uniform1f(L.uRim, 0);
    }

    /* ---- contact shadows ---- */
    this._shadows(gl, scene);

    /* ---- the item in your hands ---- */
    if (light.held) this._viewmodel(gl, cam, light.held, light.heldBob, light.heldFire, light.heldScale);
    gl.enable(gl.CULL_FACE);
  },

  /** The six point lights nearest the camera win. */
  _setLights(level, cam) {
    const gl = GL.gl, L = GL.loc;
    const lights = level.lights || [];
    let list = lights;
    if (lights.length > MAX_LIGHTS) {
      const key = l => (l.x - cam.x) * (l.x - cam.x) + (l.y - cam.y) * (l.y - cam.y)
                     + (l.z - cam.z) * (l.z - cam.z);
      list = lights.slice().sort((a, b) => key(a) - key(b)).slice(0, MAX_LIGHTS);
    }
    gl.uniform1i(L.uLightCount, list.length);
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      gl.uniform3f(L['uLightPos' + i], l.x, l.y, l.z);
      gl.uniform3f(L['uLightColor' + i], l.r, l.g, l.b);
      gl.uniform1f(L['uLightRange' + i], l.range);
    }
  },

  _shadows(gl, scene) {
    const L = GL.loc;
    const blob = Models.get('blob');
    if (!blob) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(L.uUseTex, 0);
    for (const o of scene) {
      if (!o.shadow) continue;
      M4.trs(this.model, o.x, 0.014, o.z, 0, o.shadow, 1, o.shadow);
      gl.uniformMatrix4fv(L.uModel, false, this.model);
      drawMesh(gl, blob);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  },

  /**
   * Held item: parented to the camera basis rather than drawn in a second
   * pass, so it lights and fogs exactly like the rest of the world.
   */
  _viewmodel(gl, cam, modelName, bob, firing, heldScale) {
    const mesh = Models.get(modelName);
    if (!mesh) return;
    const L = GL.loc;

    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const fx = cp * cy, fy = sp, fz = cp * sy;
    const rx = -sy, rz = cy;
    const ux = -sp * cy, uy = cp, uz = -sp * sy;

    /* Anything this close to the near plane looks enormous, so the held item
       is both pushed out and scaled down until it reads as "in your hand"
       rather than "in your eye". */
    const scale = heldScale || 0.7;
    const swayX = Math.sin(bob) * 0.012;
    const swayY = Math.abs(Math.cos(bob)) * 0.014 - (firing ? 0.04 : 0);
    const fwd = 0.52 - (firing ? 0.06 : 0);
    const right = 0.25 + swayX;
    const up = -0.23 + swayY;

    const px = cam.x + fx * fwd + rx * right + ux * up;
    const py = cam.y + fy * fwd + uy * up;
    const pz = cam.z + fz * fwd + rz * right + uz * up;

    // held across the view at an angle, rather than pointing down its own
    // axis at the camera, which just reads as a circle
    M4.trs(this.model, px, py, pz, -(cam.yaw - 0.75), scale, scale, scale);
    M4.multiply(this.model, this.model, M4.rotationZ(this._tmp, 0.32 + cam.pitch * 0.4));
    gl.uniform1f(L.uUseTex, 0);
    gl.uniform1f(L.uEmissive, 0.03);
    gl.uniformMatrix4fv(L.uModel, false, this.model);
    drawMesh(gl, mesh);
    gl.uniform1f(L.uEmissive, 0);
  },
};

/* ------------------------------------------------------------------ *
 *  models.js — everything in the house that isn't a wall.
 *
 *  Each model is built once at start-up from primitives, centred on its
 *  own footprint and resting on y = 0, facing +X. Granny is built as
 *  separate limb meshes pivoted at their joints so she can be posed.
 * ------------------------------------------------------------------ */
'use strict';

/* palette ------------------------------------------------------------ */
const C = {
  wood: '#5b3e23', woodDark: '#37240f', woodLight: '#795426',
  metal: '#666c72', metalDark: '#34383c', brass: '#9c7530',
  fabric: '#463f34', fabricDark: '#2e2a23',
  white: '#9a958a', pale: '#78827f',
  skin: '#c2a184', hair: '#ded8cc',
  dress: '#63615a', dressDark: '#46443f', cardigan: '#4d5348',
  rust: '#7a4526', blood: '#4d1210',
  paper: '#cfc7ae', glass: '#5d6b70',
};

const Models = {
  mesh: {},          // name -> built GL mesh
  meta: {},          // name -> { radius, height }

  build(gl) {
    const defs = this.defs();
    Object.keys(defs).forEach(name => {
      const b = new MeshBuilder();
      defs[name](b);
      this.mesh[name] = b.build(gl);
    });
    this.buildGranny(gl);
  },

  get(name) { return this.mesh[name]; },

  /* --------------------------------------------------------------- *
   *  props and items
   * --------------------------------------------------------------- */
  defs() {
    return {

      /* ---------------------------- furniture ------------------- */

      wardrobe(b) {
        const w = 0.86, d = 0.52, h = 1.38;
        b.color(C.woodDark);
        b.push(); b.translate(0, 0, 0);
        // carcass, open at the front so the inside is visible when you hide
        b.push(); b.translate(0, h / 2, -d / 2 + 0.03); b.box(w, h, 0.06); b.pop();
        b.push(); b.translate(-w / 2 + 0.03, h / 2, 0); b.box(0.06, h, d); b.pop();
        b.push(); b.translate(w / 2 - 0.03, h / 2, 0); b.box(0.06, h, d); b.pop();
        b.push(); b.translate(0, h - 0.03, 0); b.box(w, 0.06, d); b.pop();
        b.push(); b.translate(0, 0.05, 0); b.box(w, 0.1, d); b.pop();
        b.color(C.wood);
        b.push(); b.translate(0, h + 0.04, 0); b.box(w + 0.08, 0.08, d + 0.06); b.pop();
        // two doors, left slightly ajar with a slit between them to peer through
        b.push(); b.translate(-w / 4 - 0.01, h / 2 + 0.05, d / 2 - 0.02); b.box(w / 2 - 0.04, h - 0.14, 0.04); b.pop();
        b.push(); b.translate(w / 4 + 0.01, h / 2 + 0.05, d / 2 - 0.02); b.box(w / 2 - 0.04, h - 0.14, 0.04); b.pop();
        b.color(C.brass);
        b.push(); b.translate(-0.05, h * 0.52, d / 2 + 0.02); b.sphere(0.022, 8, 6); b.pop();
        b.push(); b.translate(0.05, h * 0.52, d / 2 + 0.02); b.sphere(0.022, 8, 6); b.pop();
        b.pop();
      },

      bed(b) {
        const w = 1.22, d = 0.76;
        // built lengthwise along X, then turned so the headboard is at -Z and
        // `face` points from the pillow towards the foot of the bed
        b.push(); b.rotateY(-Math.PI / 2);
        b.color(C.woodDark);
        // legs leave a gap you can crawl into
        [[-w / 2 + .06, -d / 2 + .06], [w / 2 - .06, -d / 2 + .06],
         [-w / 2 + .06, d / 2 - .06], [w / 2 - .06, d / 2 - .06]].forEach(p => {
          b.push(); b.translate(p[0], 0.11, p[1]); b.box(0.09, 0.22, 0.09); b.pop();
        });
        b.push(); b.translate(0, 0.26, 0); b.box(w, 0.09, d); b.pop();
        b.color(C.wood);
        b.push(); b.translate(-w / 2 + 0.03, 0.55, 0); b.box(0.07, 0.6, d); b.pop();
        b.color(C.fabric);
        b.push(); b.translate(0.02, 0.38, 0); b.box(w - 0.1, 0.16, d - 0.08); b.pop();
        b.color(C.white);
        b.push(); b.translate(-w / 2 + 0.2, 0.49, 0); b.box(0.26, 0.09, 0.4); b.pop();
        b.color(C.fabricDark);
        b.push(); b.translate(0.22, 0.47, 0); b.box(w - 0.55, 0.03, d - 0.06); b.pop();
        b.pop();
      },

      sofa(b) {
        const w = 1.35, d = 0.7;
        b.color(C.fabric);
        b.push(); b.translate(0, 0.22, 0); b.box(w, 0.44, d); b.pop();
        b.push(); b.translate(0, 0.55, -d / 2 + 0.12); b.box(w, 0.45, 0.24); b.pop();
        b.push(); b.translate(-w / 2 + 0.1, 0.5, 0); b.box(0.2, 0.3, d); b.pop();
        b.push(); b.translate(w / 2 - 0.1, 0.5, 0); b.box(0.2, 0.3, d); b.pop();
        b.color(C.fabricDark);
        b.push(); b.translate(-0.3, 0.46, 0.05); b.box(0.42, 0.08, d - 0.2); b.pop();
        b.push(); b.translate(0.3, 0.46, 0.05); b.box(0.42, 0.08, d - 0.2); b.pop();
        b.color(C.woodDark);
        [[-w / 2 + .1, -d / 2 + .1], [w / 2 - .1, -d / 2 + .1], [-w / 2 + .1, d / 2 - .1], [w / 2 - .1, d / 2 - .1]]
          .forEach(p => { b.push(); b.translate(p[0], 0.04, p[1]); b.box(0.07, 0.08, 0.07); b.pop(); });
      },

      armchair(b) {
        b.push(); b.rotateY(-Math.PI / 2);      // back to -Z, like every other seat
        b.color(C.fabric);
        b.push(); b.translate(0, 0.24, 0); b.box(0.62, 0.42, 0.62); b.pop();
        b.push(); b.translate(-0.22, 0.55, 0); b.box(0.18, 0.44, 0.62); b.pop();
        b.push(); b.translate(0.2, 0.48, -0.22); b.box(0.24, 0.3, 0.18); b.pop();
        b.push(); b.translate(0.2, 0.48, 0.22); b.box(0.24, 0.3, 0.18); b.pop();
        b.color(C.woodDark);
        b.push(); b.translate(0, 0.04, 0); b.box(0.5, 0.08, 0.5); b.pop();
        b.pop();
      },

      table(b) {
        b.color(C.wood);
        b.push(); b.translate(0, 0.62, 0); b.box(1.0, 0.06, 0.62); b.pop();
        b.color(C.woodDark);
        [[-.42, -.24], [.42, -.24], [-.42, .24], [.42, .24]].forEach(p => {
          b.push(); b.translate(p[0], 0.31, p[1]); b.box(0.07, 0.62, 0.07); b.pop();
        });
      },

      chair(b) {
        b.color(C.wood);
        b.push(); b.translate(0, 0.42, 0); b.box(0.36, 0.05, 0.36); b.pop();
        b.push(); b.translate(-0.16, 0.66, 0); b.box(0.05, 0.45, 0.34); b.pop();
        b.color(C.woodDark);
        [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]].forEach(p => {
          b.push(); b.translate(p[0], 0.21, p[1]); b.box(0.045, 0.42, 0.045); b.pop();
        });
      },

      desk(b) {
        b.color(C.wood);
        b.push(); b.translate(0, 0.66, 0); b.box(1.05, 0.06, 0.55); b.pop();
        b.color(C.woodDark);
        b.push(); b.translate(-0.4, 0.33, 0); b.box(0.24, 0.66, 0.52); b.pop();
        b.push(); b.translate(0.44, 0.33, 0); b.box(0.06, 0.66, 0.52); b.pop();
        b.color(C.brass);
        for (let i = 0; i < 3; i++) {
          b.push(); b.translate(-0.4, 0.18 + i * 0.18, 0.27); b.box(0.1, 0.02, 0.02); b.pop();
        }
      },

      dresser(b) {
        b.color(C.wood);
        b.push(); b.translate(0, 0.42, 0); b.box(0.8, 0.84, 0.44); b.pop();
        b.color(C.woodDark);
        for (let i = 0; i < 3; i++) {
          b.push(); b.translate(0, 0.18 + i * 0.26, 0.23); b.box(0.7, 0.2, 0.03); b.pop();
        }
        b.color(C.brass);
        for (let i = 0; i < 3; i++) {
          b.push(); b.translate(0, 0.18 + i * 0.26, 0.26); b.box(0.16, 0.022, 0.022); b.pop();
        }
      },

      shelfunit(b) {
        b.color(C.woodDark);
        b.push(); b.translate(-0.34, 0.6, 0); b.box(0.05, 1.2, 0.32); b.pop();
        b.push(); b.translate(0.34, 0.6, 0); b.box(0.05, 1.2, 0.32); b.pop();
        for (let i = 0; i < 4; i++) {
          b.color(C.wood);
          b.push(); b.translate(0, 0.18 + i * 0.33, 0); b.box(0.72, 0.04, 0.32); b.pop();
          // a few books and tins left on the shelves
          for (let k = 0; k < 5; k++) {
            const h = 0.14 + U.hash(i, k, 3) * 0.1;
            b.color(0.2 + U.hash(i, k, 7) * 0.3, 0.15 + U.hash(i, k, 11) * 0.2, 0.12 + U.hash(i, k, 13) * 0.25);
            b.push();
            b.translate(-0.26 + k * 0.13 + U.hash(i, k, 5) * 0.03, 0.2 + i * 0.33 + h / 2, 0);
            b.box(0.05, h, 0.22);
            b.pop();
          }
        }
      },

      counter(b) {
        b.color(C.woodDark);
        b.push(); b.translate(0, 0.42, 0); b.box(1.1, 0.84, 0.56); b.pop();
        b.color(C.pale);
        b.push(); b.translate(0, 0.87, 0); b.box(1.16, 0.06, 0.6); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0.2, 0.885, 0); b.box(0.42, 0.05, 0.34); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0.2, 0.98, -0.18); b.cylinder(0.018, 0.16, 8); b.pop();
      },

      fridge(b) {
        b.color(C.white);
        b.push(); b.translate(0, 0.78, 0); b.box(0.6, 1.56, 0.58); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0, 1.02, 0.3); b.box(0.54, 0.02, 0.02); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0.22, 1.24, 0.31); b.box(0.03, 0.3, 0.03); b.pop();
        b.push(); b.translate(0.22, 0.6, 0.31); b.box(0.03, 0.3, 0.03); b.pop();
      },

      boiler(b) {
        b.color(C.rust);
        b.push(); b.translate(0, 0, 0); b.cylinder(0.34, 1.25, 14); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0, 1.25, 0); b.cylinder(0.36, 0.1, 14); b.pop();
        b.push(); b.translate(0, 1.35, 0); b.cylinder(0.1, 0.3, 8); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0.3, 0.5, 0.14); b.rotateZ(Math.PI / 2); b.cylinder(0.05, 0.3, 8); b.pop();
        b.push(); b.translate(0, 0.86, 0.34); b.rotateX(Math.PI / 2); b.cylinder(0.09, 0.06, 10); b.pop();
      },

      washer(b) {
        b.color(C.white);
        b.push(); b.translate(0, 0.42, 0); b.box(0.6, 0.84, 0.6); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.46, 0.31); b.rotateX(Math.PI / 2); b.cylinder(0.17, 0.03, 14); b.pop();
        b.color(C.glass);
        b.push(); b.translate(0, 0.46, 0.33); b.rotateX(Math.PI / 2); b.cylinder(0.13, 0.02, 14); b.pop();
      },

      workbench(b) {
        b.color(C.wood);
        b.push(); b.translate(0, 0.86, 0); b.box(1.5, 0.08, 0.6); b.pop();
        b.color(C.woodDark);
        [[-.68, -.24], [.68, -.24], [-.68, .24], [.68, .24]].forEach(p => {
          b.push(); b.translate(p[0], 0.43, p[1]); b.box(0.08, 0.86, 0.08); b.pop();
        });
        b.push(); b.translate(0, 0.55, -0.26); b.box(1.4, 0.04, 0.06); b.pop();
        b.color(C.metalDark);   // vice
        b.push(); b.translate(-0.55, 0.98, 0.2); b.box(0.16, 0.16, 0.1); b.pop();
        b.color(C.metal);
        b.push(); b.translate(-0.55, 0.98, 0.3); b.rotateX(Math.PI / 2); b.cylinder(0.02, 0.16, 8); b.pop();
      },

      toilet(b) {
        b.color(C.white);
        b.push(); b.translate(0, 0.2, 0); b.cylinder(0.17, 0.2, 12, { taper: 1.25 }); b.pop();
        b.push(); b.translate(0, 0.4, 0.02); b.box(0.36, 0.06, 0.44); b.pop();
        b.push(); b.translate(0, 0.6, -0.2); b.box(0.4, 0.44, 0.18); b.pop();
      },

      bathtub(b) {
        b.color(C.white);
        b.push(); b.translate(0, 0.24, 0); b.box(1.3, 0.48, 0.62); b.pop();
        b.color('#2a2724');
        b.push(); b.translate(0, 0.5, 0); b.box(1.16, 0.06, 0.5); b.pop();
        b.color(C.metal);
        b.push(); b.translate(-0.56, 0.62, 0); b.cylinder(0.02, 0.16, 8); b.pop();
      },

      basin(b) {
        b.color(C.white);
        b.push(); b.translate(0, 0.78, 0); b.box(0.46, 0.16, 0.36); b.pop();
        b.push(); b.translate(0, 0.5, 0); b.cylinder(0.07, 0.3, 8); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0, 0.9, -0.12); b.cylinder(0.018, 0.12, 8); b.pop();
      },

      clock(b) {
        b.color(C.woodDark);
        b.push(); b.translate(0, 0.9, 0); b.box(0.34, 1.8, 0.26); b.pop();
        b.color('#141210');
        b.push(); b.translate(0, 1.05, 0.14); b.box(0.2, 0.9, 0.02); b.pop();
        b.color(C.paper);
        b.push(); b.translate(0, 1.62, 0.14); b.rotateX(Math.PI / 2); b.cylinder(0.12, 0.02, 16); b.pop();
        b.color('#141210');
        b.push(); b.translate(0, 1.62, 0.17); b.box(0.02, 0.09, 0.01); b.pop();
        b.push(); b.translate(0.03, 1.62, 0.17); b.rotateZ(1.2); b.box(0.02, 0.07, 0.01); b.pop();
      },

      radiator(b) {
        b.color(C.pale);
        for (let i = 0; i < 7; i++) {
          b.push(); b.translate(-0.3 + i * 0.1, 0.3, 0); b.box(0.06, 0.56, 0.12); b.pop();
        }
        b.color(C.metal);
        b.push(); b.translate(0, 0.08, 0); b.box(0.72, 0.04, 0.1); b.pop();
      },

      crate(b) {
        const s = 0.56;
        b.color(C.wood);
        b.push(); b.translate(0, s / 2, 0); b.box(s, s, s, { uvScale: 0 }); b.pop();
        b.color(C.woodDark);
        [[0, s / 2 + .001, 0]].forEach(() => {});
        // corner battens
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          b.push(); b.translate(sx * s / 2, s / 2, sz * s / 2); b.box(0.05, s + 0.01, 0.05); b.pop();
        }
        b.push(); b.translate(0, s * 0.62, s / 2 + 0.005); b.rotateZ(0.7); b.box(0.05, s * 1.1, 0.02); b.pop();
      },

      crate_broken(b) {
        b.color(C.woodDark);
        b.push(); b.translate(0, 0.05, 0); b.box(0.56, 0.1, 0.56); b.pop();
        b.color(C.wood);
        for (let i = 0; i < 5; i++) {
          b.push();
          b.translate(U.rand(-0.2, 0.2), 0.12 + i * 0.02, U.rand(-0.2, 0.2));
          b.rotateY(U.rand(0, 3.14)); b.rotateZ(U.rand(-0.4, 0.4));
          b.box(0.42, 0.03, 0.09);
          b.pop();
        }
      },

      barrel(b) {
        b.color(C.rust);
        b.push(); b.cylinder(0.24, 0.7, 14); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.16, 0); b.cylinder(0.25, 0.05, 14, { open: true }); b.pop();
        b.push(); b.translate(0, 0.5, 0); b.cylinder(0.25, 0.05, 14, { open: true }); b.pop();
      },

      cardboard(b) {
        b.color('#7a6244');
        b.push(); b.translate(0, 0.18, 0); b.box(0.42, 0.36, 0.36); b.pop();
        b.color('#5e4a33');
        b.push(); b.translate(0, 0.37, 0); b.box(0.44, 0.02, 0.1); b.pop();
      },

      safe(b) {
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.32, 0); b.box(0.6, 0.64, 0.5); b.pop();
        b.color('#33383d');
        b.push(); b.translate(0, 0.32, 0.26); b.box(0.5, 0.54, 0.03); b.pop();
        b.color(C.metal);
        b.push(); b.translate(-0.03, 0.32, 0.29); b.rotateX(Math.PI / 2); b.cylinder(0.07, 0.04, 14); b.pop();
        b.color(C.brass);
        b.push(); b.translate(-0.03, 0.32, 0.33); b.rotateX(Math.PI / 2); b.cylinder(0.02, 0.03, 8); b.pop();
        b.push(); b.translate(0.18, 0.32, 0.3); b.box(0.03, 0.16, 0.03); b.pop();
      },

      vent(b) {
        b.color(C.metalDark);
        b.push(); b.translate(0, 0, 0); b.box(0.34, 0.28, 0.04); b.pop();
        b.color('#1b1e20');
        for (let i = 0; i < 4; i++) {
          b.push(); b.translate(0, -0.09 + i * 0.06, 0.021); b.rotateX(-0.5); b.box(0.28, 0.03, 0.01); b.pop();
        }
        b.color(C.metal);
        [[-.14, -.11], [.14, -.11], [-.14, .11], [.14, .11]].forEach(p => {
          b.push(); b.translate(p[0], p[1], 0.025); b.rotateX(Math.PI / 2); b.cylinder(0.012, 0.01, 6); b.pop();
        });
      },

      winch(b) {
        b.color(C.metalDark);
        b.push(); b.translate(0, 0, 0); b.box(0.3, 0.34, 0.16); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0, 0, 0.1); b.rotateX(Math.PI / 2); b.cylinder(0.06, 0.08, 12); b.pop();
        b.color(C.rust);
        b.push(); b.translate(0, 0.2, 0); b.box(0.34, 0.06, 0.2); b.pop();
      },

      winchcog(b) {
        b.color(C.metal);
        b.push(); b.rotateX(Math.PI / 2); b.gear(0.13, 10, 0.035, 0.05); b.pop();
        b.color(C.brass);
        b.push(); b.rotateX(Math.PI / 2); b.cylinder(0.03, 0.06, 8); b.pop();
      },

      hatch(b) {
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.03, 0); b.box(0.8, 0.06, 0.8); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0, 0.07, 0); b.rotateX(Math.PI / 2); b.gear(0.17, 6, 0.03, 0.05); b.pop();
        b.push(); b.translate(0, 0.09, 0); b.cylinder(0.04, 0.04, 8); b.pop();
        b.color(C.rust);   // the chain across it
        for (let i = 0; i < 7; i++) {
          b.push(); b.translate(-0.3 + i * 0.1, 0.08, 0.02 * Math.sin(i)); b.rotateY(0.4); b.box(0.07, 0.03, 0.03); b.pop();
        }
      },

      stain(b) {
        b.color(C.blood);
        const pts = [];
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * Math.PI * 2;
          const r = 0.16 + U.hash(i, 1, 21) * 0.16;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        b.push(); b.translate(0, 0.012, 0); b.extrude(pts, 0.012); b.pop();
      },

      rug(b) {
        b.color('#4a3327');
        b.push(); b.translate(0, 0.008, 0); b.box(1.5, 0.016, 1.0); b.pop();
        b.color('#5d4132');
        b.push(); b.translate(0, 0.018, 0); b.box(1.3, 0.004, 0.8); b.pop();
      },

      lamp(b) {
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.02, 0); b.cylinder(0.13, 0.04, 10); b.pop();
        b.push(); b.translate(0, 0.02, 0); b.cylinder(0.02, 1.05, 8); b.pop();
        b.color('#8a7c5e');
        b.push(); b.translate(0, 1.05, 0); b.cylinder(0.16, 0.24, 12, { taper: 0.72, open: true }); b.pop();
      },

      stairs(b) {
        // a short flight, purely so the stair markers read as stairs
        b.color(C.wood);
        for (let i = 0; i < 6; i++) {
          b.push(); b.translate(0, i * 0.11 + 0.055, -0.35 + i * 0.14);
          b.box(1.0, 0.11, 0.16);
          b.pop();
        }
        b.color(C.woodDark);
        b.push(); b.translate(-0.5, 0.4, 0); b.box(0.05, 0.8, 1.1); b.pop();
        b.push(); b.translate(0.5, 0.4, 0); b.box(0.05, 0.8, 1.1); b.pop();
      },

      ladder(b) {
        b.color(C.wood);
        b.push(); b.translate(-0.2, 0.7, 0); b.rotateX(0.25); b.box(0.06, 1.5, 0.06); b.pop();
        b.push(); b.translate(0.2, 0.7, 0); b.rotateX(0.25); b.box(0.06, 1.5, 0.06); b.pop();
        for (let i = 0; i < 5; i++) {
          b.push(); b.translate(0, 0.2 + i * 0.28, 0.05 - i * 0.07); b.box(0.44, 0.04, 0.05); b.pop();
        }
      },

      /* the swinging leaf; hinged at the origin, extends along +X */
      doorleaf(b) {
        b.color(1, 1, 1);
        b.push(); b.translate(0.47, 0, 0); b.box(0.94, 1.32, 0.07, { onFloor: true, uvScale: 1 }); b.pop();
        b.color(C.brass);
        b.push(); b.translate(0.84, 0.7, 0.05); b.rotateX(Math.PI / 2); b.cylinder(0.022, 0.04, 8); b.pop();
        b.push(); b.translate(0.84, 0.7, -0.05); b.rotateX(-Math.PI / 2); b.cylinder(0.022, 0.04, 8); b.pop();
      },

      /* contact shadow: pure black, and its vertex alpha does the work */
      blob(b) {
        b.color(0, 0, 0).ao(0.4);
        const pts = [];
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2;
          pts.push([Math.cos(a), Math.sin(a)]);
        }
        b.extrude(pts, 0.004);
        b.ao(1);
      },

      /* ------------------------------ items ---------------------- */

      item_key(b) {
        b.color(C.brass);
        b.push(); b.rotateX(Math.PI / 2); b.cylinder(0.035, 0.012, 10, { open: true }); b.pop();
        b.push(); b.translate(0.075, 0, 0); b.rotateZ(Math.PI / 2); b.cylinder(0.011, 0.11, 6); b.pop();
        b.push(); b.translate(0.15, -0.022, 0); b.box(0.02, 0.035, 0.012); b.pop();
        b.push(); b.translate(0.175, -0.018, 0); b.box(0.018, 0.028, 0.012); b.pop();
      },

      item_masterkey(b) {
        b.color(C.metal);
        b.push(); b.rotateX(Math.PI / 2); b.cylinder(0.04, 0.012, 10, { open: true }); b.pop();
        b.push(); b.translate(0.085, 0, 0); b.rotateZ(Math.PI / 2); b.cylinder(0.013, 0.13, 6); b.pop();
        b.push(); b.translate(0.17, -0.026, 0); b.box(0.026, 0.04, 0.013); b.pop();
      },

      item_cogwheel(b) {
        b.color(C.metal);
        b.push(); b.rotateX(Math.PI / 2); b.gear(0.11, 9, 0.03, 0.032); b.pop();
        b.color(C.metalDark);
        b.push(); b.rotateX(Math.PI / 2); b.cylinder(0.03, 0.04, 8); b.pop();
      },

      item_hammer(b) {
        b.color(C.wood);
        b.push(); b.translate(0, -0.09, 0); b.cylinder(0.017, 0.24, 8); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.16, 0); b.rotateZ(Math.PI / 2); b.box(0.05, 0.16, 0.05); b.pop();
        b.push(); b.translate(-0.09, 0.16, 0); b.rotateZ(0.4); b.box(0.04, 0.09, 0.03); b.pop();
      },

      item_crowbar(b) {
        b.color('#8c3a30');
        b.push(); b.translate(0, -0.02, 0); b.rotateZ(0.25); b.cylinder(0.015, 0.34, 8); b.pop();
        b.push(); b.translate(0.09, 0.28, 0); b.rotateZ(-1.0); b.cylinder(0.015, 0.09, 8); b.pop();
        b.push(); b.translate(0.14, 0.31, 0); b.rotateZ(-1.5); b.box(0.05, 0.03, 0.03); b.pop();
      },

      item_screwdriver(b) {
        b.color('#9c2f26');
        b.push(); b.translate(0, -0.06, 0); b.cylinder(0.026, 0.12, 10); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0, 0.06, 0); b.cylinder(0.008, 0.15, 8); b.pop();
        b.push(); b.translate(0, 0.2, 0); b.box(0.018, 0.02, 0.006); b.pop();
      },

      item_boltcutters(b) {
        b.color('#8c3a30');
        b.push(); b.translate(-0.02, -0.08, -0.02); b.rotateZ(0.14); b.cylinder(0.016, 0.26, 8); b.pop();
        b.push(); b.translate(0.02, -0.08, 0.02); b.rotateZ(-0.14); b.cylinder(0.016, 0.26, 8); b.pop();
        b.color(C.metal);
        b.push(); b.translate(-0.02, 0.18, -0.02); b.rotateZ(0.3); b.box(0.03, 0.12, 0.02); b.pop();
        b.push(); b.translate(0.02, 0.18, 0.02); b.rotateZ(-0.3); b.box(0.03, 0.12, 0.02); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.13, 0); b.rotateX(Math.PI / 2); b.cylinder(0.022, 0.06, 8); b.pop();
      },

      item_note(b) {
        b.color(C.paper);
        b.push(); b.rotateX(-0.2); b.box(0.17, 0.004, 0.13); b.pop();
        b.color('#6b6250');
        b.push(); b.translate(0, 0.004, 0); b.rotateX(-0.2); b.box(0.11, 0.002, 0.008); b.pop();
        b.push(); b.translate(0, 0.004, 0.03); b.rotateX(-0.2); b.box(0.09, 0.002, 0.008); b.pop();
      },

      item_tranq(b) {
        b.color('#3d443a');
        b.push(); b.translate(0.02, 0.02, 0); b.rotateZ(Math.PI / 2); b.cylinder(0.022, 0.3, 10); b.pop();
        b.push(); b.translate(-0.09, -0.07, 0); b.rotateZ(0.35); b.box(0.05, 0.15, 0.04); b.pop();
        b.color('#586052');
        b.push(); b.translate(0.0, 0.08, 0); b.rotateZ(Math.PI / 2); b.cylinder(0.014, 0.12, 8); b.pop();
        b.color(C.metalDark);
        b.push(); b.translate(-0.04, -0.02, 0); b.box(0.03, 0.05, 0.02); b.pop();
      },

      item_dart(b) {
        b.color(C.pale);
        b.push(); b.rotateZ(Math.PI / 2); b.cylinder(0.008, 0.16, 8); b.pop();
        b.color('#9c2f26');
        b.push(); b.translate(0.09, 0, 0); b.rotateZ(-Math.PI / 2); b.cylinder(0.014, 0.05, 8, { taper: 0.1 }); b.pop();
        b.color(C.white);
        b.push(); b.translate(-0.07, 0, 0); b.box(0.03, 0.03, 0.004); b.pop();
        b.push(); b.translate(-0.07, 0, 0); b.box(0.03, 0.004, 0.03); b.pop();
      },

      item_beartrap(b) {
        b.color(C.metalDark);
        b.push(); b.translate(0, 0.01, 0); b.rotateX(Math.PI / 2); b.cylinder(0.1, 0.02, 12); b.pop();
        b.color(C.metal);
        b.push(); b.translate(0, 0.02, 0); b.rotateX(Math.PI / 2); b.gear(0.2, 9, 0.05, 0.02); b.pop();
        // sprung jaws
        for (const s of [-1, 1]) {
          b.push(); b.translate(0, 0.03, s * 0.16); b.rotateX(s * 0.5); b.box(0.32, 0.02, 0.06); b.pop();
        }
      },

      item_battery: (b) => {
        b.color('#2f3a2c');
        b.push(); b.cylinder(0.035, 0.12, 12); b.pop();
        b.color(C.brass);
        b.push(); b.translate(0, 0.12, 0); b.cylinder(0.018, 0.015, 8); b.pop();
        b.push(); b.translate(0, 0.1, 0); b.cylinder(0.036, 0.02, 12, { open: true }); b.pop();
      },
    };
  },

  /* --------------------------------------------------------------- *
   *  granny: separate limb meshes, each pivoted at its joint
   * --------------------------------------------------------------- */
  buildGranny(gl) {
    const parts = {

      g_pelvis(b) {
        b.color(C.dress);
        b.push(); b.translate(0, -0.04, 0); b.box(0.24, 0.14, 0.18); b.pop();
      },

      /* torso pivots at the waist and leans forward */
      g_torso(b) {
        b.color(C.dress);
        b.push(); b.translate(0, 0.16, 0); b.box(0.28, 0.34, 0.2); b.pop();
        b.color(C.cardigan);
        b.push(); b.translate(0, 0.2, 0.005); b.box(0.3, 0.26, 0.22); b.pop();
        // the hump that makes her silhouette unmistakable
        b.color(C.cardigan);
        b.push(); b.translate(0, 0.33, -0.08); b.sphere(0.1, 10, 8); b.pop();
        b.color(C.dressDark);
        b.push(); b.translate(0, 0.02, 0.02); b.box(0.26, 0.06, 0.2); b.pop();
      },

      /* skirt hangs from the waist */
      g_skirt(b) {
        b.color(C.dress);
        b.push(); b.translate(0, -0.3, 0); b.cylinder(0.15, 0.3, 12, { taper: 0.72 }); b.pop();
      },

      g_head(b) {
        b.color(C.skin);
        b.push(); b.translate(0, 0.07, 0); b.sphere(0.082, 12, 10); b.pop();
        b.push(); b.translate(0.03, 0.05, 0); b.sphere(0.062, 10, 8); b.pop();   // jaw pushed forward
        b.color(C.hair);
        b.push(); b.translate(-0.02, 0.11, 0); b.sphere(0.085, 12, 8); b.pop();
        b.push(); b.translate(-0.07, 0.15, 0); b.sphere(0.05, 10, 8); b.pop();    // bun
        b.color('#1a1512');
        b.push(); b.translate(0.062, 0.085, 0.035); b.sphere(0.017, 8, 6); b.pop();
        b.push(); b.translate(0.062, 0.085, -0.035); b.sphere(0.017, 8, 6); b.pop();
        b.color('#3c1512');
        b.push(); b.translate(0.075, 0.03, 0); b.box(0.02, 0.03, 0.045); b.pop();  // mouth
      },

      g_upperarm(b) {
        b.color(C.cardigan);
        b.push(); b.translate(0, -0.09, 0); b.box(0.07, 0.2, 0.07); b.pop();
      },

      g_forearm(b) {
        b.color(C.skin);
        b.push(); b.translate(0, -0.085, 0); b.box(0.058, 0.19, 0.058); b.pop();
        b.push(); b.translate(0, -0.19, 0); b.sphere(0.04, 8, 6); b.pop();
      },

      g_thigh(b) {
        b.color(C.dressDark);
        b.push(); b.translate(0, -0.1, 0); b.box(0.085, 0.22, 0.085); b.pop();
      },

      g_shin(b) {
        b.color('#6e6a62');
        b.push(); b.translate(0, -0.1, 0); b.box(0.07, 0.22, 0.07); b.pop();
        b.color('#26241f');
        b.push(); b.translate(0.03, -0.23, 0); b.box(0.16, 0.06, 0.09); b.pop();   // slipper
      },

      g_bat(b) {
        b.color(C.woodLight);
        b.push(); b.translate(0, 0.16, 0); b.cylinder(0.026, 0.34, 10, { taper: 0.55 }); b.pop();
        b.color(C.woodDark);
        b.push(); b.cylinder(0.019, 0.1, 8); b.pop();
        b.color('#5e1b16');
        b.push(); b.translate(0, 0.44, 0); b.sphere(0.032, 8, 6); b.pop();
      },
    };

    Object.keys(parts).forEach(name => {
      const b = new MeshBuilder();
      parts[name](b);
      this.mesh[name] = b.build(gl);
    });
  },
};

/* ------------------------------------------------------------------ *
 *  Granny's pose: a tiny skeleton evaluated every frame.
 *  Returns [{mesh, mat}] in world space.
 * ------------------------------------------------------------------ */
const GrannyRig = {
  _out: [],
  _mats: [],
  _scratch: M4.create(),

  _mat(i) {
    while (this._mats.length <= i) this._mats.push(M4.create());
    return this._mats[i];
  },

  /**
   * @param x,z    world position
   * @param yaw    game-space facing angle
   * @param phase  walk-cycle phase in radians
   * @param mode   'walk' | 'chase' | 'stunned'
   * @param headYaw extra yaw for the head, so she stares at you
   */
  pose(x, z, yaw, phase, mode, headYaw) {
    const out = this._out;
    out.length = 0;
    let n = 0;
    const push = (meshName, mat) => { out.push({ mesh: Models.get(meshName), mat }); };
    const M = (parent, local) => {
      const m = this._mat(n++);
      M4.multiply(m, parent, local);
      return m;
    };
    const L = this._scratch;

    const down = mode === 'stunned';
    const chasing = mode === 'chase';

    /* Sign convention: limbs are modelled hanging along -Y, so a positive
       Z rotation swings them forward (+X). The torso points up, so it needs
       a negative rotation to hunch forward over its own feet. */
    const swing = down ? 0 : Math.sin(phase) * (chasing ? 0.8 : 0.42);
    const swing2 = down ? 0 : Math.sin(phase + Math.PI) * (chasing ? 0.8 : 0.42);
    const bob = down ? 0 : Math.abs(Math.cos(phase)) * (chasing ? 0.03 : 0.015);
    const lean = down ? 1.3 : (chasing ? 0.58 : 0.46);
    const hipY = down ? 0.22 : 0.5 + bob;

    /* root */
    const root = this._mat(n++);
    M4.trs(root, x, 0, z, -yaw, 1, 1, 1);

    /* pelvis */
    const pelvis = M(root, M4.translation(L, 0, hipY, 0));
    push('g_pelvis', pelvis);
    push('g_skirt', pelvis);

    /* legs — the trailing knee bends back */
    for (const side of [-1, 1]) {
      const sw = side > 0 ? swing : swing2;
      const hip = M(pelvis, M4.translation(L, 0, -0.02, side * 0.075));
      const thigh = M(hip, M4.rotationZ(L, sw));
      push('g_thigh', thigh);
      const knee = M(thigh, M4.translation(L, 0, -0.21, 0));
      const shin = M(knee, M4.rotationZ(L, -Math.max(0, sw) * 0.9));
      push('g_shin', shin);
    }

    /* torso, hunched forward over the hips */
    const waist = M(pelvis, M4.translation(L, 0, 0.02, 0));
    const torso = M(waist, M4.rotationZ(L, -lean));
    push('g_torso', torso);

    /* head, tipped back out of the hunch so she is always looking at you */
    const neck = M(torso, M4.translation(L, 0.02, 0.4, 0));
    const headTilt = M(neck, M4.rotationZ(L, lean * 0.86));
    const head = M(headTilt, M4.rotationY(L, -(headYaw || 0)));
    push('g_head', head);

    /* arms: hanging and counter-swinging at a walk, reaching when she runs */
    const reach = chasing ? 1.35 : 0.0;
    const shoulderL = M(torso, M4.translation(L, 0, 0.34, -0.15));
    const armL = M(shoulderL, M4.rotationZ(L, reach + swing2 * 0.55));
    push('g_upperarm', armL);
    const elbowL = M(armL, M4.translation(L, 0, -0.19, 0));
    const foreL = M(elbowL, M4.rotationZ(L, chasing ? 0.5 : 0.15));
    push('g_forearm', foreL);

    const shoulderR = M(torso, M4.translation(L, 0, 0.34, 0.15));
    const armR = M(shoulderR, M4.rotationZ(L, (chasing ? 1.15 : 0.1) + swing * 0.55));
    push('g_upperarm', armR);
    const elbowR = M(armR, M4.translation(L, 0, -0.19, 0));
    const foreR = M(elbowR, M4.rotationZ(L, chasing ? 0.75 : 0.3));
    push('g_forearm', foreR);

    /* the bat, gripped in the right hand and raised mid-chase */
    const hand = M(foreR, M4.translation(L, 0, -0.2, 0));
    const bat = M(hand, M4.rotationZ(L, chasing ? -0.6 + Math.sin(phase * 2) * 0.3 : -1.35));
    push('g_bat', bat);

    return out;
  },
};

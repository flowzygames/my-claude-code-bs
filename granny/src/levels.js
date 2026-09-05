/* ------------------------------------------------------------------ *
 *  levels.js — the house.
 *
 *  Levels are built by carving rooms out of a solid grid; wall tiles are
 *  then inferred from whichever room a solid cell touches, so the maps
 *  below only ever describe rooms, doors and the things inside them.
 *
 *  Entity coordinates are grid coordinates: x runs east, y runs south and
 *  becomes world z. `face` is a game-space angle, 0 pointing east.
 * ------------------------------------------------------------------ */
'use strict';

/* ------------------------------------------------------------------ *
 *  builder
 * ------------------------------------------------------------------ */

function buildLevel(spec) {
  const { w, h } = spec;
  const grid = [];
  const roomOf = [];
  for (let y = 0; y < h; y++) {
    grid.push(new Array(w).fill(T.BRICK));
    roomOf.push(new Array(w).fill(-1));
  }

  // carve room interiors
  spec.rooms.forEach((r, i) => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        grid[y][x] = T.EMPTY;
        roomOf[y][x] = i;
      }
    }
  });

  // walls take the style of the room they enclose
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === T.EMPTY) continue;
      let tile = spec.wall || T.BRICK;
      for (const [dx, dy] of near) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ri = roomOf[ny][nx];
        if (ri >= 0) { tile = spec.rooms[ri].wall || tile; break; }
      }
      grid[y][x] = tile;
    }
  }

  // pillars and other deliberate blockers punched back in
  (spec.blocks || []).forEach(([x, y, tile]) => { grid[y][x] = tile || spec.wall || T.STONE; });

  // decorative wall swaps (windows, shelves, shutters, the front door)
  (spec.walls || []).forEach(([x, y, tile]) => { grid[y][x] = tile; });

  // doors
  const doors = (spec.doors || []).map((d, i) => {
    grid[d.y][d.x] = T.DOOR;
    return {
      id: `${spec.id}_door${i}`,
      x: d.x, y: d.y,
      level: spec.id,
      locked: d.locked || null,
      open: false,
      anim: 0,               // 0 closed .. 1 fully open
      label: d.label || 'Door',
    };
  });

  return {
    id: spec.id,
    name: spec.name,
    w, h, grid,
    roomGrid: roomOf,
    roomStyles: spec.rooms,
    floorTex: spec.floorTex || T.FLOORB,
    ceilTex: spec.ceilTex || T.CEIL,
    doors,
    ambient: spec.ambient,
    fog: spec.fog || 9,
    extraLights: spec.lights || [],
    creaks: spec.creaks || [],
    entities: (spec.entities || []).map((e, i) =>
      Object.assign({ id: `${spec.id}_e${i}`, level: spec.id }, e)),
  };
}

/* shorthand for the decorative furniture that just stands there */
function prop(model, x, y, face) {
  return { kind: 'prop', model, x, y, face: face || 0 };
}

/* ------------------------------------------------------------------ *
 *  level specs
 * ------------------------------------------------------------------ */

const E = Math.PI / 2;      // facing south (+z)
const N = -Math.PI / 2;     // facing north (-z)
const Wq = Math.PI;         // facing west (-x)

const LEVEL_SPECS = [

  /* =========================== GROUND ============================== */
  {
    id: 'ground', name: 'GROUND FLOOR',
    w: 28, h: 28, wall: T.PAPER,
    ambient: 0.15, fog: 9.5,
    rooms: [
      { x: 12, y: 20, w: 5, h: 6, wall: T.PAPER, floor: T.FLOORB },   // foyer
      { x: 2, y: 15, w: 9, h: 11, wall: T.PAPER, floor: T.FLOORB },   // living room
      { x: 18, y: 15, w: 8, h: 11, wall: T.TILE, floor: T.TILE },     // kitchen
      { x: 12, y: 9, w: 5, h: 10, wall: T.PAPER, floor: T.FLOORB },   // hall
      { x: 2, y: 2, w: 9, h: 11, wall: T.WOOD, floor: T.FLOORB },     // study
      { x: 18, y: 2, w: 8, h: 11, wall: T.PLASTER, floor: T.PLASTER, ceil: T.PLASTER }, // garage
      { x: 12, y: 2, w: 5, h: 6, wall: T.PAPER, floor: T.FLOORB },    // stairwell
    ],
    doors: [
      { x: 11, y: 22, label: 'Living room' },
      { x: 17, y: 22, label: 'Kitchen' },
      { x: 14, y: 19, label: 'Hall' },
      { x: 11, y: 16, label: 'Living room' },
      { x: 17, y: 16, label: 'Kitchen' },
      { x: 11, y: 11, label: 'Study' },
      { x: 17, y: 11, label: 'Garage' },
      { x: 14, y: 8, label: 'Stairs' },
    ],
    walls: [
      [14, 26, T.EXIT],                                    // the front door
      [5, 26, T.WINDOW], [22, 26, T.WINDOW],
      [1, 20, T.WINDOW], [1, 24, T.WINDOW], [1, 6, T.WINDOW],
      [26, 20, T.WINDOW], [26, 24, T.WINDOW],
      [26, 5, T.GARAGE], [26, 6, T.GARAGE], [26, 7, T.GARAGE], [26, 8, T.GARAGE],
      [11, 3, T.SHELF], [11, 4, T.SHELF], [11, 5, T.SHELF],
      [1, 3, T.SHELF], [1, 4, T.SHELF],
      [4, 1, T.WINDOW], [8, 1, T.BOARDS], [20, 1, T.BOARDS],
    ],
    lights: [
      { x: 22, y: 1.42, z: 7, r: 0.20, g: 0.16, b: 0.10, range: 6 },   // garage bulb
    ],
    creaks: [[14, 18], [14, 12], [13, 24], [8, 20], [20, 20], [15, 9]],
    entities: [
      { kind: 'exit', id: 'frontdoor', x: 14.5, y: 25.4, face: E },
      { kind: 'winch', model: 'winch', x: 15.7, y: 25.82, face: N },
      { kind: 'safe', id: 'safe', model: 'safe', x: 2.7, y: 3.5, face: 0 },
      { kind: 'container', id: 'crate', model: 'crate', openModel: 'crate_broken',
        x: 22.5, y: 5.5, needs: 'hammer', gives: 'crowbar',
        prompt: 'Smash open crate', noise: 15 },
      { kind: 'item', item: 'masterkey', x: 21.5, y: 20.5, elev: 0.68 },   // on the table
      { kind: 'item', item: 'beartrap', x: 19.6, y: 11.3 },
      { kind: 'item', item: 'battery', x: 3.6, y: 24.4 },
      { kind: 'hide', spot: 'wardrobe', model: 'wardrobe', x: 9.5, y: 16.6, face: Wq },

      /* --- furnishings --- */
      prop('rug', 5.5, 22.5), prop('sofa', 5.5, 24.4, N), prop('armchair', 8.4, 23.4, Wq),
      prop('clock', 2.4, 18.5, 0), prop('lamp', 3.0, 21.0),
      prop('stain', 12.6, 20.6),
      prop('counter', 21.5, 25.3, N), prop('fridge', 25.4, 16.7, Wq),
      prop('table', 21.5, 20.5), prop('chair', 20.3, 20.5, 0), prop('chair', 22.7, 20.5, Wq),
      prop('washer', 25.4, 22.5, Wq),
      prop('desk', 5.5, 3.0, E), prop('chair', 5.5, 4.3, N),
      prop('shelfunit', 9.6, 6.5, Wq), prop('shelfunit', 9.6, 9.5, Wq),
      prop('workbench', 20.0, 3.0, E), prop('barrel', 24.6, 3.6),
      prop('cardboard', 23.4, 9.6), prop('cardboard', 24.1, 10.3), prop('cardboard', 23.8, 8.9),
      prop('clock', 12.5, 12.5, 0),
    ],
  },

  /* ============================ UPPER ============================== */
  {
    id: 'upper', name: 'FIRST FLOOR',
    w: 28, h: 28, wall: T.PAPER,
    ambient: 0.14, fog: 8.5,
    rooms: [
      { x: 12, y: 2, w: 5, h: 24, wall: T.PAPER, floor: T.FLOORB },   // landing + hall
      { x: 2, y: 2, w: 9, h: 11, wall: T.PAPER, floor: T.FLOORB },    // master bedroom
      { x: 18, y: 2, w: 8, h: 8, wall: T.TILE, floor: T.TILE },       // bathroom
      { x: 18, y: 12, w: 8, h: 9, wall: T.PAPER, floor: T.FLOORB },   // small bedroom (start)
      { x: 2, y: 15, w: 9, h: 11, wall: T.WOOD, floor: T.FLOORB },    // guest room
    ],
    doors: [
      { x: 11, y: 7, locked: 'masterkey', label: 'Master bedroom' },
      { x: 17, y: 5, label: 'Bathroom' },
      { x: 17, y: 16, label: 'Bedroom' },
      { x: 11, y: 20, label: 'Guest room' },
    ],
    walls: [
      [1, 6, T.WINDOW], [1, 20, T.WINDOW], [26, 6, T.WINDOW], [26, 17, T.WINDOW],
      [14, 1, T.WINDOW], [8, 1, T.BOARDS], [22, 1, T.BOARDS],
      [11, 24, T.SHELF], [11, 23, T.SHELF],
    ],
    creaks: [[14, 14], [14, 19], [14, 6], [20, 15], [5, 18], [5, 5]],
    entities: [
      { kind: 'item', item: 'cogwheel', x: 9.4, y: 3.5, elev: 0.86 },   // on the dresser
      { kind: 'item', item: 'boltcutters', x: 3.6, y: 11.4 },
      { kind: 'item', item: 'screwdriver', x: 24.6, y: 3.2, elev: 0.88 }, // on the basin
      { kind: 'item', item: 'dart', x: 3.6, y: 24.4 },
      { kind: 'item', item: 'battery', x: 25.2, y: 19.5 },
      { kind: 'vent', id: 'vent', model: 'vent', x: 16.86, y: 22.5, face: Wq,
        needs: 'screwdriver', gives: 'note' },
      { kind: 'hide', spot: 'bed', model: 'bed', x: 21.5, y: 18.4, face: 0 },
      { kind: 'hide', spot: 'wardrobe', model: 'wardrobe', x: 2.55, y: 16.6, face: 0 },
      { kind: 'hide', spot: 'bed', model: 'bed', x: 5.5, y: 4.5, face: 0 },

      /* --- furnishings --- */
      prop('dresser', 9.5, 3.5, Wq), prop('lamp', 3.2, 6.5), prop('rug', 5.5, 8.5),
      prop('armchair', 3.4, 10.5, 0),
      prop('bathtub', 23.6, 8.3, N), prop('toilet', 19.0, 3.3, 0), prop('basin', 24.6, 2.7, E),
      prop('bed', 24.2, 13.4, 0), prop('dresser', 19.0, 13.2, E), prop('cardboard', 25.2, 15.5),
      prop('bed', 5.5, 24.2, 0), prop('shelfunit', 9.6, 18.5, Wq), prop('chair', 3.5, 20.5, 0),
      prop('clock', 12.5, 15.5, 0),
    ],
  },

  /* =========================== BASEMENT ============================ */
  {
    id: 'basement', name: 'BASEMENT',
    w: 28, h: 28, wall: T.STONE,
    ambient: 0.105, fog: 7.5,
    rooms: [
      { x: 2, y: 4, w: 13, h: 21, wall: T.STONE, floor: T.PLASTER, ceil: T.WOOD },     // cellar
      { x: 16, y: 4, w: 10, h: 9, wall: T.METAL, floor: T.PLASTER, ceil: T.PLASTER },  // boiler room
      { x: 16, y: 16, w: 10, h: 9, wall: T.DIRT, floor: T.DIRT, ceil: T.WOOD },        // storage
    ],
    doors: [
      { x: 15, y: 8, label: 'Boiler room' },
      { x: 15, y: 20, label: 'Storage' },
    ],
    blocks: [
      [5, 9, T.STONE], [5, 15, T.STONE], [10, 9, T.STONE], [10, 15, T.STONE],
      [5, 21, T.STONE], [10, 21, T.STONE],
    ],
    walls: [
      [1, 12, T.DIRT], [1, 13, T.DIRT], [26, 10, T.METAL], [26, 20, T.DIRT],
    ],
    lights: [
      { x: 18.5, y: 0.55, z: 6.5, r: 0.42, g: 0.16, b: 0.05, range: 4.6 },  // boiler firebox
    ],
    creaks: [],
    entities: [
      { kind: 'item', item: 'hammer', x: 4.5, y: 5.0, elev: 0.9 },      // on the workbench
      { kind: 'item', item: 'dart', x: 13.4, y: 23.4 },
      { kind: 'item', item: 'beartrap', x: 21.5, y: 6.5 },
      { kind: 'hatch', id: 'sewer', model: 'hatch', x: 22.5, y: 20.5 },
      { kind: 'hide', spot: 'wardrobe', model: 'wardrobe', x: 2.55, y: 22.5, face: 0 },

      /* --- furnishings --- */
      prop('workbench', 4.5, 4.6, E), prop('shelfunit', 2.6, 10.5, 0),
      prop('barrel', 12.4, 8.5), prop('barrel', 12.9, 9.3),
      prop('cardboard', 3.5, 13.5), prop('cardboard', 4.2, 14.1),
      prop('crate', 13.5, 5.5), prop('crate', 12.5, 12.5), prop('crate', 6.5, 18.5),
      prop('washer', 13.6, 18.5, Wq),
      prop('boiler', 18.5, 6.5), prop('barrel', 24.6, 5.5), prop('shelfunit', 25.4, 10.5, Wq),
      prop('cardboard', 17.5, 17.5), prop('cardboard', 18.2, 18.1),
      prop('shelfunit', 25.4, 20.5, Wq), prop('stain', 16.8, 22.5),
    ],
  },

  /* ============================ ATTIC ============================== */
  {
    id: 'attic', name: 'ATTIC',
    w: 20, h: 20, wall: T.WOOD,
    ambient: 0.115, fog: 7,
    rooms: [
      { x: 2, y: 2, w: 15, h: 15, wall: T.WOOD, floor: T.FLOORB, ceil: T.WOOD },
    ],
    doors: [],
    blocks: [[8, 8, T.WOOD], [9, 8, T.WOOD], [8, 9, T.WOOD]],
    walls: [[1, 9, T.WINDOW], [17, 6, T.BOARDS], [9, 1, T.WINDOW]],
    creaks: [[5, 5], [12, 12], [6, 13]],
    entities: [
      { kind: 'item', item: 'tranq', x: 15.4, y: 15.4 },
      { kind: 'item', item: 'dart', x: 15.4, y: 3.6 },
      { kind: 'item', item: 'battery', x: 4.5, y: 14.5 },
      { kind: 'hide', spot: 'wardrobe', model: 'wardrobe', x: 4.5, y: 2.55, face: E },

      /* --- furnishings --- */
      prop('crate', 12.5, 4.5), prop('crate', 13.2, 5.2), prop('crate', 5.5, 11.5),
      prop('cardboard', 12.5, 12.5), prop('cardboard', 13.1, 13.2),
      prop('dresser', 15.5, 9.5, Wq), prop('rug', 7.5, 7.0),
    ],
  },
];

/* ------------------------------------------------------------------ *
 *  vertical connections (stairs / ladders)
 * ------------------------------------------------------------------ */

const STAIRS = [
  { level: 'ground', x: 14.5, y: 3.5, to: 'upper', tx: 14.5, ty: 3.5, label: 'Go upstairs', dir: 'up', model: 'stairs', face: N },
  { level: 'upper', x: 14.5, y: 2.6, to: 'ground', tx: 14.5, ty: 4.6, label: 'Go downstairs', dir: 'down', model: 'stairs', face: E },
  { level: 'ground', x: 2.6, y: 25.4, to: 'basement', tx: 13.5, ty: 23.5, label: 'Go down to the basement', dir: 'down', model: 'stairs', face: 0 },
  { level: 'basement', x: 13.5, y: 24.4, to: 'ground', tx: 3.5, ty: 24.4, label: 'Go up to the house', dir: 'up', model: 'stairs', face: E },
  { level: 'upper', x: 13.5, y: 25.4, to: 'attic', tx: 3.5, ty: 3.5, label: 'Climb the ladder', dir: 'up', model: 'ladder', face: E },
  { level: 'attic', x: 2.6, y: 2.6, to: 'upper', tx: 14.5, ty: 24.4, label: 'Climb down', dir: 'down', model: 'ladder', face: 0 },
];

/* the room the player wakes up in every morning */
const START = { level: 'upper', x: 21.5, y: 15.0, ang: Math.PI * 0.5 };

/* granny's own bedroom — where she starts each day */
const GRANNY_START = { level: 'ground', x: 5.5, y: 20.5 };

function buildWorld() {
  const levels = {};
  LEVEL_SPECS.forEach(spec => { levels[spec.id] = buildLevel(spec); });

  // stairs become interactable entities on both ends
  STAIRS.forEach((s, i) => {
    levels[s.level].entities.push({
      id: `stair${i}`, kind: 'stairs', level: s.level,
      x: s.x, y: s.y, to: s.to, tx: s.tx, ty: s.ty,
      label: s.label, dir: s.dir, model: s.model, face: s.face,
    });
  });
  return levels;
}

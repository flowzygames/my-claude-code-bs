/* ------------------------------------------------------------------ *
 *  levels.js — the house.
 *
 *  Levels are built by carving rooms out of a solid grid; wall tiles are
 *  then inferred from whichever room a solid cell touches, so the maps
 *  below only ever describe rooms, doors and the things inside them.
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
    doors,
    ambient: spec.ambient,
    fog: spec.fog || 9,
    ceil: spec.ceil,
    floor: spec.floor,
    creaks: spec.creaks || [],
    entities: (spec.entities || []).map((e, i) =>
      Object.assign({ id: `${spec.id}_e${i}`, level: spec.id }, e)),
  };
}

/* ------------------------------------------------------------------ *
 *  level specs
 * ------------------------------------------------------------------ */

const LEVEL_SPECS = [

  /* =========================== GROUND ============================== */
  {
    id: 'ground', name: 'GROUND FLOOR',
    w: 28, h: 28, wall: T.PAPER,
    ambient: 0.19, fog: 9.5,
    ceil: '#2b241c', floor: '#2f261c',
    rooms: [
      { x: 12, y: 20, w: 5, h: 6, wall: T.PAPER },    // foyer
      { x: 2, y: 15, w: 9, h: 11, wall: T.PAPER },    // living room
      { x: 18, y: 15, w: 8, h: 11, wall: T.TILE },    // kitchen
      { x: 12, y: 9, w: 5, h: 10, wall: T.PAPER },    // hall
      { x: 2, y: 2, w: 9, h: 11, wall: T.WOOD },      // study
      { x: 18, y: 2, w: 8, h: 11, wall: T.PLASTER },  // garage
      { x: 12, y: 2, w: 5, h: 6, wall: T.PAPER },     // stairwell
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
    creaks: [[14, 18], [14, 12], [13, 24], [8, 20], [20, 20], [15, 9]],
    entities: [
      { kind: 'exit', id: 'frontdoor', x: 14.5, y: 25.4, face: Math.PI * 1.5 },
      { kind: 'winch', x: 16.4, y: 25.5, sprite: 'winch' },
      { kind: 'safe', id: 'safe', x: 2.6, y: 2.6, sprite: 'safe' },
      { kind: 'container', id: 'crate', sprite: 'crate', openSprite: 'crate_broken',
        x: 22.5, y: 5.5, needs: 'hammer', gives: 'crowbar',
        prompt: 'Smash open crate', noise: 15, verb: 'smash' },
      { kind: 'item', item: 'masterkey', x: 24.5, y: 24.4 },
      { kind: 'item', item: 'beartrap', x: 19.5, y: 11.4 },
      { kind: 'item', item: 'battery', x: 3.5, y: 24.5 },
      { kind: 'hide', spot: 'wardrobe', x: 9.4, y: 16.5, sprite: 'wardrobe', face: Math.PI },
      { kind: 'prop', sprite: 'blood', x: 12.6, y: 20.6, flat: true },
    ],
  },

  /* ============================ UPPER ============================== */
  {
    id: 'upper', name: 'FIRST FLOOR',
    w: 28, h: 28, wall: T.PAPER,
    ambient: 0.17, fog: 8.5,
    ceil: '#292219', floor: '#31281d',
    rooms: [
      { x: 12, y: 2, w: 5, h: 24, wall: T.PAPER },    // landing + hall
      { x: 2, y: 2, w: 9, h: 11, wall: T.PAPER },     // master bedroom
      { x: 18, y: 2, w: 8, h: 8, wall: T.TILE },      // bathroom
      { x: 18, y: 12, w: 8, h: 9, wall: T.PAPER },    // small bedroom (start)
      { x: 2, y: 15, w: 9, h: 11, wall: T.WOOD },     // guest room
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
      { kind: 'item', item: 'cogwheel', x: 3.5, y: 3.5 },
      { kind: 'item', item: 'boltcutters', x: 9.4, y: 11.5 },
      { kind: 'item', item: 'screwdriver', x: 24.5, y: 3.4 },
      { kind: 'item', item: 'dart', x: 3.5, y: 24.5 },
      { kind: 'item', item: 'battery', x: 24.5, y: 19.5 },
      { kind: 'vent', id: 'vent', x: 16.4, y: 22.5, sprite: 'vent',
        needs: 'screwdriver', gives: 'note' },
      { kind: 'hide', spot: 'bed', x: 21.5, y: 18.5, sprite: 'bed', face: 0 },
      { kind: 'hide', spot: 'wardrobe', x: 2.6, y: 16.5, sprite: 'wardrobe', face: 0 },
      { kind: 'hide', spot: 'bed', x: 5.5, y: 4.5, sprite: 'bed', face: 0 },
      { kind: 'prop', sprite: 'bed', x: 24.0, y: 13.5, face: 0 },
    ],
  },

  /* =========================== BASEMENT ============================ */
  {
    id: 'basement', name: 'BASEMENT',
    w: 28, h: 28, wall: T.STONE,
    ambient: 0.09, fog: 7,
    ceil: '#1d1a17', floor: '#221d17',
    rooms: [
      { x: 2, y: 4, w: 13, h: 21, wall: T.STONE },   // main cellar
      { x: 16, y: 4, w: 10, h: 9, wall: T.METAL },   // boiler room
      { x: 16, y: 16, w: 10, h: 9, wall: T.DIRT },   // storage / sewer
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
    creaks: [],
    entities: [
      { kind: 'item', item: 'hammer', x: 3.5, y: 5.5 },
      { kind: 'item', item: 'dart', x: 13.5, y: 23.5 },
      { kind: 'item', item: 'beartrap', x: 20.5, y: 6.5 },
      { kind: 'hatch', id: 'sewer', x: 22.5, y: 20.5, sprite: 'hatch' },
      { kind: 'hide', spot: 'wardrobe', x: 2.6, y: 22.5, sprite: 'wardrobe', face: 0 },
      { kind: 'prop', sprite: 'crate', x: 13.5, y: 5.5 },
      { kind: 'prop', sprite: 'crate', x: 12.5, y: 12.5 },
      { kind: 'prop', sprite: 'blood', x: 16.6, y: 22.5, flat: true },
    ],
  },

  /* ============================ ATTIC ============================== */
  {
    id: 'attic', name: 'ATTIC',
    w: 20, h: 20, wall: T.WOOD,
    ambient: 0.11, fog: 6.5,
    ceil: '#2a2318', floor: '#2f2418',
    rooms: [
      { x: 2, y: 2, w: 15, h: 15, wall: T.WOOD },
    ],
    doors: [],
    blocks: [[8, 8, T.WOOD], [9, 8, T.WOOD], [8, 9, T.WOOD]],
    walls: [[1, 9, T.WINDOW], [17, 6, T.BOARDS], [9, 1, T.WINDOW]],
    creaks: [[5, 5], [12, 12], [6, 13]],
    entities: [
      { kind: 'item', item: 'tranq', x: 15.5, y: 15.5 },
      { kind: 'item', item: 'dart', x: 15.5, y: 3.5 },
      { kind: 'item', item: 'battery', x: 4.5, y: 14.5 },
      { kind: 'prop', sprite: 'crate', x: 12.5, y: 4.5 },
      { kind: 'prop', sprite: 'crate', x: 5.5, y: 11.5 },
      { kind: 'hide', spot: 'wardrobe', x: 3.5, y: 2.6, sprite: 'wardrobe', face: Math.PI / 2 },
    ],
  },
];

/* ------------------------------------------------------------------ *
 *  vertical connections (stairs / ladders)
 * ------------------------------------------------------------------ */

const STAIRS = [
  { level: 'ground', x: 14.5, y: 3.5, to: 'upper', tx: 14.5, ty: 3.5, label: 'Go upstairs', dir: 'up' },
  { level: 'upper', x: 14.5, y: 2.6, to: 'ground', tx: 14.5, ty: 4.6, label: 'Go downstairs', dir: 'down' },
  { level: 'ground', x: 2.6, y: 25.4, to: 'basement', tx: 13.5, ty: 23.5, label: 'Go down to the basement', dir: 'down' },
  { level: 'basement', x: 13.5, y: 24.4, to: 'ground', tx: 3.5, ty: 24.4, label: 'Go up to the house', dir: 'up' },
  { level: 'upper', x: 13.5, y: 25.4, to: 'attic', tx: 3.5, ty: 3.5, label: 'Climb the ladder', dir: 'up' },
  { level: 'attic', x: 2.6, y: 2.6, to: 'upper', tx: 14.5, ty: 24.4, label: 'Climb down', dir: 'down' },
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
      label: s.label, dir: s.dir,
    });
  });
  return levels;
}

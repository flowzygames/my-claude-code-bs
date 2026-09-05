/* ------------------------------------------------------------------ *
 *  items.js — what you can carry and what it is for.
 * ------------------------------------------------------------------ */
'use strict';

const ITEMS = {
  hammer: {
    name: 'Hammer', sprite: 'item_hammer', model: 'item_hammer', scale: 0.24, held: 0.8,
    hint: 'Heavy enough to break something open.',
  },
  crowbar: {
    name: 'Crowbar', sprite: 'item_crowbar', model: 'item_crowbar', scale: 0.26, held: 0.7,
    hint: 'For things that are stuck shut.',
  },
  screwdriver: {
    name: 'Screwdriver', sprite: 'item_screwdriver', model: 'item_screwdriver', scale: 0.18, held: 1.0,
    hint: 'Four screws hold a vent grate on.',
  },
  boltcutters: {
    name: 'Bolt Cutters', sprite: 'item_boltcutters', model: 'item_boltcutters', scale: 0.26, held: 0.7,
    hint: 'They will go through a chain.',
  },
  masterkey: {
    name: 'Master Key', sprite: 'item_masterkey', model: 'item_masterkey', scale: 0.17, held: 1.2,
    hint: 'Opens the door she keeps locked.',
  },
  padlockkey: {
    name: 'Padlock Key', sprite: 'item_key', model: 'item_key', scale: 0.17, held: 1.2,
    hint: 'Small. Brass. For the front door.',
  },
  cogwheel: {
    name: 'Cogwheel', sprite: 'item_cogwheel', model: 'item_cogwheel', scale: 0.2, held: 1.0,
    hint: 'Something by the front door is missing a gear.',
  },
  note: {
    name: 'Torn Note', sprite: 'item_note', model: 'item_note', scale: 0.16, held: 1.1,
    hint: 'Four digits, scratched in pencil.',
  },
  tranq: {
    name: 'Tranquilliser Gun', sprite: 'item_tranq', model: 'item_tranq', scale: 0.3, held: 0.55,
    hint: 'Needs a dart. [R] to fire.',
  },
  dart: {
    name: 'Dart', sprite: 'item_dart', model: 'item_dart', scale: 0.15, held: 1.1, stack: true,
    hint: 'Loads into the tranquilliser gun.',
  },
  beartrap: {
    name: 'Bear Trap', sprite: 'item_beartrap', model: 'item_beartrap', scale: 0.24, held: 0.7, stack: true,
    hint: 'Place it in a doorway and wait.',
  },
  battery: {
    name: 'Battery', sprite: 'item_battery', model: 'item_battery', scale: 0.15, held: 1.3, stack: true,
    hint: 'Your torch will want this eventually.',
  },
};

/* wall-mounted props: how high off the floor they hang, in world units */
const PROP_Y = {
  vent: 0.95, winch: 0.82,
};

/* furniture the player cannot simply walk through, and its radius.
   Anything missing here (rugs, stains, the sewer hatch) is walk-over. */
const PROP_BLOCK = {
  wardrobe: 0.44, bed: 0.55, sofa: 0.58, armchair: 0.4, table: 0.48, chair: 0.24,
  desk: 0.5, dresser: 0.4, shelfunit: 0.38, counter: 0.55, fridge: 0.34,
  boiler: 0.4, washer: 0.34, workbench: 0.62, toilet: 0.26, bathtub: 0.55,
  basin: 0.28, clock: 0.25, radiator: 0.3, crate: 0.34, crate_broken: 0.3,
  barrel: 0.27, cardboard: 0.27, safe: 0.34, lamp: 0.16, stairs: 0.5, ladder: 0.28,
};

const Inventory = {
  slots: [],          // [{item, qty}]
  max: 6,
  selected: 0,

  clear() { this.slots = []; this.selected = 0; },

  count(id) {
    const s = this.slots.find(s => s.item === id);
    return s ? s.qty : 0;
  },

  has(id) { return this.count(id) > 0; },

  add(id) {
    const def = ITEMS[id];
    if (!def) return false;
    if (def.stack) {
      const s = this.slots.find(s => s.item === id);
      if (s) { s.qty++; return true; }
    } else if (this.has(id)) {
      return true;                       // never carry two of a unique tool
    }
    if (this.slots.length >= this.max) return false;
    this.slots.push({ item: id, qty: 1 });
    return true;
  },

  remove(id, n) {
    const i = this.slots.findIndex(s => s.item === id);
    if (i < 0) return false;
    this.slots[i].qty -= (n || 1);
    if (this.slots[i].qty <= 0) {
      this.slots.splice(i, 1);
      if (this.selected >= this.slots.length) this.selected = Math.max(0, this.slots.length - 1);
    }
    return true;
  },

  current() { return this.slots[this.selected] || null; },

  select(i) { if (i >= 0 && i < this.slots.length) this.selected = i; },

  cycle(dir) {
    if (!this.slots.length) return;
    this.selected = (this.selected + dir + this.slots.length) % this.slots.length;
  },
};

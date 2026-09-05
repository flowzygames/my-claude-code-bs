/* ------------------------------------------------------------------ *
 *  items.js — what you can carry and what it is for.
 * ------------------------------------------------------------------ */
'use strict';

const ITEMS = {
  hammer: {
    name: 'Hammer', sprite: 'item_hammer', scale: 0.24,
    hint: 'Heavy enough to break something open.',
  },
  crowbar: {
    name: 'Crowbar', sprite: 'item_crowbar', scale: 0.26,
    hint: 'For things that are stuck shut.',
  },
  screwdriver: {
    name: 'Screwdriver', sprite: 'item_screwdriver', scale: 0.18,
    hint: 'Four screws hold a vent grate on.',
  },
  boltcutters: {
    name: 'Bolt Cutters', sprite: 'item_boltcutters', scale: 0.26,
    hint: 'They will go through a chain.',
  },
  masterkey: {
    name: 'Master Key', sprite: 'item_masterkey', scale: 0.17,
    hint: 'Opens the door she keeps locked.',
  },
  padlockkey: {
    name: 'Padlock Key', sprite: 'item_key', scale: 0.17,
    hint: 'Small. Brass. For the front door.',
  },
  cogwheel: {
    name: 'Cogwheel', sprite: 'item_cogwheel', scale: 0.2,
    hint: 'Something by the front door is missing a gear.',
  },
  note: {
    name: 'Torn Note', sprite: 'item_note', scale: 0.16,
    hint: 'Four digits, scratched in pencil.',
  },
  tranq: {
    name: 'Tranquilliser Gun', sprite: 'item_tranq', scale: 0.3,
    hint: 'Needs a dart. [R] to fire.',
  },
  dart: {
    name: 'Dart', sprite: 'item_dart', scale: 0.15, stack: true,
    hint: 'Loads into the tranquilliser gun.',
  },
  beartrap: {
    name: 'Bear Trap', sprite: 'item_beartrap', scale: 0.24, stack: true,
    hint: 'Place it in a doorway and wait.',
  },
  battery: {
    name: 'Battery', sprite: 'item_battery', scale: 0.15, stack: true,
    hint: 'Your torch will want this eventually.',
  },
};

/* world-sprite defaults for non-item entities */
const PROP_SCALE = {
  crate: 0.52, crate_broken: 0.26, safe: 0.58, hatch: 0.16,
  vent: 0.36, wardrobe: 1.15, bed: 0.4, winch: 0.4, blood: 0.45,
};

/* how far up the wall a prop hangs, in world units */
const PROP_YOFF = {
  vent: 0.55, winch: 0.45,
};

/* furniture the player cannot simply walk through, and its radius */
const PROP_BLOCK = {
  wardrobe: 0.5, bed: 0.62, safe: 0.45, crate: 0.45, crate_broken: 0.38,
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

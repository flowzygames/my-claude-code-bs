/* ------------------------------------------------------------------ *
 *  game.js — state, rules, input, HUD and the main loop.
 * ------------------------------------------------------------------ */
'use strict';

const Game = {
  levels: null,
  state: 'menu',            // menu | playing | paused | daybreak | end
  day: 1,
  maxDays: 5,
  elapsed: 0,
  traps: [],
  safeCode: '0000',
  flags: {},
  input: { keys: {}, mouseSens: 0.0022 },
  toastTimer: 0,
  heartCd: 0,
  light: { on: true, power: 1.25, ambientMul: 1, flicker: 1 },
  stats: { caught: 0, itemsFound: 0 },

  /* --------------------------------------------------------------- *
   *  boot
   * --------------------------------------------------------------- */
  init() {
    buildAllTextures();
    if (!Render.init(U.el('view'))) {
      document.body.innerHTML =
        '<p style="color:#a3231c;font:14px monospace;padding:40px">' +
        'This game needs WebGL, and this browser will not give it to us.</p>';
      return;
    }
    this.bindUI();
    this.bindInput();
    this.newWorld();
    this.loop(performance.now());
  },

  newWorld() {
    if (this.levels) World.disposeAll(GL.gl, this.levels);
    this.levels = buildWorld();
    // door lookup grid + a place to remember dropped items
    Object.values(this.levels).forEach(L => {
      L.doorGrid = [];
      for (let y = 0; y < L.h; y++) L.doorGrid.push(new Array(L.w).fill(null));
      L.doors.forEach(d => { L.doorGrid[d.y][d.x] = d; });
    });
    this.safeCode = String(U.randInt(1000, 9999));
    this.flags = { noteRead: false, winch: false, escaped: null };
    this.traps = [];
    this.day = 1;
    this.elapsed = 0;
    this.stats = { caught: 0, itemsFound: 0 };
    Inventory.clear();
    Player.reset(START);
    Player.battery = 1;
    Player.torchOn = true;
    Granny.reset(this.day);
    Render.buildWorld(this.levels);
  },

  startGame() {
    this.newWorld();
    this.state = 'playing';
    U.el('overlay').classList.add('hidden');
    U.el('hud').classList.remove('hidden');
    Sound.init();
    Sound.resume();
    Sound.setTension(0.55);
    this.showFloorName();
    this.toast('Day 1. She is somewhere downstairs.');
    this.requestLock();
  },

  /* --------------------------------------------------------------- *
   *  UI wiring
   * --------------------------------------------------------------- */
  bindUI() {
    U.el('btn-play').onclick = () => this.startGame();
    U.el('btn-howto').onclick = () => {
      U.el('overlay').classList.add('hidden');
      U.el('howto').classList.remove('hidden');
    };
    U.el('btn-back').onclick = () => {
      U.el('howto').classList.add('hidden');
      U.el('overlay').classList.remove('hidden');
    };
    U.el('btn-resume').onclick = () => this.resume();
    U.el('btn-quit').onclick = () => this.toMenu();
    U.el('btn-again').onclick = () => {
      U.el('endscreen').classList.add('hidden');
      this.startGame();
    };
    U.el('clickcatch').onclick = () => this.requestLock();
  },

  requestLock() {
    const c = U.el('view');
    if (c.requestPointerLock) c.requestPointerLock();
  },

  bindInput() {
    const k = this.input.keys;

    window.addEventListener('keydown', e => {
      if (e.code === 'Tab') e.preventDefault();
      if (k[e.code]) return;                    // ignore auto-repeat
      k[e.code] = true;
      this.onKey(e.code);
    });
    window.addEventListener('keyup', e => { k[e.code] = false; });
    window.addEventListener('blur', () => { for (const key in k) k[key] = false; });

    document.addEventListener('mousemove', e => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement !== U.el('view')) return;
      Player.look(e.movementX, e.movementY, this.input.mouseSens);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === U.el('view');
      U.el('clickcatch').classList.toggle('hidden', locked || this.state !== 'playing');
      if (!locked && this.state === 'playing') this.pause();
    });

    document.addEventListener('mousedown', e => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement !== U.el('view')) { this.requestLock(); return; }
      if (e.button === 0) this.interact();
      if (e.button === 2) this.fireTranq();
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      if (this.state !== 'playing') return;
      Inventory.cycle(e.deltaY > 0 ? 1 : -1);
      this.drawInventory();
    }, { passive: true });
  },

  onKey(code) {
    if (code === 'Escape') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      return;
    }
    if (this.state !== 'playing') return;

    if (code === 'KeyE') this.interact();
    if (code === 'KeyQ') this.dropSelected();
    if (code === 'KeyR') this.fireTranq();
    if (code === 'KeyF') {
      if (Player.battery <= 0) { Sound.deny(); this.toast('The torch is dead.'); }
      else { Player.torchOn = !Player.torchOn; Sound.click(); }
    }
    if (code.startsWith('Digit')) {
      const n = parseInt(code.slice(5), 10) - 1;
      if (n >= 0 && n < Inventory.max) { Inventory.select(n); this.drawInventory(); }
    }
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    U.el('pause').classList.remove('hidden');
    Sound.setTension(0.1);
    if (document.exitPointerLock) document.exitPointerLock();
  },

  resume() {
    U.el('pause').classList.add('hidden');
    this.state = 'playing';
    Sound.resume();
    Sound.setTension(0.55);
    this.requestLock();
  },

  toMenu() {
    this.state = 'menu';
    U.el('pause').classList.add('hidden');
    U.el('hud').classList.add('hidden');
    U.el('overlay').classList.remove('hidden');
    Sound.setTension(0);
  },

  /* --------------------------------------------------------------- *
   *  world helpers
   * --------------------------------------------------------------- */
  level() { return this.levels[Player.level]; },

  stairsFrom(from, to) {
    return this.levels[from].entities.find(e => e.kind === 'stairs' && e.to === to);
  },

  /** `byGranny` noises still play, but she must not investigate her own
   *  banging — otherwise every door she opens becomes a new distraction and
   *  she never gets anywhere. */
  makeNoise(x, y, level, power, kind, byGranny) {
    if (!byGranny) Granny.hear({ x, y, level, power, kind });
  },

  openDoor(door, byGranny) {
    if (door.locked && !byGranny) return false;
    door.open = !door.open;
    Sound.doorSlam();
    this.makeNoise(door.x + 0.5, door.y + 0.5, door.level, byGranny ? 3 : 9, 'door', byGranny);
    return true;
  },

  onSpotted() {
    this.toast('SHE SEES YOU. RUN.');
    Sound.setTension(1);
    U.el('damage').style.opacity = '0.5';
    setTimeout(() => { U.el('damage').style.opacity = '0'; }, 420);
  },

  /* --------------------------------------------------------------- *
   *  interaction
   * --------------------------------------------------------------- */

  /** What is the player looking at right now? */
  findTarget() {
    const L = this.level();
    if (Player.hiding) {
      return { type: 'hide', obj: Player.hiding, label: 'Climb out', key: 'E' };
    }

    let best = null, bestScore = 1e9;
    const cos = Math.cos(Player.ang), sin = Math.sin(Player.ang);

    for (const e of L.entities) {
      if (e.taken) continue;
      if (e.kind === 'prop') continue;
      const d = U.dist(Player.x, Player.y, e.x, e.y);
      const reach = e.kind === 'item' ? 1.7 : 2.3;
      if (d > reach) continue;
      const a = Math.abs(U.angleDiff(Player.ang, Math.atan2(e.y - Player.y, e.x - Player.x)));
      if (a > 1.15 && d > 0.8) continue;
      // now that the camera can pitch, staring at the ceiling should not pick
      // up the key by your feet — but keep the cone generous
      const elev = Math.atan2(((e.elev || PROP_Y[e.model] || 0) + 0.2) - Player.eyeY, Math.max(0.3, d));
      if (Math.abs(elev - Player.pitch) > 1.1) continue;
      const score = d + a * 0.8;
      if (score < bestScore) { bestScore = score; best = e; }
    }

    // doors are checked straight ahead rather than by proximity
    for (const step of [0.75, 1.25]) {
      const cx = (Player.x + cos * step) | 0, cy = (Player.y + sin * step) | 0;
      if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) continue;
      if (L.grid[cy][cx] === T.DOOR) {
        const d = L.doorGrid[cy][cx];
        if (d && bestScore > 1.1) {
          return {
            type: 'door', obj: d,
            label: d.locked && !this.canUnlock(d) ? `${d.label} — locked`
                 : d.locked ? `Unlock with the master key`
                 : d.open ? 'Close the door' : 'Open the door',
            key: 'E',
            locked: !!(d.locked && !this.canUnlock(d)),
          };
        }
      }
      if (L.grid[cy][cx] === T.EXIT) {
        const door = L.entities.find(e => e.kind === 'exit');
        if (door) return this.describe(door);
      }
    }

    if (best) return this.describe(best);

    // nothing in front — offer whatever is in your hand
    const cur = Inventory.current();
    if (cur && cur.item === 'beartrap') return { type: 'place', label: 'Set the bear trap', key: 'E' };
    if (cur && cur.item === 'battery' && Player.battery < 0.95)
      return { type: 'battery', label: 'Change the torch battery', key: 'E' };
    if (cur && cur.item === 'note')
      return { type: 'read', label: `Read the note`, key: 'E' };
    return null;
  },

  canUnlock(d) { return !d.locked || Inventory.has(d.locked); },

  describe(e) {
    switch (e.kind) {
      case 'item': {
        const def = ITEMS[e.item];
        return { type: 'entity', obj: e, label: `Take the ${def.name}`, key: 'E' };
      }
      case 'stairs':
        return { type: 'entity', obj: e, label: e.label, key: 'E' };
      case 'hide':
        return { type: 'entity', obj: e, label: e.spot === 'bed' ? 'Hide under the bed' : 'Hide in the wardrobe', key: 'E' };
      case 'container':
        return e.opened
          ? { type: 'entity', obj: e, label: 'Nothing left inside', key: 'E', locked: true }
          : { type: 'entity', obj: e, label: Inventory.has(e.needs) ? e.prompt : `${e.prompt} — you need a ${ITEMS[e.needs].name}`, key: 'E', locked: !Inventory.has(e.needs) };
      case 'vent':
        return e.opened
          ? { type: 'entity', obj: e, label: 'An empty air vent', key: 'E', locked: true }
          : { type: 'entity', obj: e, label: Inventory.has(e.needs) ? 'Unscrew the vent grate' : 'Vent grate — four screws', key: 'E', locked: !Inventory.has(e.needs) };
      case 'safe':
        return e.opened
          ? { type: 'entity', obj: e, label: 'The safe is empty', key: 'E', locked: true }
          : { type: 'entity', obj: e, label: this.flags.noteRead ? `Dial ${this.safeCode}` : 'A safe — it wants four digits', key: 'E', locked: !this.flags.noteRead };
      case 'winch':
        return this.flags.winch
          ? { type: 'entity', obj: e, label: 'The winch is fitted', key: 'E', locked: true }
          : { type: 'entity', obj: e, label: Inventory.has('cogwheel') ? 'Fit the cogwheel' : 'A winch with a missing gear', key: 'E', locked: !Inventory.has('cogwheel') };
      case 'hatch': {
        const ok = Inventory.has('crowbar') && Inventory.has('boltcutters');
        return { type: 'entity', obj: e,
          label: ok ? 'Cut the chain and prise it open'
               : Inventory.has('boltcutters') ? 'Chained shut — and rusted solid'
               : 'A chained sewer hatch',
          key: 'E', locked: !ok };
      }
      case 'exit': {
        const key = Inventory.has('padlockkey');
        const ok = key && this.flags.winch;
        return { type: 'entity', obj: e,
          label: ok ? 'Open the front door'
               : !key ? 'Padlocked front door'
               : 'The door will not lift — the winch has no gear',
          key: 'E', locked: !ok };
      }
    }
    return null;
  },

  interact() {
    const t = this.findTarget();
    if (!t) return;

    if (t.type === 'hide') { this.leaveHide(); return; }

    if (t.type === 'place') {
      this.traps.push({ x: Player.x, y: Player.y, level: Player.level, used: false });
      Inventory.remove('beartrap');
      Sound.trapSnap();
      this.toast('Bear trap armed.');
      this.drawInventory();
      return;
    }

    if (t.type === 'battery') {
      Inventory.remove('battery');
      Player.battery = 1;
      Player.torchOn = true;
      Sound.pickup();
      this.toast('Fresh battery. The beam steadies.');
      this.drawInventory();
      return;
    }

    if (t.type === 'read') { this.readNote(); return; }

    if (t.type === 'door') {
      const d = t.obj;
      if (d.locked) {
        const keyId = d.locked;
        if (Inventory.has(keyId)) {
          d.locked = null;
          Sound.unlock();
          this.toast(`The ${ITEMS[keyId].name} turns. It stays unlocked now.`);
          this.makeNoise(d.x + .5, d.y + .5, d.level, 5, 'lock');
        } else { Sound.deny(); this.toast('Locked. Something small and brass would help.'); }
        return;
      }
      this.openDoor(d, false);
      return;
    }

    if (t.locked) { Sound.deny(); return; }
    const e = t.obj;

    switch (e.kind) {
      case 'item': this.takeItem(e); break;

      case 'stairs': this.changeLevel(e); break;

      case 'hide': this.enterHide(e); break;

      case 'container':
        e.opened = true;                        // tools are never consumed
        Sound.smash();
        this.makeNoise(e.x, e.y, e.level, e.noise || 14, 'smash');
        this.giveItem(e.gives);
        this.toast('The crate splinters. That was loud.');
        break;

      case 'vent':
        e.opened = true;
        Sound.unlock();
        this.makeNoise(e.x, e.y, e.level, 5, 'work');
        this.giveItem(e.gives);
        this.toast('Behind the grate: a folded scrap of paper.');
        break;

      case 'safe':
        e.opened = true;
        Sound.unlock();
        this.makeNoise(e.x, e.y, e.level, 6, 'work');
        this.giveItem('padlockkey');
        this.toast('The safe swings open.');
        break;

      case 'winch':
        this.flags.winch = true;
        Inventory.remove('cogwheel');
        Sound.unlock();
        this.makeNoise(e.x, e.y, e.level, 8, 'work');
        this.toast('The gear bites. The door can lift now — if the padlock is off.');
        this.drawInventory();
        break;

      case 'hatch': this.escape('sewer'); break;

      case 'exit': this.escape('front'); break;
    }
    this.drawInventory();
  },

  takeItem(e) {
    if (!Inventory.add(e.item)) { Sound.deny(); this.toast('Your hands are full.'); return; }
    e.taken = true;
    this.stats.itemsFound++;
    Sound.pickup();
    const def = ITEMS[e.item];
    this.toast(`${def.name} — ${def.hint}`);
    if (e.item === 'note') this.readNote();
    this.drawInventory();
  },

  giveItem(id) {
    if (!id) return;
    if (!Inventory.add(id)) {
      // no room: drop it at your feet instead of destroying it
      this.level().entities.push({
        id: 'drop' + Math.random(), kind: 'item', item: id,
        level: Player.level, x: Player.x, y: Player.y,
      });
      this.toast(`${ITEMS[id].name} falls to the floor — your hands are full.`);
      return;
    }
    this.stats.itemsFound++;
    Sound.pickup();
    if (id === 'note') this.readNote();
  },

  readNote() {
    this.flags.noteRead = true;
    this.toast(`Scratched in pencil: ${this.safeCode}`);
  },

  dropSelected() {
    const cur = Inventory.current();
    if (!cur) return;
    const L = this.level();
    L.entities.push({
      id: 'drop' + Math.random(), kind: 'item', item: cur.item,
      level: Player.level,
      x: Player.x + Math.cos(Player.ang) * 0.6,
      y: Player.y + Math.sin(Player.ang) * 0.6,
    });
    Inventory.remove(cur.item);
    this.makeNoise(Player.x, Player.y, Player.level, 7, 'drop');
    Sound.step(0.4, true);
    this.drawInventory();
  },

  changeLevel(stair) {
    Player.level = stair.to;
    Player.x = stair.tx; Player.y = stair.ty;
    Player.vx = Player.vy = 0;
    Sound.creak();
    this.makeNoise(stair.tx, stair.ty, stair.to, 6, 'stairs');
    this.showFloorName();
  },

  enterHide(spot) {
    Player.hiding = spot;
    // sit inside the model: back of the wardrobe, or flat under the bed
    const back = spot.spot === 'wardrobe' ? -0.1 : 0;
    Player.x = spot.x + Math.cos(spot.face || 0) * back;
    Player.y = spot.y + Math.sin(spot.face || 0) * back;
    const inWardrobe = spot.spot === 'wardrobe';
    Player.hideEye = inWardrobe ? 0.82 : 0.2;
    Player.ang = spot.face || 0;
    if (inWardrobe) Sound.doorSlam(); else Sound.step(0.3, true);
    this.makeNoise(spot.x, spot.y, spot.level, inWardrobe ? 4 : 2, 'hide');
    this.toast(inWardrobe
      ? 'You pull the door shut and hold your breath.'
      : 'You slide underneath and go still.');
  },

  leaveHide() {
    const spot = Player.hiding;
    Player.hiding = null;
    Player.x = spot.x + Math.cos(spot.face || 0) * 0.95;
    Player.y = spot.y + Math.sin(spot.face || 0) * 0.95;
    Player.hideEye = 0;
    if (spot.spot === 'wardrobe') Sound.doorSlam(); else Sound.step(0.3, true);
    this.makeNoise(Player.x, Player.y, Player.level, 4, 'hide');
  },

  fireTranq() {
    if (!Inventory.has('tranq')) { return; }
    if (!Inventory.has('dart')) { Sound.deny(); this.toast('No darts left.'); return; }
    Inventory.remove('dart');
    Player.firing = 0.25;
    Sound.gunshot();
    this.makeNoise(Player.x, Player.y, Player.level, 20, 'shot');
    this.drawInventory();

    if (Granny.level === Player.level) {
      const d = U.dist(Player.x, Player.y, Granny.x, Granny.y);
      const a = Math.abs(U.angleDiff(Player.ang, Math.atan2(Granny.y - Player.y, Granny.x - Player.x)));
      if (d < 14 && a < 0.16 && Path.lineOfSight(this.level(), Player.x, Player.y, Granny.x, Granny.y)) {
        Granny.stun(20);
        this.toast('The dart lands. She folds up on the floor.');
        return;
      }
    }
    this.toast('The dart clatters off into the dark.');
  },

  /* --------------------------------------------------------------- *
   *  day cycle
   * --------------------------------------------------------------- */
  caught() {
    if (this.state !== 'playing') return;
    this.state = 'daybreak';
    this.stats.caught++;
    Sound.caught();
    Sound.setTension(0.2);
    if (document.exitPointerLock) document.exitPointerLock();

    // whatever you were carrying is scattered where she got you
    const L = this.levels[Player.level];
    const carried = Inventory.slots.slice();
    carried.forEach((s, i) => {
      for (let n = 0; n < s.qty; n++) {
        L.entities.push({
          id: 'lost' + Math.random(), kind: 'item', item: s.item, level: Player.level,
          x: U.clamp(Player.x + U.rand(-0.8, 0.8), 1.5, L.w - 1.5),
          y: U.clamp(Player.y + U.rand(-0.8, 0.8), 1.5, L.h - 1.5),
        });
      }
    });
    Inventory.clear();

    const dead = this.day >= this.maxDays;
    const dayEl = U.el('dayscreen');
    U.el('daycard-title').textContent = dead ? '' : `DAY ${this.day + 1}`;
    U.el('daycard-sub').textContent = dead ? '' :
      U.pick([
        'She dragged you back to the bedroom.',
        'You wake up on the mattress again. Everything hurts.',
        'The door clicks shut. Try again.',
        'Somewhere below, she is humming.',
      ]);
    dayEl.classList.remove('hidden');

    setTimeout(() => {
      dayEl.classList.add('hidden');
      if (dead) { this.endGame(false); return; }
      this.day++;
      Player.reset(START);
      Player.battery = Math.max(0.25, Player.battery);
      Player.torchOn = true;
      Granny.reset(this.day);
      this.traps = [];
      this.state = 'playing';
      Sound.setTension(0.55);
      this.updateHUD();
      this.showFloorName();
      this.requestLock();
    }, dead ? 1600 : 2600);
  },

  escape(route) {
    this.flags.escaped = route;
    this.state = 'end';
    Sound.escapeFanfare();
    Sound.setTension(0);
    if (document.exitPointerLock) document.exitPointerLock();
    this.endGame(true);
  },

  endGame(won) {
    U.el('hud').classList.add('hidden');
    const t = U.el('end-title'), s = U.el('end-sub');
    t.textContent = won ? 'YOU GOT OUT' : 'SHE KEPT YOU';
    t.style.color = won ? '#b7c19a' : '#a3231c';
    s.textContent = won
      ? (this.flags.escaped === 'sewer'
          ? 'Down through the drain and out under the garden.'
          : 'The front door lifts. Cold air. Grass.')
      : 'Day five ended the way the other four did.';
    const mins = Math.floor(this.elapsed / 60), secs = Math.floor(this.elapsed % 60);
    U.el('end-stats').innerHTML =
      `DAYS USED &nbsp;${this.day} / ${this.maxDays}<br>` +
      `TIMES CAUGHT &nbsp;${this.stats.caught}<br>` +
      `ITEMS FOUND &nbsp;${this.stats.itemsFound}<br>` +
      `TIME &nbsp;${mins}m ${String(secs).padStart(2, '0')}s`;
    U.el('endscreen').classList.remove('hidden');
    this.state = 'end';
  },

  /* --------------------------------------------------------------- *
   *  HUD
   * --------------------------------------------------------------- */
  toast(msg) {
    const el = U.el('toast');
    el.textContent = msg;
    el.classList.add('show');
    this.toastTimer = 3.4;
  },

  showFloorName() {
    const el = U.el('floorname');
    el.textContent = this.level().name;
    el.style.opacity = '1';
    clearTimeout(this._floorT);
    this._floorT = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  },

  drawInventory() {
    const box = U.el('inventory');
    box.innerHTML = '';
    for (let i = 0; i < Inventory.max; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === Inventory.selected ? ' active' : '');
      const s = Inventory.slots[i];
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = i + 1;
      slot.appendChild(num);
      if (s) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 48;
        const g = cv.getContext('2d');
        g.drawImage(SPR[ITEMS[s.item].sprite].canvas, 0, 0, 48, 48);
        slot.appendChild(cv);
        if (s.qty > 1) {
          const q = document.createElement('span');
          q.className = 'qty'; q.textContent = '×' + s.qty;
          slot.appendChild(q);
        }
        slot.title = ITEMS[s.item].name;
      }
      box.appendChild(slot);
    }
  },

  objectiveText() {
    if (Inventory.has('padlockkey') && this.flags.winch) return 'The front door is ready. Get out.';
    if (Inventory.has('crowbar') && Inventory.has('boltcutters')) return 'The sewer hatch, in the basement storage room.';
    if (Inventory.has('cogwheel')) return 'Fit the cogwheel to the winch by the front door.';
    if (Inventory.has('padlockkey')) return 'Padlock done. The winch still needs a gear.';
    if (this.flags.noteRead && !this.levels.ground.entities.find(e => e.kind === 'safe').opened)
      return `Safe in the study: ${this.safeCode}.`;
    if (Inventory.has('screwdriver')) return 'Something is hidden behind a vent grate upstairs.';
    if (Inventory.has('hammer')) return 'That crate in the garage will not open by hand.';
    if (Inventory.has('masterkey')) return 'Her bedroom is the locked one upstairs.';
    return 'Find a way out. There are two.';
  },

  updateHUD() {
    U.el('day').innerHTML = `DAY ${this.day} <span class="of">/ ${this.maxDays}</span>`;
    U.el('objective').textContent = this.objectiveText();
    U.el('staminabar').style.width = (Player.stamina * 100) + '%';
    U.el('staminabar').style.background = Player.exhausted ? '#a3231c' : '#9fae86';
    U.el('noisebar').style.width = (Player.noise * 100) + '%';
  },

  updatePrompt() {
    const el = U.el('prompt');
    const t = this.findTarget();
    if (!t) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.classList.toggle('locked', !!t.locked);
    el.innerHTML = `<b>${t.key}</b>${t.label}`;
  },

  /* --------------------------------------------------------------- *
   *  frame
   * --------------------------------------------------------------- */
  loop(now) {
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
    this._last = now;
    requestAnimationFrame(t => this.loop(t));

    if (this.state === 'playing') this.step(dt);
    this.draw(dt);
  },

  step(dt) {
    this.elapsed += dt;
    const L = this.level();

    Player.update(dt, this.input, L, this);
    Granny.update(dt, this);

    // door animations
    Object.values(this.levels).forEach(lv => {
      lv.doors.forEach(d => {
        const want = d.open ? 1 : 0;
        d.anim += U.clamp(want - d.anim, -dt * 3.4, dt * 3.4);
      });
    });

    // has she got you?
    if (Granny.level === Player.level && Granny.state !== 'stunned' && Granny.state !== 'trapped') {
      const d = U.dist(Granny.x, Granny.y, Player.x, Player.y);
      if (Player.hiding) {
        if (Granny.knowsHideSpot === Player.hiding && d < 1.3) this.caught();
      } else if (d < 0.72) {
        this.caught();
      }
    }

    // tension, heartbeat, torch flicker
    const near = Granny.level === Player.level
      ? U.dist(Granny.x, Granny.y, Player.x, Player.y) : 99;
    const danger = Granny.state === 'chase' ? 1 : U.clamp(1 - (near - 3) / 9, 0, 1);
    Sound.setTension(0.35 + danger * 0.65);
    U.el('heartbeat').style.boxShadow =
      `inset 0 0 ${120 + danger * 90}px ${20 + danger * 60}px rgba(110,0,0,${danger * 0.34})`;

    this.heartCd -= dt;
    if (danger > 0.35 && this.heartCd <= 0) {
      Sound.heartbeat(danger);
      this.heartCd = U.lerp(1.1, 0.5, danger);
    }

    Render.fov = U.lerp(Render.fov, Player.sprinting ? 1.28 : 1.15, Math.min(1, dt * 4));

    const locked = document.pointerLockElement === U.el('view');
    U.el('clickcatch').classList.toggle('hidden', locked);

    this.light.on = Player.torchOn && Player.battery > 0;
    this.light.power = 1.25 * (Player.battery > 0.18 ? 1 : 0.55 + Math.random() * 0.3);
    this.light.flicker = 0.94 + Math.random() * 0.09;
    this.light.ambientMul = Granny.state === 'chase' ? 1.25 : 1;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) U.el('toast').classList.remove('show');
    }

    this.updateHUD();
    this.updatePrompt();
    if (!this._invDrawn) { this.drawInventory(); this._invDrawn = true; }
  },

  /** Everything on the player's floor that isn't part of the building. */
  gatherScene() {
    const L = this.level();
    const out = [];
    const t = this.elapsed;

    for (const e of L.entities) {
      if (e.taken) continue;

      if (e.kind === 'item') {
        const def = ITEMS[e.item];
        const elev = e.elev || 0;
        out.push({
          model: def.model, x: e.x, z: e.y,
          y: 0.13 + elev + Math.sin(t * 1.7 + e.x * 3) * 0.012,
          yaw: t * 0.7 + e.x,
          emissive: 0.15,
          shadow: elev ? 0 : 0.14,
        });
        continue;
      }

      if (!e.model) continue;
      const model = (e.opened && e.openModel) ? e.openModel : e.model;
      const block = PROP_BLOCK[model];
      out.push({
        model, x: e.x, z: e.y,
        y: PROP_Y[model] || 0,
        yaw: e.face || 0,
        shadow: block ? block * 0.95 : 0,
      });
      // the cog, once you have fitted it
      if (e.kind === 'winch' && this.flags.winch) {
        out.push({ model: 'winchcog', x: e.x, z: e.y, y: (PROP_Y.winch || 0) + 0.02, yaw: e.face || 0 });
      }
    }

    for (const trap of this.traps) {
      if (trap.level !== Player.level || trap.used) continue;
      out.push({ model: 'item_beartrap', x: trap.x, z: trap.y, y: 0.02, yaw: 0.4 });
    }

    if (Granny.level === Player.level) {
      const chasing = Granny.state === 'chase';
      let headYaw = 0;
      if (chasing || Granny.state === 'search') {
        const toPlayer = Math.atan2(Player.y - Granny.y, Player.x - Granny.x);
        headYaw = U.clamp(U.angleDiff(Granny.ang, toPlayer), -0.8, 0.8);
      }
      const mode = (Granny.state === 'stunned' || Granny.state === 'trapped') ? 'stunned'
                 : chasing ? 'chase' : 'walk';
      out.push({
        parts: GrannyRig.pose(Granny.x, Granny.y, Granny.ang, Granny.anim, mode, headYaw),
        x: Granny.x, z: Granny.y,
        shadow: 0.3,
        rim: chasing ? 0.95 : 0.6,
      });
    }
    return out;
  },

  draw(dt) {
    if (this.state === 'menu') {
      // idle backdrop: a slow drift down the hall towards the front door
      const t = performance.now() / 1000;
      const L = this.levels.ground;
      Render.frame({
        x: 14.5, y: 1.05 + Math.sin(t * 0.4) * 0.02,
        z: 13.5 + Math.sin(t * 0.11) * 3.4,
        yaw: Math.PI / 2 + Math.sin(t * 0.07) * 0.22,
        pitch: Math.sin(t * 0.09) * 0.05,
      }, L, [], { on: true, power: 1.1, ambientMul: 1, flicker: 0.94 + Math.random() * 0.08 }, dt);
      return;
    }

    const cam = Player.camera(dt);
    const cur = Inventory.current();
    this.light.held = (cur && !Player.hiding) ? ITEMS[cur.item].model : null;
    this.light.heldBob = Player.bob * 2;
    this.light.heldScale = cur ? (ITEMS[cur.item].held || 0.7) : 0.7;
    this.light.heldFire = Player.firing > 0;
    Render.frame(cam, this.level(), this.gatherScene(), this.light, dt);
  },
};

window.addEventListener('load', () => Game.init());

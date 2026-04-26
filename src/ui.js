// UI: builds and manages the 300px left side panel.
// Owns DOM, exposes `params` (read by main.js), and forwards user actions
// via `app.*` callbacks.
class UI {
  constructor(app) {
    this.app = app;
    this.params = {
      // network / training
      rayCount: 9,
      hiddenLayers: '16',
      neuronsPerLayer: 16,
      activation: 'sigmoid',
      population: 100,
      mutationRate: 0.1,
      simSpeed: 1,
      lookahead: 2,
      separation: true,
      stopType: 'never',
      stopThreshold: 50,
      // fitness weights
      wCheckpoints: 1.0,
      wTime: 0.001,
      wCollisions: 5.0,
      // training options
      autoNewTrackEachGen: true
    };
    this.panel = document.getElementById('ui-panel');
    this.modeButtons = {};
    this._build();
  }

  _build() {
    this.panel.innerHTML = '';
    this._addTitle();
    this._addModeSwitcher();
    this._addTrainingControls();
    this._addNetworkControls();
    this._addFitnessControls();
    this._addStopConditionControls();
    this._addStats();
    this._addBrainLibrary();
    this._addTrackLibrary();
    this._addRaceControls();
    this._addGestureControls();
  }

  _addTitle() {
    const s = this._section('AI Racing League');
    const sub = document.createElement('div');
    sub.style.fontSize = '10px';
    sub.style.color = '#888';
    sub.textContent = 'Neural networks evolved with a GA';
    s.appendChild(sub);
  }

  _addModeSwitcher() {
    const s = this._section('Mode');
    const wrap = document.createElement('div');
    wrap.className = 'mode-buttons';
    ['training', 'editor', 'race'].forEach(m => {
      const b = document.createElement('button');
      b.textContent = m[0].toUpperCase() + m.slice(1);
      b.onclick = () => this.app.setMode(m);
      wrap.appendChild(b);
      this.modeButtons[m] = b;
    });
    s.appendChild(wrap);
  }

  setActiveMode(mode) {
    Object.entries(this.modeButtons).forEach(([k, b]) => {
      b.classList.toggle('active', k === mode);
    });
  }

  _addTrainingControls() {
    const s = this._section('Training');
    const row = document.createElement('div');
    row.className = 'mode-buttons';
    const playBtn = this._btn('Pause', () => this.app.togglePause());
    this.playBtn = playBtn;
    const skipBtn = this._btn('Skip Gen', () => this.app.skipGeneration());
    const resetBtn = this._btn('Reset', () => this.app.resetTraining());
    row.appendChild(playBtn);
    row.appendChild(skipBtn);
    row.appendChild(resetBtn);
    s.appendChild(row);

    this._slider(s, 'simSpeed', 'Sim speed', 1, 20, 1);
    this._slider(s, 'population', 'Population', 10, 300, 10, () => this.app.requestPopulationChange());

    const cb = this._checkbox(s, 'autoNewTrackEachGen', 'New track every gen');
  }

  _addNetworkControls() {
    const s = this._section('Network');
    this._slider(s, 'rayCount', 'Rays', 3, 21, 1);
    this._slider(s, 'lookahead', 'Waypoint lookahead', 0, 5, 1);

    // Hidden layers — allow comma-separated string, e.g. "16,8".
    const row = this._row(s, 'Hidden layers');
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = this.params.hiddenLayers;
    inp.oninput = () => { this.params.hiddenLayers = inp.value; };
    row.appendChild(inp);

    const actRow = this._row(s, 'Activation');
    const sel = document.createElement('select');
    ['sigmoid', 'tanh', 'relu', 'elu'].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (opt === this.params.activation) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { this.params.activation = sel.value; };
    actRow.appendChild(sel);

    this._slider(s, 'mutationRate', 'Mutation rate', 0.01, 0.5, 0.01);

    this._checkbox(s, 'separation', 'Separation behavior');
  }

  _addFitnessControls() {
    const s = this._section('Fitness weights');
    this._slider(s, 'wCheckpoints', 'Checkpoint weight', 0, 5, 0.1);
    this._slider(s, 'wTime', 'Time penalty', 0, 0.05, 0.001);
    this._slider(s, 'wCollisions', 'Collision penalty', 0, 20, 0.5);
  }

  _addStopConditionControls() {
    const s = this._section('Stop condition');
    const row = this._row(s, 'Type');
    const sel = document.createElement('select');
    [
      ['never', 'Never'],
      ['generations', 'Generations'],
      ['avgFitness', 'Avg fitness'],
      ['lapPercent', '% completed lap']
    ].forEach(([v, label]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      if (v === this.params.stopType) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { this.params.stopType = sel.value; };
    row.appendChild(sel);

    this._slider(s, 'stopThreshold', 'Threshold', 1, 200, 1);
  }

  _addStats() {
    const s = this._section('Stats');
    const div = document.createElement('div');
    div.className = 'stats';
    div.innerHTML = `
      <div><span>Mode</span><span id="stat-mode">-</span></div>
      <div><span>Generation</span><span id="stat-gen">0</span></div>
      <div><span>Alive</span><span id="stat-alive">0</span></div>
      <div><span>Best fitness</span><span id="stat-best">0</span></div>
      <div><span>Avg fitness</span><span id="stat-avg">0</span></div>
      <div><span>Lap %</span><span id="stat-lap">0%</span></div>`;
    s.appendChild(div);
  }

  updateStats(stats) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-mode', stats.mode || '-');
    set('stat-gen', stats.generation || 0);
    set('stat-alive', stats.alive || 0);
    set('stat-best', (stats.bestFitness || 0).toFixed(2));
    set('stat-avg', (stats.avgFitness || 0).toFixed(3));
    set('stat-lap', (stats.lapCompletionPercent || 0).toFixed(0) + '%');
  }

  _addBrainLibrary() {
    const s = this._section('Brain library');
    const row = document.createElement('div');
    row.className = 'mode-buttons';
    row.appendChild(this._btn('Save best', () => this.app.saveBestBrain()));
    row.appendChild(this._btn('Import', () => Storage.importBrain(() => this.refreshLibraries())));
    s.appendChild(row);
    this.brainList = document.createElement('div');
    s.appendChild(this.brainList);
  }

  _addTrackLibrary() {
    const s = this._section('Track library');
    const row = document.createElement('div');
    row.className = 'mode-buttons';
    row.appendChild(this._btn('Save current', () => this.app.saveCurrentTrack()));
    row.appendChild(this._btn('Import', () => Storage.importTrack(() => this.refreshLibraries())));
    row.appendChild(this._btn('Random', () => this.app.randomTrack()));
    s.appendChild(row);
    this.trackList = document.createElement('div');
    s.appendChild(this.trackList);
  }

  _addRaceControls() {
    const s = this._section('Race');
    const info = document.createElement('div');
    info.style.fontSize = '10px';
    info.style.color = '#888';
    info.textContent = 'Pick brains in the library, choose a track, then start.';
    s.appendChild(info);
    const row = document.createElement('div');
    row.className = 'mode-buttons';
    row.appendChild(this._btn('Start race', () => this.app.startRace()));
    row.appendChild(this._btn('Stop race', () => this.app.stopRace()));
    s.appendChild(row);
    this.leaderboard = document.createElement('div');
    this.leaderboard.className = 'leaderboard';
    s.appendChild(this.leaderboard);
  }

  _addGestureControls() {
    const s = this._section('Gesture control');
    const row = document.createElement('div');
    row.className = 'mode-buttons';
    row.appendChild(this._btn('Enable', () => this.app.enableGestures()));
    row.appendChild(this._btn('Disable', () => this.app.disableGestures()));
    s.appendChild(row);
    this.gestureStatus = document.createElement('div');
    this.gestureStatus.className = 'gesture-status';
    this.gestureStatus.textContent = 'Inactive';
    s.appendChild(this.gestureStatus);
    const help = document.createElement('div');
    help.style.fontSize = '10px';
    help.style.color = '#666';
    help.style.marginTop = '4px';
    help.innerHTML = 'Open palm: pause<br>Fist: skip generation<br>Index L↔R: speed<br>OK sign: save best';
    s.appendChild(help);
  }

  setGestureStatus(text) {
    if (this.gestureStatus) this.gestureStatus.textContent = text;
  }

  refreshLibraries() {
    if (this.brainList) {
      this.brainList.innerHTML = '';
      const brains = Storage.listBrains();
      if (brains.length === 0) {
        this.brainList.innerHTML = '<div style="color:#666;font-size:10px;">No saved brains.</div>';
      }
      for (const name of brains) {
        const item = document.createElement('div');
        item.className = 'list-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.brain = name;
        const n = document.createElement('span');
        n.className = 'name';
        n.textContent = name;
        const exp = document.createElement('button');
        exp.textContent = '↓';
        exp.title = 'Export';
        exp.onclick = () => Storage.exportBrain(name);
        const del = document.createElement('button');
        del.textContent = '×';
        del.onclick = () => { Storage.deleteBrain(name); this.refreshLibraries(); };
        item.appendChild(cb);
        item.appendChild(n);
        item.appendChild(exp);
        item.appendChild(del);
        this.brainList.appendChild(item);
      }
    }
    if (this.trackList) {
      this.trackList.innerHTML = '';
      const tracks = Storage.listTracks();
      if (tracks.length === 0) {
        this.trackList.innerHTML = '<div style="color:#666;font-size:10px;">No saved tracks.</div>';
      }
      for (const name of tracks) {
        const item = document.createElement('div');
        item.className = 'list-item';
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = 'trackPick';
        r.dataset.track = name;
        const n = document.createElement('span');
        n.className = 'name';
        n.textContent = name;
        const load = document.createElement('button');
        load.textContent = '→';
        load.title = 'Load into editor / training';
        load.onclick = () => this.app.loadTrack(name);
        const exp = document.createElement('button');
        exp.textContent = '↓';
        exp.onclick = () => Storage.exportTrack(name);
        const del = document.createElement('button');
        del.textContent = '×';
        del.onclick = () => { Storage.deleteTrack(name); this.refreshLibraries(); };
        item.appendChild(r);
        item.appendChild(n);
        item.appendChild(load);
        item.appendChild(exp);
        item.appendChild(del);
        this.trackList.appendChild(item);
      }
    }
  }

  getSelectedBrains() {
    if (!this.brainList) return [];
    return Array.from(this.brainList.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.dataset.brain);
  }

  getSelectedTrack() {
    if (!this.trackList) return null;
    const r = this.trackList.querySelector('input[type="radio"]:checked');
    return r ? r.dataset.track : null;
  }

  updateLeaderboard(rows) {
    if (!this.leaderboard) return;
    if (!rows || rows.length === 0) {
      this.leaderboard.innerHTML = '<div style="color:#666;">No race running.</div>';
      return;
    }
    this.leaderboard.innerHTML = '';
    rows.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'row' + (i === 0 ? ' top' : '');
      const c = r.color;
      div.innerHTML = `<span><span style="color:rgb(${c[0]},${c[1]},${c[2]})">●</span> ${i + 1}. ${r.name}${r.dead ? ' †' : ''}</span><span>L${r.laps} · ${r.checkpoints}</span>`;
      this.leaderboard.appendChild(div);
    });
  }

  setPaused(paused) {
    if (this.playBtn) this.playBtn.textContent = paused ? 'Resume' : 'Pause';
  }

  // ----- helpers -----
  _section(title) {
    const s = document.createElement('div');
    s.className = 'ui-section';
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title;
      s.appendChild(h);
    }
    this.panel.appendChild(s);
    return s;
  }

  _row(parent, labelText) {
    const r = document.createElement('div');
    r.className = 'ui-row';
    const l = document.createElement('label');
    l.textContent = labelText;
    r.appendChild(l);
    parent.appendChild(r);
    return r;
  }

  _slider(parent, key, label, min, max, step, onChange) {
    const r = this._row(parent, label);
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = min; inp.max = max; inp.step = step;
    inp.value = this.params[key];
    const val = document.createElement('span');
    val.className = 'value';
    val.textContent = this.params[key];
    inp.oninput = () => {
      this.params[key] = parseFloat(inp.value);
      val.textContent = (step < 1) ? this.params[key].toFixed(3) : this.params[key];
      if (onChange) onChange();
    };
    r.appendChild(inp);
    r.appendChild(val);
  }

  _checkbox(parent, key, label) {
    const r = this._row(parent, label);
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!this.params[key];
    inp.onchange = () => { this.params[key] = inp.checked; };
    r.appendChild(inp);
    return inp;
  }

  _btn(text, onClick) {
    const b = document.createElement('button');
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }

  showModal(title, message, actions) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    const m = document.createElement('div');
    m.className = 'modal';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = message;
    const acts = document.createElement('div');
    acts.className = 'actions';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.primary) b.className = 'primary';
      b.onclick = () => { document.body.removeChild(bg); a.onClick && a.onClick(); };
      acts.appendChild(b);
    });
    m.appendChild(h);
    m.appendChild(p);
    m.appendChild(acts);
    bg.appendChild(m);
    document.body.appendChild(bg);
  }

  promptName(title, defaultName) {
    return prompt(title, defaultName || '');
  }

  // Read network params as a normalized config object for RacingVehicle.
  vehicleConfigFromUI() {
    const layers = this.params.hiddenLayers
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0);
    return {
      rayCount: this.params.rayCount,
      lookahead: this.params.lookahead,
      separation: this.params.separation,
      hiddenLayers: layers.length ? layers : [16],
      activation: this.params.activation,
      fitnessWeights: {
        checkpoints: this.params.wCheckpoints,
        time: this.params.wTime,
        collisions: this.params.wCollisions
      }
    };
  }
}

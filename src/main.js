// main.js — orchestration. Loaded last; redeclares setup() and draw() so they
// override the originals in src/sketch.js. Also owns mode state, GA loop,
// editor input, and gesture wiring.
//
// Original-side globals we reuse from src/sketch.js (declared with `let`):
//   walls, checkpoints, inside, outside, start, end, population, savedVehicles,
//   generationCount

let app = null;
let obstacles = [];

class App {
  constructor() {
    this.mode = 'training';
    this.paused = false;
    this.ui = null;
    this.editor = null;
    this.race = null;
    this.gestures = null;
    this.stopCondition = new StopCondition('never', 0);
    this.lastBest = null;
    this.bestFitnessEver = 0;
    this.lapCompletionPercent = 0;
    this.stoppedByCondition = false;
  }

  setMode(m) {
    if (this.mode === m) return;
    this.mode = m;
    if (m !== 'race') this.race && this.race.stop();
    if (m === 'training') {
      // Make sure we have a population.
      if (population.length === 0 && savedVehicles.length === 0) {
        this.resetTraining();
      }
    }
    if (m === 'race') {
      // Don't auto-start; user clicks "Start race".
    }
    this.ui.setActiveMode(m);
  }

  togglePause() {
    this.paused = !this.paused;
    this.ui.setPaused(this.paused);
  }

  // ---- training control ----
  resetTraining() {
    // Dispose existing vehicles' brains.
    for (const v of population) v.dispose && v.dispose();
    for (const v of savedVehicles) v.dispose && v.dispose();
    population.length = 0;
    savedVehicles.length = 0;
    generationCount = 0;
    this.bestFitnessEver = 0;
    this.lapCompletionPercent = 0;
    this.stoppedByCondition = false;
    this._spawnPopulation();
  }

  _spawnPopulation(seedBrain) {
    const cfg = this.ui.vehicleConfigFromUI();
    const N = this.ui.params.population;
    for (let i = 0; i < N; i++) {
      const v = new RacingVehicle(seedBrain || null, cfg);
      population.push(v);
    }
  }

  requestPopulationChange() {
    // Apply on next generation; show a hint.
    // (Avoids disposing alive vehicles mid-run.)
  }

  skipGeneration() {
    // Mark every alive vehicle as dead so the next-gen branch fires.
    for (const v of population) v.dead = true;
  }

  saveBestBrain() {
    // Pick the best vehicle currently known.
    let best = this.lastBest;
    if (!best) {
      const all = population.concat(savedVehicles);
      for (const v of all) {
        if (!best || (v.fitness || 0) > (best.fitness || 0)) best = v;
      }
    }
    if (!best || !best.brain) {
      alert('No brain available to save yet.');
      return;
    }
    const name = this.ui.promptName('Save brain as:', 'brain_gen' + generationCount);
    if (!name) return;
    Storage.saveBrain(name, best.brain, {
      generation: generationCount,
      fitness: best.fitness,
      checkpoints: best.checkpointsPassed,
      laps: best.lapsCompleted,
      rayCount: best.config.rayCount,
      lookahead: best.config.lookahead,
      hiddenLayers: best.config.hiddenLayers,
      activation: best.config.activation
    });
    this.ui.refreshLibraries();
  }

  // ---- track control ----
  saveCurrentTrack() {
    if (!this.editor || this.editor.points.length < 3) {
      alert('Open the editor and add at least 3 control points first.');
      return;
    }
    const name = this.ui.promptName('Save track as:', 'track_' + Date.now());
    if (!name) return;
    Storage.saveTrack(name, this.editor.toJSON());
    this.ui.refreshLibraries();
  }

  loadTrack(name) {
    const data = Storage.loadTrack(name);
    if (!data) return;
    this.editor = TrackEditor.fromJSON(data);
    this._applyEditorTrack();
    if (this.mode === 'training') this.resetTraining();
  }

  randomTrack() {
    // Use the original procedural builder.
    buildTrack();
    obstacles = [];
    if (this.mode === 'training') this.resetTraining();
  }

  _applyEditorTrack() {
    if (!this.editor || !this.editor.preview) return;
    const t = this.editor.preview;
    walls = t.walls.slice();
    checkpoints = t.checkpoints.slice();
    inside = t.inside.slice();
    outside = t.outside.slice();
    start = t.start;
    end = t.end;
    // Re-add obstacle walls.
    for (const o of obstacles) walls = walls.concat(o.walls);
  }

  addObstacle(x, y, r) {
    const o = new Obstacle(x, y, r || 30, 16);
    obstacles.push(o);
    walls = walls.concat(o.walls);
  }

  // ---- race ----
  startRace() {
    const names = this.ui.getSelectedBrains();
    if (names.length === 0) { alert('Tick at least one brain in the library.'); return; }
    const trackName = this.ui.getSelectedTrack();
    if (trackName) {
      this.loadTrack(trackName);
    }
    this.setMode('race');
    this.race.start(names, null, this.ui.vehicleConfigFromUI());
  }

  stopRace() {
    if (this.race) this.race.stop();
  }

  // ---- gestures ----
  enableGestures() { this.gestures && this.gestures.enable(); }
  disableGestures() { this.gestures && this.gestures.disable(); }
  setSimSpeed(v) { this.ui.params.simSpeed = v; }
}

// Custom roulette pickOne — uses RacingVehicle and UI mutation rate.
// Replaces the global `pickOne` from ga.js (we don't call it).
function pickOneRacing() {
  let index = 0;
  let r = random(1);
  while (r > 0 && index < savedVehicles.length) {
    r = r - savedVehicles[index].fitness;
    index++;
  }
  index = Math.max(0, index - 1);
  const parent = savedVehicles[index];
  const child = new RacingVehicle(parent.brain, app.ui.vehicleConfigFromUI());
  child.brain.mutate(app.ui.params.mutationRate);
  return child;
}

function nextGenerationRacing() {
  // Calculate fitness for all dead vehicles.
  for (const v of savedVehicles) v.calculateFitness();

  // Compute stats BEFORE normalization (for UI / stop condition).
  let sum = 0;
  let best = 0;
  let lapped = 0;
  for (const v of savedVehicles) {
    sum += v.fitness;
    if (v.fitness > best) best = v.fitness;
    if (v.lapsCompleted > 0) lapped++;
  }
  const avg = savedVehicles.length ? sum / savedVehicles.length : 0;
  app.bestFitnessEver = Math.max(app.bestFitnessEver, best);
  app.lapCompletionPercent = savedVehicles.length
    ? (lapped / savedVehicles.length) * 100
    : 0;

  // Normalize for roulette.
  if (sum > 0) for (const v of savedVehicles) v.fitness = v.fitness / sum;

  // Build the new population.
  const N = app.ui.params.population;
  const newPop = [];
  for (let i = 0; i < N; i++) newPop.push(pickOneRacing());

  // Dispose old.
  for (const v of savedVehicles) v.dispose();
  savedVehicles.length = 0;
  for (const v of population) v.dispose();
  population.length = 0;
  for (const v of newPop) population.push(v);

  generationCount++;

  // Optional new track per generation.
  if (app.ui.params.autoNewTrackEachGen && (!app.editor || !app.editor.preview)) {
    buildTrack();
    // re-add obstacles
    for (const o of obstacles) walls = walls.concat(o.walls);
  } else if (app.editor && app.editor.preview) {
    app._applyEditorTrack();
  }

  // Stop condition?
  if (!app.stoppedByCondition && app.stopCondition.shouldStop({
    generation: generationCount,
    avgFitness: avg,
    lapCompletionPercent: app.lapCompletionPercent
  })) {
    app.stoppedByCondition = true;
    app.paused = true;
    app.ui.setPaused(true);
    app.ui.showModal(
      'Stop condition reached',
      app.stopCondition.describe() + ' (gen ' + generationCount + ', avg ' + avg.toFixed(3) + ').',
      [
        { label: 'Continue', primary: false, onClick: () => {
            app.stoppedByCondition = false;
            app.paused = false;
            app.ui.setPaused(false);
          }
        },
        { label: 'Save best & stop', primary: true, onClick: () => {
            app.saveBestBrain();
          }
        }
      ]
    );
  }
}

// p5 lifecycle — these names override the originals from sketch.js.
function setup() {
  // tf.js on CPU (matches original behaviour).
  tf.setBackend('cpu');

  // Canvas fills the area to the right of the 300px panel.
  const w = Math.max(400, windowWidth - 300);
  const h = Math.max(300, windowHeight);
  const c = createCanvas(w, h);
  c.parent('canvas-container');

  // Build initial random track so `start` (used by Vehicle ctor) exists.
  buildTrack();

  app = new App();
  app.ui = new UI(app);
  app.editor = new TrackEditor();
  app.race = new RaceMode();
  app.gestures = new GestureController(app);

  // Initial spawn.
  app._spawnPopulation();

  app.ui.setActiveMode('training');
  app.ui.refreshLibraries();
}

function windowResized() {
  const w = Math.max(400, windowWidth - 300);
  const h = Math.max(300, windowHeight);
  resizeCanvas(w, h);
}

function draw() {
  background(20);

  // Stop-condition snapshot.
  app.stopCondition.type = app.ui.params.stopType;
  app.stopCondition.threshold = app.ui.params.stopThreshold;

  if (app.mode === 'editor') {
    drawTrackBackground();
    for (const o of obstacles) o.show();
    app.editor.show();
    drawStatsHUD();
    pushUIStats({ alive: 0 });
    return;
  }

  if (app.mode === 'race') {
    drawTrackBackground();
    for (const o of obstacles) o.show();
    if (!app.paused && app.race.running) {
      const cycles = app.ui.params.simSpeed;
      for (let n = 0; n < cycles && app.race.running; n++) {
        app.race.step(walls, checkpoints);
        if (app.race.isFinished()) break;
      }
    }
    app.race.draw();
    app.ui.updateLeaderboard(app.race.getLeaderboard());
    drawStatsHUD();
    pushUIStats({ alive: app.race.entries.filter(e => !e.vehicle.dead).length });
    return;
  }

  // ----- training -----
  if (!app.paused) {
    const cycles = app.ui.params.simSpeed;
    for (let n = 0; n < cycles; n++) {
      // Cache neighbour list once per cycle for separation.
      const livingForSep = app.ui.params.separation ? population : null;
      for (const v of population) {
        v.applyBehaviors(walls, checkpoints, livingForSep);
        v.check(checkpoints);
        v.update();
      }
      // Cull dead/finished into savedVehicles.
      for (let i = population.length - 1; i >= 0; i--) {
        const v = population[i];
        if (v.dead || v.finished) {
          savedVehicles.push(population.splice(i, 1)[0]);
        }
      }
      if (population.length === 0) {
        nextGenerationRacing();
      }
    }
  }

  drawTrackBackground();
  for (const o of obstacles) o.show();

  let bestP = population[0];
  for (const v of population) {
    v.show();
    if (!bestP || v.fitness > bestP.fitness) bestP = v;
  }
  if (bestP) {
    bestP.highlight();
    app.lastBest = bestP;
  }

  drawStatsHUD();
  pushUIStats({
    alive: population.length,
    bestFitness: bestP ? bestP.fitness : 0
  });
}

function drawTrackBackground() {
  // Walls
  stroke(200);
  strokeWeight(2);
  noFill();
  for (const w of walls) line(w.a.x, w.a.y, w.b.x, w.b.y);
  // Checkpoints (subtle)
  stroke(60, 90, 180, 80);
  strokeWeight(1);
  for (const cp of checkpoints) line(cp.a.x, cp.a.y, cp.b.x, cp.b.y);
  // Start
  if (start) {
    noStroke();
    fill(0, 255, 80);
    ellipse(start.x, start.y, 10);
  }
}

function drawStatsHUD() {
  noStroke();
  fill(255);
  textSize(14);
  text('Mode: ' + app.mode, 12, height - 28);
  text('Gen: ' + generationCount, 12, height - 12);
}

function pushUIStats(extra) {
  let avg = 0;
  if (savedVehicles.length > 0) {
    let s = 0;
    for (const v of savedVehicles) s += (v.fitness || 0);
    avg = s / savedVehicles.length;
  }
  app.ui.updateStats(Object.assign({
    mode: app.mode,
    generation: generationCount,
    avgFitness: avg,
    bestFitness: app.bestFitnessEver,
    lapCompletionPercent: app.lapCompletionPercent
  }, extra));
}

function mousePressed(event) {
  // Only react inside the canvas area (mouseX/Y are canvas-local).
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  const isRight = (event && event.button === 2) || (mouseButton === RIGHT);
  if (app.mode === 'editor') {
    if (isRight) app.editor.removeNearest(mouseX, mouseY);
    else app.editor.addPoint(mouseX, mouseY);
    app._applyEditorTrack();
  } else if (app.mode === 'training' && isRight) {
    app.addObstacle(mouseX, mouseY, 30);
  }
}

// Suppress browser context menu on the canvas so right-click works.
window.addEventListener('contextmenu', e => {
  if (e.target.tagName === 'CANVAS') e.preventDefault();
});

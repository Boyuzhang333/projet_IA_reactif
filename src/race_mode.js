// RaceMode: load multiple saved brains, instantiate one RacingVehicle per
// brain on a chosen track, and race them simultaneously. Live leaderboard
// is rendered by UI from getLeaderboard().
class RaceMode {
  constructor() {
    this.entries = [];   // { name, vehicle, color }
    this.running = false;
    this.frame = 0;
  }

  start(brainNames, trackData, vehicleConfig) {
    this.stop();
    this.entries = [];
    this.frame = 0;
    const palette = [
      [255, 80, 80], [80, 200, 255], [80, 255, 120], [255, 200, 80],
      [220, 120, 255], [255, 255, 255], [255, 140, 200], [120, 255, 220]
    ];
    let i = 0;
    for (const name of brainNames) {
      const loaded = Storage.loadBrain(name);
      if (!loaded) continue;
      // Build a vehicle config that matches the saved brain's input shape.
      const inputs = loaded.brain.input_nodes;
      const lookahead = (loaded.meta && loaded.meta.lookahead != null)
        ? loaded.meta.lookahead
        : Math.max(0, Math.floor((inputs - 9) / 2));
      const rayCount = inputs - lookahead * 2;
      const cfg = Object.assign({}, vehicleConfig || {}, {
        rayCount: Math.max(1, rayCount),
        lookahead,
        hiddenLayers: loaded.brain.hidden_layers,
        activation: loaded.brain.activation,
        separation: false
      });
      const v = new RacingVehicle(loaded.brain, cfg);
      v.color = palette[i % palette.length];
      this.entries.push({ name, vehicle: v, color: v.color });
      // The loaded brain object is copy()'d into the vehicle constructor, so dispose ours.
      loaded.brain.dispose();
      i++;
    }
    this.running = this.entries.length > 0;
    return this.running;
  }

  stop() {
    for (const e of this.entries) {
      if (e.vehicle && e.vehicle.brain) e.vehicle.brain.dispose();
    }
    this.entries = [];
    this.running = false;
  }

  step(walls, checkpoints) {
    if (!this.running) return;
    this.frame++;
    const others = this.entries.map(e => e.vehicle);
    for (const e of this.entries) {
      const v = e.vehicle;
      if (v.dead || v.finished) continue;
      v.applyBehaviors(walls, checkpoints, others);
      v.check(checkpoints);
      v.update();
    }
  }

  draw() {
    for (const e of this.entries) {
      const v = e.vehicle;
      push();
      translate(v.pos.x, v.pos.y);
      rotate(v.vel.heading());
      noStroke();
      const c = e.color;
      const alpha = (v.dead || v.finished) ? 80 : 220;
      fill(c[0], c[1], c[2], alpha);
      rectMode(CENTER);
      rect(0, 0, 14, 7);
      pop();
    }
  }

  getLeaderboard() {
    return this.entries
      .map(e => ({
        name: e.name,
        color: e.color,
        checkpoints: e.vehicle.checkpointsPassed,
        laps: e.vehicle.lapsCompleted,
        dead: e.vehicle.dead
      }))
      .sort((a, b) => (b.laps - a.laps) || (b.checkpoints - a.checkpoints));
  }

  isFinished() {
    if (!this.running) return true;
    return this.entries.every(e => e.vehicle.dead || e.vehicle.finished);
  }
}

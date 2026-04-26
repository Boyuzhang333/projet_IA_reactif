// RacingVehicle extends Vehicle
// - configurable ray count (overrides hardcoded 90deg / 15deg fan)
// - next-N waypoints as additional inputs
// - separation steering behavior
// - richer fitness function: checkpoints*A - time*B - collisions*C
class RacingVehicle extends Vehicle {
  constructor(brain, config) {
    // Parent's `if (brain) this.brain = brain.copy()` branch is the SAFE path —
    // the `else` branch creates a fixed-shape NeuralNetwork(6,12,2) we'd then
    // have to dispose, and disposing a tf.js 1.1.0 Sequential whose internal
    // state isn't perfectly initialized triggers
    //   "Cannot read properties of undefined (reading 'optimizer')"
    // (Sequential.optimizer getter reads `this.model.optimizer`).
    //
    // Workaround: always feed super() a brain whose .copy() returns something
    // cheap. When the caller didn't supply one, use the stub — it has no
    // tf state at all, so super's copy() is effectively free and there's
    // nothing to dispose.
    super(brain || RacingVehicle._STUB_BRAIN);
    
    // STRICT: Vehicle MUST spawn exactly at the start position.
    // The start point is defined as the midpoint of the first checkpoint.
    let startPos = null;
    
    // Priority 1: Use global `start` variable (most direct)
    if (typeof start !== 'undefined' && start && 
        typeof start.x === 'number' && typeof start.y === 'number' &&
        isFinite(start.x) && isFinite(start.y)) {
      startPos = start;
    }
    
    // Priority 2: Calculate from first checkpoint
    if (!startPos && typeof checkpoints !== 'undefined' && 
        Array.isArray(checkpoints) && checkpoints.length > 0) {
      const cp = checkpoints[0];
      if (cp && cp.a && cp.b) {
        const ax = typeof cp.a.x === 'number' ? cp.a.x : 0;
        const ay = typeof cp.a.y === 'number' ? cp.a.y : 0;
        const bx = typeof cp.b.x === 'number' ? cp.b.x : 0;
        const by = typeof cp.b.y === 'number' ? cp.b.y : 0;
        startPos = {
          x: (ax + bx) / 2,
          y: (ay + by) / 2
        };
      }
    }
    
    // Apply start position (strict)
    if (startPos && typeof startPos.x === 'number' && typeof startPos.y === 'number') {
      this.pos = createVector(startPos.x, startPos.y);
    } else {
      // Fallback: ensure pos is a valid vector
      if (!this.pos || typeof this.pos.x !== 'number' || typeof this.pos.y !== 'number') {
        this.pos = createVector(100, 100);
      }
    }
    
    this.config = Object.assign({
      rayCount: 9,
      raySpread: 90,           // total fov in degrees
      lookahead: 2,            // number of next waypoints fed to the network
      separation: true,
      separationRadius: 30,
      separationWeight: 0.5,
      hiddenLayers: [16],
      activation: 'sigmoid',
      lifespan: 120,           // frames without a checkpoint before death
      fitnessWeights: { checkpoints: 1.0, time: 0.001, collisions: 5.0 }
    }, config || {});

    // Replace rays with a configurable fan.
    this.rays = [];
    const half = this.config.raySpread / 2;
    const count = Math.max(1, this.config.rayCount);
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? 0 : map(i, 0, count - 1, -half, half);
      this.rays.push(new Ray(this.pos, radians(a)));
    }

    // Now build / keep the actual brain.
    const inputCount = this.rays.length + this.config.lookahead * 2;
    const isStub = (this.brain === RacingVehicle._STUB_BRAIN);
    const shapeMatches = !isStub &&
                         brain instanceof ExtendedNeuralNetwork &&
                         brain.input_nodes === inputCount &&
                         brain.output_nodes === 2;
    if (!shapeMatches) {
      if (!isStub && this.brain && typeof this.brain.dispose === 'function') {
        try { this.brain.dispose(); } catch (e) { /* tf.js 1.1.0 dispose quirk */ }
      }
      this.brain = new ExtendedNeuralNetwork(
        inputCount,
        this.config.hiddenLayers,
        2,
        undefined,
        { activation: this.config.activation }
      );
    }

    // Stats for richer fitness.
    this.checkpointsPassed = 0;
    this.lapsCompleted = 0;
    this.collisions = 0;
    this.timeAlive = 0;
  }

  // Override parent dispose — same guard against the dispose-time optimizer bug.
  dispose() {
    if (this.brain && typeof this.brain.dispose === 'function' &&
        this.brain !== RacingVehicle._STUB_BRAIN) {
      try { this.brain.dispose(); } catch (e) { /* tf.js 1.1.0 dispose quirk */ }
    }
    this.brain = null;
  }

  // Override parent: calls our own look() (which knows about waypoints) plus separation.
  applyBehaviors(walls, checkpoints, others) {
    let force = this.look(walls, checkpoints);
    this.applyForce(force);
    if (this.config.separation && others && others.length > 0) {
      const sep = this.separate(others);
      sep.mult(this.config.separationWeight);
      this.applyForce(sep);
    }
  }

  // Classic Reynolds separation: steer away from neighbors that are too close.
  separate(others) {
    const desiredSep = this.config.separationRadius;
    const sum = createVector(0, 0);
    let count = 0;
    for (const o of others) {
      if (o === this || o.dead || o.finished) continue;
      const d = p5.Vector.dist(this.pos, o.pos);
      if (d > 0 && d < desiredSep) {
        const diff = p5.Vector.sub(this.pos, o.pos);
        diff.normalize();
        diff.div(d);
        sum.add(diff);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.setMag(this.maxspeed);
      const steer = p5.Vector.sub(sum, this.vel);
      steer.limit(this.maxforce);
      return steer;
    }
    return createVector(0, 0);
  }

  // Fully reimplemented update — uses our configurable lifespan instead of the
  // small global LIFESPAN baked into the parent class.
  update() {
    if (this.dead || this.finished) return;
    this.timeAlive++;
    this.pos.add(this.vel);
    this.vel.add(this.acc);
    this.vel.limit(this.maxspeed);
    this.acc.set(0, 0);
    this.counter++;
    if (this.counter > this.config.lifespan) {
      this.dead = true;
    }
    for (let i = 0; i < this.rays.length; i++) {
      this.rays[i].rotate(this.vel.heading());
    }
  }

  // Override: also detect lap completion (index wraps to 0).
  check(checkpoints) {
    if (this.finished) return;
    const prevIndex = this.index;
    this.goal = checkpoints[this.index];
    const d = pldistance(this.goal.a, this.goal.b, this.pos.x, this.pos.y);
    if (d < 5) {
      this.index = (this.index + 1) % checkpoints.length;
      this.fitness++;
      this.checkpointsPassed++;
      this.counter = 0;
      // Lap completed when the index wraps back to 0.
      if (this.index === 0 && prevIndex === checkpoints.length - 1) {
        this.lapsCompleted++;
      }
    }
  }

  // Override the look behavior — same ray inputs as parent, but augmented with
  // angle/distance to the next N waypoints, and using ExtendedNeuralNetwork.
  // The `checkpoints` arg is needed for waypoint inputs.
  look(walls, checkpoints) {
    const inputs = [];
    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];
      let record = this.sight;
      for (const wall of walls) {
        const pt = ray.cast(wall);
        if (pt) {
          const d = p5.Vector.dist(this.pos, pt);
          if (d < record) record = d;
        }
      }
      if (record < 5) {
        if (!this.dead) this.collisions++;
        this.dead = true;
      }
      inputs.push(map(record, 0, this.sight, 1, 0));
    }

    // Waypoint lookahead inputs.
    if (checkpoints && this.config.lookahead > 0) {
      const heading = this.vel.heading();
      for (let k = 1; k <= this.config.lookahead; k++) {
        const idx = (this.index + k - 1) % checkpoints.length;
        const cp = checkpoints[idx];
        const mid = cp.midpoint();
        const dx = mid.x - this.pos.x;
        const dy = mid.y - this.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx) - heading;
        // wrap to [-PI, PI]
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        inputs.push(angle / Math.PI);                 // normalized [-1, 1]
        inputs.push(Math.min(1, dist / 500));         // normalized 0..1 (cap at 500px)
      }
    }

    const output = this.brain.predict(inputs);
    let angle = map(output[0], 0, 1, -PI, PI);
    let speed = map(output[1], 0, 1, 0, this.maxspeed);
    angle += this.vel.heading();

    const desired = p5.Vector.fromAngle(angle);
    desired.setMag(speed);
    const force = p5.Vector.sub(desired, this.vel);
    force.limit(this.maxforce);
    return force;
  }

  // Override: composite fitness.
  calculateFitness() {
    const w = this.config.fitnessWeights;
    const raw = (this.checkpointsPassed * w.checkpoints)
              - (this.timeAlive * w.time)
              - (this.collisions * w.collisions);
    // Keep fitness positive for the roulette selection in ga.js.
    this.fitness = Math.max(0.0001, raw);
  }

  // Pretty draw — colored by lap progress.
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    noStroke();
    fill(180, 200, 255, 160);
    rectMode(CENTER);
    rect(0, 0, 12, 6);
    pop();
  }
}

// Pseudo-brain used only to satisfy super()'s `this.brain = brain.copy()`
// path without pulling tf.js into it. The real brain is built right after.
RacingVehicle._STUB_BRAIN = {
  copy() { return RacingVehicle._STUB_BRAIN; },
  dispose() {}
};

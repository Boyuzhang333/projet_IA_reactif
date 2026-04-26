// TrackEditor: click to drop control points; the editor builds a smooth
// closed circuit in real time (inside/outside walls + checkpoints) using a
// Catmull-Rom-like interpolation. Right-click in editor mode removes the
// nearest point. Save/load via Storage.
class TrackEditor {
  constructor() {
    this.points = [];
    this.pathWidth = 60;
    this.subdivisions = 8; // segments per control-point arc
    this.preview = null;   // last rebuilt track snapshot
  }

  addPoint(x, y) {
    this.points.push({ x, y });
    this.rebuild();
  }

  removeNearest(x, y, threshold) {
    threshold = threshold || 20;
    let bestI = -1;
    let bestD = threshold * threshold;
    for (let i = 0; i < this.points.length; i++) {
      const dx = this.points[i].x - x;
      const dy = this.points[i].y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; bestI = i; }
    }
    if (bestI >= 0) {
      this.points.splice(bestI, 1);
      this.rebuild();
      return true;
    }
    return false;
  }

  clear() {
    this.points = [];
    this.preview = null;
  }

  // Catmull-Rom on a closed loop.
  _catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  rebuild() {
    if (this.points.length < 3) {
      this.preview = null;
      return;
    }
    // Sample the closed curve.
    const n = this.points.length;
    const samples = [];
    for (let i = 0; i < n; i++) {
      const p0 = this.points[(i - 1 + n) % n];
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % n];
      const p3 = this.points[(i + 2) % n];
      for (let s = 0; s < this.subdivisions; s++) {
        const t = s / this.subdivisions;
        samples.push(this._catmull(p0, p1, p2, p3, t));
      }
    }

    // Build inside/outside walls + checkpoints by offsetting along the normal.
    const inside = [];
    const outside = [];
    const checkpoints = [];
    const m = samples.length;
    for (let i = 0; i < m; i++) {
      const cur = samples[i];
      const nxt = samples[(i + 1) % m];
      const dx = nxt.x - cur.x;
      const dy = nxt.y - cur.y;
      const len = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
      const nx = -dy / len;
      const ny = dx / len;
      const w = this.pathWidth;
      inside.push({ x: cur.x + nx * w, y: cur.y + ny * w });
      outside.push({ x: cur.x - nx * w, y: cur.y - ny * w });
    }

    const walls = [];
    for (let i = 0; i < m; i++) {
      const a = inside[i];
      const b = inside[(i + 1) % m];
      walls.push(new Boundary(a.x, a.y, b.x, b.y));
      const c = outside[i];
      const d = outside[(i + 1) % m];
      walls.push(new Boundary(c.x, c.y, d.x, d.y));
    }

    // One checkpoint per sample point spanning inside <-> outside.
    for (let i = 0; i < m; i++) {
      checkpoints.push(new Boundary(inside[i].x, inside[i].y, outside[i].x, outside[i].y));
    }

    // Start = first checkpoint midpoint.
    const startVec = checkpoints[0].midpoint();

    this.preview = {
      walls,
      checkpoints,
      inside: inside.map(p => createVector(p.x, p.y)),
      outside: outside.map(p => createVector(p.x, p.y)),
      start: startVec,
      end: checkpoints[checkpoints.length - 1].midpoint()
    };
  }

  // Render points + preview; called from main draw loop while in editor mode.
  show() {
    if (this.preview) {
      const t = this.preview;
      // Walls
      stroke(180);
      strokeWeight(2);
      for (const w of t.walls) line(w.a.x, w.a.y, w.b.x, w.b.y);
      // Checkpoints
      stroke(60, 120, 220, 120);
      strokeWeight(1);
      for (const c of t.checkpoints) line(c.a.x, c.a.y, c.b.x, c.b.y);
      // Start marker
      noStroke();
      fill(0, 255, 0);
      ellipse(t.start.x, t.start.y, 12);
    }
    // Control points
    noStroke();
    fill(255, 200, 0);
    for (const p of this.points) ellipse(p.x, p.y, 10);
    // Hint
    fill(255);
    noStroke();
    textSize(14);
    text('Editor: left-click to add control point, right-click to remove. Need ≥3 points.', 12, 22);
  }

  // Persist as raw control points + width — the geometry is rebuilt on load.
  toJSON() {
    return { points: this.points.slice(), pathWidth: this.pathWidth };
  }

  static fromJSON(data) {
    const e = new TrackEditor();
    e.points = (data.points || []).map(p => ({ x: p.x, y: p.y }));
    e.pathWidth = data.pathWidth != null ? data.pathWidth : 60;
    e.rebuild();
    return e;
  }
}

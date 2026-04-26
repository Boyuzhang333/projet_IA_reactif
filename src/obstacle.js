// Obstacle: a circular obstacle approximated as N short Boundary segments.
// Added by right-clicking on the canvas; vehicles see/collide with it via
// the same ray-vs-wall code as the track walls.
class Obstacle extends Boundary {
  constructor(cx, cy, radius, segments) {
    // Pick a representative segment for the parent (a/b vectors).
    // The full polygon lives in this.walls and is what gets pushed into the
    // global walls[] array.
    const seg = segments || 16;
    const r = radius || 30;
    const angle0 = 0;
    const x1 = cx + r * Math.cos(angle0);
    const y1 = cy + r * Math.sin(angle0);
    const x2 = cx + r * Math.cos(angle0 + (Math.PI * 2) / seg);
    const y2 = cy + r * Math.sin(angle0 + (Math.PI * 2) / seg);
    super(x1, y1, x2, y2);
    this.cx = cx;
    this.cy = cy;
    this.radius = r;
    this.segments = seg;
    this.walls = this.buildSegments();
  }

  buildSegments() {
    const out = [];
    for (let i = 0; i < this.segments; i++) {
      const a1 = (i / this.segments) * Math.PI * 2;
      const a2 = ((i + 1) / this.segments) * Math.PI * 2;
      out.push(new Boundary(
        this.cx + this.radius * Math.cos(a1),
        this.cy + this.radius * Math.sin(a1),
        this.cx + this.radius * Math.cos(a2),
        this.cy + this.radius * Math.sin(a2)
      ));
    }
    return out;
  }

  show() {
    push();
    noFill();
    stroke(255, 120, 60);
    strokeWeight(2);
    ellipse(this.cx, this.cy, this.radius * 2);
    pop();
  }

  contains(x, y) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  toJSON() {
    return { cx: this.cx, cy: this.cy, radius: this.radius, segments: this.segments };
  }

  static fromJSON(d) {
    return new Obstacle(d.cx, d.cy, d.radius, d.segments);
  }
}

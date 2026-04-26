# CLAUDE.md — AI Racing League

## What This Project Is

Browser-based AI racing simulator. Vehicles learn to drive circuits using neural networks evolved with a genetic algorithm. Built on top of a professor's existing p5.js + TensorFlow.js codebase.

**Stack:** p5.js · TensorFlow.js · Vanilla HTML/CSS/JS · MediaPipe Hands  
**Deploy:** GitHub Pages  

---

## ⛔ HARD CONSTRAINTS

### 1. Never touch the original files
These files are **read-only**. Do not edit them under any circumstances:
- `src/nn.js`
- `src/vehicle.js`
- `src/ray.js`
- `src/boundary.js`
- `src/ga.js`
- `src/sketch.js`

### 2. Extend via inheritance only
Any change to existing behavior **must** be done through a subclass in a new file.

```js
// ✅ Correct
class RacingVehicle extends Vehicle { ... }

// ❌ Forbidden — editing vehicle.js directly
```

### 3. p5.js global override
`setup()` and `draw()` can be re-declared in `src/main.js` (loaded last in HTML) to override the originals. All orchestration lives there.

### 4. No build tools
Pure browser JS. No webpack, no bundler, no npm. CDN links only.

---

## What Needs to Be Built

### Subclasses (extend originals)
- **`ExtendedNeuralNetwork extends NeuralNetwork`** — variable hidden layers, selectable activation function, `toJSON()`/`fromJSON()` for save/load
- **`RacingVehicle extends Vehicle`** — configurable ray count, next waypoints as extra inputs, separation steering behavior, richer fitness function
- **`Obstacle extends Boundary`** — circular obstacle as wall segments, added by right-click on canvas

### New systems (no inheritance needed)
- **`TrackEditor`** — click to place control points, generates a driveable circuit in real time, save/load via Storage
- **`Storage`** — static class, persists brains and tracks to `localStorage`, supports JSON file export/import
- **`StopCondition`** — configurable training stop: by generation count, average fitness, or % of vehicles completing a lap
- **`RaceMode`** — loads multiple saved brains, races them simultaneously on a chosen track, live leaderboard
- **`UI`** — fixed 300px left panel overlay, sliders for all network/training params, brain & track libraries, mode switcher
- **`GestureController`** — MediaPipe Hands, maps hand gestures to training controls

### `src/main.js`
Overrides `setup()` and `draw()`. Owns mode state (`training` | `editor` | `race`). Wires everything together.

---

## Key Behaviors to Implement

**Fitness formula** (in `RacingVehicle`):
```
fitness = checkpoints × weightA − timeTaken × weightB − collisions × weightC
```
All weights configurable from UI sliders.

**Network inputs:**
```
[ray_0..ray_N, waypoint_1_angle, waypoint_1_dist, ...]
```
Number of rays and lookahead waypoints are runtime-configurable via sliders.

**Training stop condition:** when X% of population completes 1 full lap. Show a modal when triggered with options to continue or save & stop.

**Race mode:** user picks a saved track + N saved brains → all race simultaneously → ranked by checkpoints.

**Gesture controls (creative feature):**
- Open palm → pause/resume training
- Fist → skip current generation
- Index finger position (left↔right) → simulation speed
- OK sign → save best current brain

---

## UI Layout

```
┌──────────────┬──────────────────────────────┐
│  300px panel │       p5.js canvas            │
│              │                               │
│  [Train]     │                               │
│  [Editor]    │                               │
│  [Race]      │                               │
│              │                               │
│  sliders...  │                               │
│  stats...    │                               │
│  libraries.. │                               │
└──────────────┴──────────────────────────────┘
```

Canvas width = `windowWidth - 300`.

**Training sliders to expose:** ray count, hidden layers, neurons per layer, activation function, population size, mutation rate, simulation speed, waypoint lookahead count, separation on/off, stop condition type & threshold, fitness weights.

---

## File Structure

```
/
├── index.html              ← loads all scripts in order, originals first
├── style.css
└── src/
    ├── nn.js               (original — DO NOT TOUCH)
    ├── vehicle.js          (original — DO NOT TOUCH)
    ├── ray.js              (original — DO NOT TOUCH)
    ├── boundary.js         (original — DO NOT TOUCH)
    ├── ga.js               (original — DO NOT TOUCH)
    ├── sketch.js           (original — DO NOT TOUCH)
    ├── extended_nn.js
    ├── racing_vehicle.js
    ├── obstacle.js
    ├── editor.js
    ├── storage.js
    ├── stop_condition.js
    ├── race_mode.js
    ├── ui.js
    ├── gesture.js
    └── main.js             ← loaded last, overrides setup() and draw()
```

---

## CDNs (index.html)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/0.8.0/p5.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/0.8.0/addons/p5.dom.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.1.0/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
```

---

## Deliverables

- [ ] Hosted on GitHub Pages
- [ ] YouTube demo video (1–2 min)
- [ ] README: project goal, fitness function, network topology, AI tools used
- [ ] Creative feature: gesture control via webcam
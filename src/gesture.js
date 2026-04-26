// GestureController: uses MediaPipe Hands to map hand gestures to training
// controls. Heuristic gesture recognition over the 21 hand landmarks.
//
// Mapping:
//   open palm  -> pause/resume training
//   fist       -> skip current generation
//   index L<->R-> simulation speed (mapped to UI slider via app)
//   OK sign    -> save best current brain
class GestureController {
  constructor(app) {
    this.app = app;
    this.video = document.getElementById('gesture-video');
    this.hands = null;
    this.camera = null;
    this.active = false;
    this.lastGesture = null;
    this.lastGestureTime = 0;
    this.cooldownMs = 800;     // debounce for one-shot gestures
    this.indexX = 0.5;
  }

  async enable() {
    if (this.active) return;
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
      this.app.ui.setGestureStatus('MediaPipe not loaded');
      return;
    }
    this.hands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    this.hands.onResults(res => this._onResults(res));
    try {
      this.camera = new Camera(this.video, {
        onFrame: async () => { await this.hands.send({ image: this.video }); },
        width: 320,
        height: 240
      });
      await this.camera.start();
    } catch (e) {
      this.app.ui.setGestureStatus('Camera error: ' + e.message);
      return;
    }
    this.video.classList.add('active');
    this.active = true;
    this.app.ui.setGestureStatus('Active');
  }

  disable() {
    if (!this.active) return;
    if (this.camera) try { this.camera.stop(); } catch (_) {}
    this.video.classList.remove('active');
    this.active = false;
    this.app.ui.setGestureStatus('Inactive');
  }

  _onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.app.ui.setGestureStatus('Active — no hand');
      return;
    }
    const lm = results.multiHandLandmarks[0];
    const g = this._classify(lm);
    this.app.ui.setGestureStatus('Active — ' + g);

    // Continuous: index x position controls sim speed.
    if (g === 'point') {
      // Mirrored video: invert x.
      this.indexX = 1 - lm[8].x;
      const speed = Math.max(1, Math.min(20, Math.round(this.indexX * 20)));
      this.app.setSimSpeed(speed);
    }

    // One-shot gestures: debounce.
    const now = Date.now();
    if (g === this.lastGesture && now - this.lastGestureTime < this.cooldownMs) return;
    if (g === 'open' || g === 'fist' || g === 'ok') {
      this.lastGesture = g;
      this.lastGestureTime = now;
      if (g === 'open')  this.app.togglePause();
      if (g === 'fist')  this.app.skipGeneration();
      if (g === 'ok')    this.app.saveBestBrain();
    }
  }

  // Very rough but workable classifier.
  _classify(lm) {
    // landmark indices: tips 4(thumb), 8(index), 12(middle), 16(ring), 20(pinky).
    // pip joints: 6, 10, 14, 18.
    const fingerExtended = (tip, pip) => lm[tip].y < lm[pip].y - 0.02;
    const idx = fingerExtended(8, 6);
    const mid = fingerExtended(12, 10);
    const rng = fingerExtended(16, 14);
    const pky = fingerExtended(20, 18);
    const extCount = [idx, mid, rng, pky].filter(Boolean).length;

    // OK sign: thumb tip and index tip very close together.
    const dxTI = lm[4].x - lm[8].x;
    const dyTI = lm[4].y - lm[8].y;
    const distTI = Math.sqrt(dxTI * dxTI + dyTI * dyTI);
    if (distTI < 0.05 && mid && rng && pky) return 'ok';

    if (extCount === 0) return 'fist';
    if (extCount >= 3 && idx && mid && (rng || pky)) return 'open';
    if (idx && !mid && !rng && !pky) return 'point';
    return 'idle';
  }
}

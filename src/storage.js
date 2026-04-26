// Storage: static class for persisting brains and tracks to localStorage,
// plus JSON file export/import.
class Storage {
  static BRAIN_KEY = 'arl.brains';
  static TRACK_KEY = 'arl.tracks';

  static _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('Storage read failed', e);
      return {};
    }
  }

  static _write(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }

  // ---------- brains ----------
  static saveBrain(name, brain, meta) {
    const all = this._read(this.BRAIN_KEY);
    all[name] = {
      brain: brain.toJSON(),
      meta: meta || {},
      savedAt: Date.now()
    };
    this._write(this.BRAIN_KEY, all);
  }

  static loadBrain(name) {
    const all = this._read(this.BRAIN_KEY);
    if (!all[name]) return null;
    return {
      brain: ExtendedNeuralNetwork.fromJSON(all[name].brain),
      meta: all[name].meta || {}
    };
  }

  static deleteBrain(name) {
    const all = this._read(this.BRAIN_KEY);
    delete all[name];
    this._write(this.BRAIN_KEY, all);
  }

  static listBrains() {
    return Object.keys(this._read(this.BRAIN_KEY));
  }

  // ---------- tracks ----------
  static saveTrack(name, trackData) {
    const all = this._read(this.TRACK_KEY);
    all[name] = { track: trackData, savedAt: Date.now() };
    this._write(this.TRACK_KEY, all);
  }

  static loadTrack(name) {
    const all = this._read(this.TRACK_KEY);
    return all[name] ? all[name].track : null;
  }

  static deleteTrack(name) {
    const all = this._read(this.TRACK_KEY);
    delete all[name];
    this._write(this.TRACK_KEY, all);
  }

  static listTracks() {
    return Object.keys(this._read(this.TRACK_KEY));
  }

  // ---------- file import/export ----------
  static exportToFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static importFromFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          callback(JSON.parse(reader.result));
        } catch (err) {
          alert('Invalid JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  static exportBrain(name) {
    const all = this._read(this.BRAIN_KEY);
    if (!all[name]) return;
    this.exportToFile(name + '.brain.json', { name, ...all[name] });
  }

  static importBrain(callback) {
    this.importFromFile(data => {
      const name = data.name || ('imported_' + Date.now());
      const all = this._read(this.BRAIN_KEY);
      all[name] = { brain: data.brain, meta: data.meta || {}, savedAt: Date.now() };
      this._write(this.BRAIN_KEY, all);
      callback && callback(name);
    });
  }

  static exportTrack(name) {
    const all = this._read(this.TRACK_KEY);
    if (!all[name]) return;
    this.exportToFile(name + '.track.json', { name, ...all[name] });
  }

  static importTrack(callback) {
    this.importFromFile(data => {
      const name = data.name || ('imported_' + Date.now());
      const all = this._read(this.TRACK_KEY);
      all[name] = { track: data.track, savedAt: Date.now() };
      this._write(this.TRACK_KEY, all);
      callback && callback(name);
    });
  }
}

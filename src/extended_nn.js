// ExtendedNeuralNetwork extends NeuralNetwork
// - variable number of hidden layers
// - selectable activation function
// - toJSON()/fromJSON() for save/load
//
// Constructor modes (matching the parent's two-mode pattern):
//   new ExtendedNeuralNetwork(model, inputs, hiddenLayers, outputs, opts)
//   new ExtendedNeuralNetwork(inputs, hiddenLayers, outputs, undefined, opts)
//
// In the second form we build the real tf.Sequential ahead of super() via the
// static _build helper, so we never need to dispose a half-built placeholder
// (disposing an empty Sequential trips a bug in tf.js 1.1.0: "Cannot read
// properties of undefined (reading 'optimizer')").
class ExtendedNeuralNetwork extends NeuralNetwork {
  constructor(a, b, c, d, options) {
    let model, inputs, hiddenLayers, outputs, opts;
    if (a instanceof tf.Sequential) {
      model = a;
      inputs = b;
      hiddenLayers = c;
      outputs = d;
      opts = options || {};
    } else {
      inputs = a;
      hiddenLayers = b;
      outputs = c;
      opts = options || d || {};
      hiddenLayers = Array.isArray(hiddenLayers) ? hiddenLayers : [hiddenLayers];
      model = ExtendedNeuralNetwork._build(
        inputs, hiddenLayers, outputs, opts.activation || 'sigmoid'
      );
    }

    // Pass the (real) model to parent — parent stores it directly, no createModel call.
    super(model, inputs, Array.isArray(hiddenLayers) ? hiddenLayers[0] : hiddenLayers, outputs);

    this.input_nodes = inputs;
    this.hidden_layers = Array.isArray(hiddenLayers) ? hiddenLayers.slice() : [hiddenLayers];
    this.output_nodes = outputs;
    this.activation = opts.activation || 'sigmoid';
    // `this.model` was set by the parent constructor.
  }

  // Static helper — buildable before `this` exists.
  static _build(inputs, hiddenLayers, outputs, activation) {
    const m = tf.sequential();
    const layers = (hiddenLayers && hiddenLayers.length > 0)
      ? hiddenLayers
      : [Math.max(2, inputs * 2)];
    m.add(tf.layers.dense({
      units: layers[0],
      inputShape: [inputs],
      activation
    }));
    for (let i = 1; i < layers.length; i++) {
      m.add(tf.layers.dense({ units: layers[i], activation }));
    }
    m.add(tf.layers.dense({ units: outputs, activation: 'sigmoid' }));
    return m;
  }

  // Used by copy() and (if ever invoked polymorphically) the parent constructor.
  // Tolerates being called when only `hidden_nodes` (parent's field) is set.
  createModel() {
    const layers = (this.hidden_layers && this.hidden_layers.length > 0)
      ? this.hidden_layers
      : [this.hidden_nodes || Math.max(2, this.input_nodes * 2)];
    return ExtendedNeuralNetwork._build(
      this.input_nodes, layers, this.output_nodes, this.activation || 'sigmoid'
    );
  }

  // Override parent predict() to drop its per-call console.log.
  predict(inputs) {
    return tf.tidy(() => {
      const xs = tf.tensor2d([inputs]);
      const ys = this.model.predict(xs);
      return ys.dataSync();
    });
  }

  // Override dispose: tf.js 1.1.0's Sequential.dispose() can throw with
  //   "Cannot read properties of undefined (reading 'optimizer')"
  // (its optimizer getter does `this.model.optimizer` and `this.model` may
  // be undefined). Swallow it — we're discarding the brain anyway.
  dispose() {
    try {
      if (this.model && typeof this.model.dispose === 'function') {
        this.model.dispose();
      }
    } catch (e) { /* ignore tf.js 1.1.0 dispose quirk */ }
  }

  copy() {
    return tf.tidy(() => {
      const modelCopy = this.createModel();
      const weights = this.model.getWeights();
      const copies = weights.map(w => w.clone());
      modelCopy.setWeights(copies);
      return new ExtendedNeuralNetwork(
        modelCopy, this.input_nodes, this.hidden_layers, this.output_nodes,
        { activation: this.activation }
      );
    });
  }

  toJSON() {
    const weights = this.model.getWeights().map(t => ({
      shape: t.shape,
      values: Array.from(t.dataSync())
    }));
    return {
      input_nodes: this.input_nodes,
      hidden_layers: this.hidden_layers,
      output_nodes: this.output_nodes,
      activation: this.activation,
      weights
    };
  }

  static fromJSON(data) {
    const nn = new ExtendedNeuralNetwork(
      data.input_nodes,
      data.hidden_layers,
      data.output_nodes,
      undefined,
      { activation: data.activation || 'sigmoid' }
    );
    const tensors = data.weights.map(w => tf.tensor(w.values, w.shape));
    nn.model.setWeights(tensors);
    tensors.forEach(t => t.dispose());
    return nn;
  }
}

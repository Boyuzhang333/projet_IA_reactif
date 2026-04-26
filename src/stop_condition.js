// StopCondition: configurable training stop.
//   type: 'generations' | 'avgFitness' | 'lapPercent' | 'never'
//   threshold: meaning depends on type.
class StopCondition {
  constructor(type, threshold) {
    this.type = type || 'never';
    this.threshold = threshold != null ? threshold : 0;
  }

  // generation: current generation count
  // savedVehicles: dead/finished vehicles of the current generation
  // population: still-alive vehicles
  shouldStop(stats) {
    switch (this.type) {
      case 'generations':
        return stats.generation >= this.threshold;
      case 'avgFitness':
        return stats.avgFitness >= this.threshold;
      case 'lapPercent':
        return stats.lapCompletionPercent >= this.threshold;
      case 'never':
      default:
        return false;
    }
  }

  describe() {
    switch (this.type) {
      case 'generations': return `Stop after ${this.threshold} generations`;
      case 'avgFitness':  return `Stop when avg fitness ≥ ${this.threshold}`;
      case 'lapPercent':  return `Stop when ${this.threshold}% complete a lap`;
      default:            return 'No stop condition';
    }
  }
}

# 🏎️ Ligue de Course IA — Simulateur d'Apprentissage Neural

## 📋 Vue d'ensemble

**AI Racing League** est un simulateur de course basé navigateur où des véhicules autonomes apprennent à conduire des circuits en utilisant des **réseaux de neurones évolutifs** via un **algorithme génétique**. Construite sur p5.js et TensorFlow.js.

- **Stack** : p5.js · TensorFlow.js · Vanilla HTML/CSS/JS · MediaPipe Hands  
- **Plateforme** : Navigateur pur (pas de build tools)  
- **Évolution** : Les meilleurs cerveaux survivent et produisent des enfants mutés

---

## 🚀 Comment utiliser

### Installation et lancement

1. **Ouvrir dans un navigateur**
   ```
   Simplement ouvrir `index.html` dans Chrome, Firefox ou Edge
   ```

2. **Interface**
   - Panneau de contrôle à gauche (300px)
   - Zone de simulation à droite (canvas p5.js)

### Les 3 modes de fonctionnement

#### 🏋️ **Mode Entraînement** (Training)
- **Objectif** : Faire évoluer une population de véhicules pour qu'ils apprennent à conduire
- **Ce qui se passe** :
  1. Spawn d'une population de véhicules au point de départ
  2. Les véhicules utilisent leurs **rayons capteurs** (9 par défaut) pour voir les murs et checkpoints
  3. Un **réseau de neurones** prend ces entrées et décide : direction + vitesse
  4. Ceux qui passent des checkpoints sans crasher gagnent une meilleure **fitness**
  5. Les moins bons meurent, les meilleurs se reproduisent avec mutation
  6. Génération suivante = population basée sur les gènes des meilleurs

**Ajustements clés** :
- **Population** : Nombre de véhicules par génération (défaut: 100)
- **Sim speed** : Cycles par frame (défaut: 1, augmenter pour accélérer)
- **Rays** : Nombre de capteurs directionnels (défaut: 9)
- **Mutation rate** : Intensité des mutations génétiques (défaut: 0.1)

#### 🏗️ **Mode Éditeur** (Editor)
- **Objectif** : Créer des circuits personnalisés
- **Comment faire** :
  1. Cliquer sur le canvas pour ajouter des **points de contrôle** (en bleu)
  2. La piste se génère automatiquement entre les points
  3. **Clic droit** : ajouter des obstacles circulaires
  4. **Sauvegarder** : "Save current" dans "Track library"
- **Checkpoints** : Lignes générées entre points successifs (le véhicule doit tous les franchir)

#### 🏁 **Mode Course** (Race)
- **Objectif** : Faire concourir plusieurs cerveaux sauvegardés sur une même piste
- **Comment faire** :
  1. Cocher les cerveaux dans "Brain library" qu'on veut faire courir
  2. Choisir une piste dans "Track library"
  3. Cliquer "Start race"
  4. Voir le classement en direct (trié par checkpoints passés)

---

## 🎮 Panneau de contrôle détaillé

### **Training** (Entraînement)
| Bouton | Effet |
|--------|-------|
| Pause | Suspend/reprend la simulation |
| Skip Gen | Force la fin de la génération actuelle |
| Reset | Recommence de zéro |

| Curseur | Effet | Défaut |
|---------|--------|--------|
| Sim speed | Cycles exécutés par frame (plus rapide = plus chaud) | 1 |
| Population | Nombre de véhicules par génération | 100 |
| New track every gen | ✓ Génère une nouvelle piste chaque génération | ✓ |

### **Network** (Réseau de neurones)
| Paramètre | Effet | Défaut |
|-----------|--------|--------|
| Rays | Nombre de capteurs directionnels | 9 |
| Waypoint lookahead | Checkpoints futurs envoyés au réseau | 2 |
| Hidden layers | Architecture du réseau (ex: "16" ou "32,16") | 16 |
| Activation | Fonction d'activation neuronale | sigmoid |
| Mutation rate | % de modification par génération | 0.1 |
| ✓ Separation behavior | Force de répulsion entre véhicules | ✓ |

### **Fitness weights** (Poids de performance)
La fitness est calculée ainsi :
```
fitness = (checkpoints_passés × poids_checkpoints)
        - (temps_vivant × poids_temps)
        - (collisions × poids_collisions)
```

| Poids | Signification | Défaut |
|-------|---------------|--------|
| Checkpoint weight | Récompense pour passer un checkpoint | 1.0 |
| Time penalty | Pénalité par frame vivant | 0.001 |
| **Collision penalty** ⭐ | **Pénalité pour crash** | **5.0** |

💡 **Pour réduire les crashs** : augmenter "Collision penalty" à 12-15

### **Stop condition** (Arrêt automatique)
| Type | Déclenche quand |
|------|-----------------|
| Never | Jamais (entraînement infini) |
| Generations | Après N générations |
| Avg fitness | Fitness moyenne > seuil |
| % completed lap | X% des véhicules complètent une boucle |

### **Stats** (Statistiques)
- **Mode** : Mode actuel (training/editor/race)
- **Generation** : Numéro de génération
- **Alive** : Véhicules vivants
- **Best fitness** : Meilleure performance vue
- **Avg fitness** : Performance moyenne
- **Lap %** : % de la population ayant complété un tour

### **Brain library** (Bibliothèque de cerveaux)
- **Save best** : Exporte le meilleur cerveau actuel en localStorage
- **Import** : Charge un fichier JSON contenant un cerveau
- Liste : Cerveaux sauvegardés (cliquer pour charger, ou cocher pour race)

### **Track library** (Bibliothèque de pistes)
- **Save current** : Exporte la piste de l'éditeur
- **Import** : Charge une piste JSON
- **Random** : Génère une nouvelle piste aléatoire
- Liste : Pistes sauvegardées

---

## 🧠 Implémentation technique

### Architecture générale

```
Vehicle (classe mère, immuable)
  ↓
RacingVehicle (héritage)
  ├─ Rayons capteurs configurables
  ├─ Entrées de waypoint (prochain checkpoint)
  ├─ Séparation d'évitement
  └─ Fitness riche (checkpoints - temps - collisions)

NeuralNetwork (TensorFlow.js)
  ↓
ExtendedNeuralNetwork (héritage)
  ├─ Couches cachées variables
  ├─ Activation fonction sélectionnable
  └─ Sauvegarde/Chargement JSON

GeneticAlgorithm (ga.js)
  ├─ Sélection roulette (proportionnelle à fitness)
  ├─ Mutation gaussienne des poids
  └─ Nouvelle génération = enfants + mutations

TrackEditor
  ├─ Placement de points de contrôle
  ├─ Génération auto de Boundaries
  └─ Serialization JSON

Storage
  ├─ localStorage (persistance navigateur)
  └─ Export/Import fichiers JSON
```

### Flux de simulation par frame

```
1. Vérifier l'état (pause, mode)
2. Pour chaque véhicule vivant :
   a. Capturer les distances via rayons (look)
   b. Ajouter entrées waypoint (prochains checkpoints)
   c. Réseau neuronal → [angle, vitesse]
   d. Appliquer séparation (évitement)
   e. Mettre à jour position/vitesse
   f. Vérifier collisions (mort)
   g. Vérifier checkpoints (fitness++)
3. Si tous morts : nextGenerationRacing()
4. Afficher la piste, les véhicules, les stats
```

### Données entrantes du réseau neuronal

Pour chaque véhicule :
```
Inputs = [
  ray_0, ray_1, ..., ray_N,              // distances normalisées [0,1]
  waypoint_1_angle, waypoint_1_distance,
  waypoint_2_angle, waypoint_2_distance,
  ...
]

Outputs = [
  steering_angle,  // direction à suivre [0,1] → [-π, π]
  throttle        // accélération [0,1] → [0, maxspeed]
]
```

### Mutation et évolution

**Roulette Wheel Selection** :
```js
// Chaque véhicule a une probabilité de reproduction 
// proportionnelle à sa fitness
fitness_normalized = fitness / sum(toutes_fitness)
```

**Mutation** :
```js
// Chaque poids du cerveau reçoit :
new_weight = old_weight + mutation_rate × N(0, 1)
// N(0,1) = distribution normale gaussienne
```

### Checkpoints et circuits

- **Checkpoint** = segment de ligne (Boundary) qui sépare la piste
- **Ordre** : Index 0 → 1 → 2 → ... → 0 (boucle)
- **Lap** : Quand index revient de N-1 → 0
- **Fitness** : +1 par checkpoint passé

---

## 💡 Conseils pour l'entraînement efficace

### Configuration recommandée pour débuter

```
Network:
  Rays: 15
  Waypoint lookahead: 3
  Hidden layers: 16
  Mutation rate: 0.06
  ✓ Separation behavior

Training:
  Population: 150
  Sim speed: 8

Fitness:
  Checkpoint: 1.0
  Time: 0.001
  Collision: 12.0
```

### Problèmes courants et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| Véhicules crashent trop | Collision penalty trop faible | ↑ Collision penalty à 12-15 |
| Pas de progrès | Mutation trop forte | ↓ Mutation rate à 0.05-0.07 |
| Lent | Trop de rayons + réseau gros | ↓ Rays à 9, simplifier layers |
| Apprentissage chaotique | Population trop petite | ↑ Population à 200+ |

### Phases d'apprentissage typiques

1. **Gen 0-10** : Chaos total, quelques flukey succès
2. **Gen 10-30** : Première convergence, évite les murs
3. **Gen 30-60** : Apprend le chemin optimal
4. **Gen 60+** : Affinage, laps plus rapides

---

## 🎮 Contrôles gestuels (MediaPipe)

Si activé, contrôlez avec votre main devant la caméra :

| Geste | Effet |
|-------|--------|
| 🖐️ Paume ouverte | Pause/Reprendre |
| ✊ Poing | Sauter génération |
| ☝️ Index gauche↔droit | Ajuster vitesse simulation |
| 👌 OK (pouce+index) | Sauvegarder meilleur cerveau |

---

## 📁 Structure des fichiers

```
index.html              ← Point d'entrée (charge tous les JS)

src/
  ├─ vehicle.js         (classe mère, immuable)
  ├─ nn.js              (NeuralNetwork, immuable)
  ├─ ray.js             (Ray casting, immuable)
  ├─ boundary.js        (Walls, immuable)
  ├─ ga.js              (Genetic Algorithm, immuable)
  ├─ sketch.js          (Setup/draw p5 originaux, immuable)
  │
  ├─ racing_vehicle.js  (RacingVehicle extends Vehicle)
  ├─ extended_nn.js     (ExtendedNeuralNetwork extends NeuralNetwork)
  ├─ obstacle.js        (Obstacle extends Boundary)
  ├─ editor.js          (TrackEditor, création de pistes)
  ├─ storage.js         (Persistance localStorage + JSON)
  ├─ ui.js              (Panneau 300px, contrôles)
  ├─ race_mode.js       (RaceMode, comparaison de cerveaux)
  ├─ gesture.js         (GestureController, MediaPipe)
  ├─ main.js            (Orchestration, setup/draw override)
  └─ stop_condition.js  (Arrêt automatique)

style.css               (Mise en page du panneau)
```

**Règle d'or** : Fichiers immuables (vehicle.js, nn.js, etc.) ne sont JAMAIS édités. Toutes les extensions passent par l'héritage de classe.

---

## 🔧 Extensions possibles

- Ajouter des capteurs supplémentaires (vitesse, accélération)
- Implémenter un pathfinding pour l'évaluation
- Étendre le fitness avec des récompenses géométriques
- Ajouter plusieurs véhicules en réseau (multi-agent learning)
- Exporter/importer vers JSON structuré pour l'analyse

---

## 📜 Licence et crédits

- **Base** : Codebase du professeur (p5.js + TensorFlow.js 1.1.0)
- **Extensions** : RacingVehicle, UI, Editor, Storage, GestureController
- **Concept** : Steering Behaviors + Genetic Algorithm

---

## ✅ Checklist de démarrage

- [ ] Ouvrir `index.html` dans le navigateur
- [ ] Vérifier que le canvas et le panneau s'affichent
- [ ] Cliquer "Reset" pour spawner une population
- [ ] Observer les générations progresser
- [ ] Ajuster les paramètres (Collision penalty, Rays)
- [ ] Sauvegarder un bon cerveau ("Save best")
- [ ] Créer une piste perso en mode Editor
- [ ] Tester la race avec plusieurs cerveaux

---

**Bon entraînement ! 🚗💨**

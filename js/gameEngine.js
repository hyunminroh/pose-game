/**
 * gameEngine.js
 * Fruit Catcher Game Logic
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60; // Game duration in seconds
    this.items = []; // Array to store falling items { x, y, type, speed }
    this.isGameActive = false;
    this.lastTime = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1500; // Initial spawn interval (ms)
    this.baseSpeed = 100; // Base falling speed (pixels/sec)

    // Player position (LEFT, CENTER, RIGHT)
    this.basketPosition = "CENTER";

    // Callbacks
    this.onScoreChange = null;
    this.onGameEnd = null;
  }

  /**
   * Start the game
   */
  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.items = [];
    this.spawnInterval = 1500;
    this.baseSpeed = 100;
    this.lastTime = performance.now();

    this.gameLoop();
  }

  /**
   * Stop the game
   */
  stop() {
    this.isGameActive = false;
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * Main Game Loop
   */
  gameLoop(currentTime = performance.now()) {
    if (!this.isGameActive) return;

    const deltaTime = (currentTime - this.lastTime) / 1000; // Seconds
    this.lastTime = currentTime;

    this.update(deltaTime);

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // 1. Timer Update
    this.timeLimit -= deltaTime;
    if (this.timeLimit <= 0) {
      this.timeLimit = 0;
      this.stop();
      return;
    }

    // 2. Spawn Items
    this.spawnTimer += deltaTime * 1000;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnItem();
      this.spawnTimer = 0;
    }

    // 3. Update Items (Falling)
    const canvasHeight = 200; // Assuming 200x200 canvas

    for (let i = this.items.length - 1; i >= 0; i--) {
      let item = this.items[i];
      item.y += item.speed * deltaTime;

      // Check Collision with Basket (at bottom)
      if (item.y >= canvasHeight - 20) { // Hit bottom area
        if (this.checkCollision(item)) {
          this.handleItemCollection(item);
          this.items.splice(i, 1); // Remove item
        } else if (item.y > canvasHeight) {
          this.items.splice(i, 1); // Missed item, remove
        }
      }
    }
  }

  /**
   * Spawn a new item
   */
  spawnItem() {
    const lanes = ["LEFT", "CENTER", "RIGHT"];
    const randomLane = lanes[Math.floor(Math.random() * lanes.length)];

    // Item Types: Apple (60%), Grape (30%), Bomb (10%)
    const rand = Math.random();
    let type = "apple";
    if (rand > 0.9) type = "bomb";
    else if (rand > 0.6) type = "grape";

    this.items.push({
      lane: randomLane,
      y: -20, // Start above screen
      type: type,
      speed: this.baseSpeed * (1 + (this.level - 1) * 0.2) // Speed increases with level
    });
  }

  /**
   * Check if item hits the player's basket
   */
  checkCollision(item) {
    // Simple check: Is the basket in the same lane as the item?
    // And item is close to bottom (handled in update loop condition)
    return item.lane.toLowerCase() === this.basketPosition.toLowerCase();
  }

  /**
   * Handle item collection effect
   */
  handleItemCollection(item) {
    if (item.type === "bomb") {
      this.stop(); // Game Over
    } else if (item.type === "apple") {
      this.addScore(100);
    } else if (item.type === "grape") {
      this.addScore(300);
    }
  }

  /**
   * Update Player Pose (from PoseEngine)
   */
  onPoseDetected(poseLabel) {
    if (!this.isGameActive) return;
    // Normalize label (Teachable Machine might return lowercase)
    this.basketPosition = poseLabel.toUpperCase();
  }

  addScore(points) {
    this.score += points;

    // Level Up every 1000 points
    const newLevel = Math.floor(this.score / 1000) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      this.baseSpeed *= 1.2; // Increase speed
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level, Math.floor(this.timeLimit));
    }
  }

  getItems() {
    return this.items;
  }

  getBasketPosition() {
    return this.basketPosition;
  }

  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }
}

window.GameEngine = GameEngine;

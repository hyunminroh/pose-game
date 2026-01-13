/**
 * gameEngine.js
 * Fruit Catcher Game Logic (Dynamic Difficulty)
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.items = [];
    this.isGameActive = false;
    this.lastTime = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1500;
    this.baseSpeed = 150; // Increased base speed for larger screen

    // Dynamic Difficulty Parameters
    this.totalLanes = 3; // Starts with 3
    this.basketWidthRatio = 0.2; // Basket width as percentage of screen width (0.2 = 20%)

    // Player Position (Continuous 0.0 to 1.0)
    this.basketX = 0.5; // Center

    // Callbacks
    this.onScoreChange = null;
    this.onGameEnd = null;
  }

  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.items = [];
    this.spawnInterval = 1500;
    this.baseSpeed = 150;
    this.lastTime = performance.now();

    // Reset difficulty
    this.totalLanes = 3;
    this.basketWidthRatio = 0.2; // Lane width is 1/3 ≈ 0.33, so basket is smaller than lane

    this.gameLoop();
  }

  stop() {
    this.isGameActive = false;
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  gameLoop(currentTime = performance.now()) {
    if (!this.isGameActive) return;

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  update(deltaTime) {
    // 1. Timer
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

    // 3. Update Items
    const canvasHeight = 600; // Updated for larger screen

    for (let i = this.items.length - 1; i >= 0; i--) {
      let item = this.items[i];
      item.y += item.speed * deltaTime;

      // Collision Detection (AABB-like logic)
      if (item.y >= canvasHeight - 50) { // Near bottom
        if (this.checkCollision(item)) {
          this.handleItemCollection(item);
          this.items.splice(i, 1);
        } else if (item.y > canvasHeight) {
          this.items.splice(i, 1);
        }
      }
    }
  }

  spawnItem() {
    // Pick a random lane index
    const laneIndex = Math.floor(Math.random() * this.totalLanes);

    // Calculate lane center position (0.0 to 1.0)
    // Lane 0 center: 1/(2*N), Lane 1: 3/(2*N), ... Lane k: (2k+1)/(2*N)
    const laneCenter = (2 * laneIndex + 1) / (2 * this.totalLanes);

    const rand = Math.random();
    let type = "apple";
    if (rand > 0.9) type = "bomb";
    else if (rand > 0.6) type = "grape";

    this.items.push({
      laneIndex: laneIndex, // Store index for easier logic if needed
      xRatio: laneCenter,   // Horizontal position (0.0 to 1.0)
      y: -50,
      type: type,
      speed: this.baseSpeed * (1 + (this.level - 1) * 0.15)
    });
  }

  checkCollision(item) {
    // Basket is at this.basketX (center of basket, 0.0-1.0)
    // Item is at item.xRatio (center of item, 0.0-1.0)
    // Basket Width is this.basketWidthRatio (e.g. 0.2)
    // Item Width is approx 0.05 (small)

    const basketHalfWidth = this.basketWidthRatio / 2;
    const itemHalfWidth = 0.04; // Approx item radius ratio

    const dist = Math.abs(this.basketX - item.xRatio);
    return dist < (basketHalfWidth + itemHalfWidth);
  }

  handleItemCollection(item) {
    if (item.type === "bomb") {
      this.stop();
    } else if (item.type === "apple") {
      this.addScore(100);
    } else if (item.type === "grape") {
      this.addScore(300);
    }
  }

  /**
   * Set Basket Position directly (Control Input)
   * @param {number} xRatio - 0.0 to 1.0
   */
  setBasketPosition(xRatio) {
    if (!this.isGameActive) return;
    // Clamp to screen bounds
    this.basketX = Math.max(0, Math.min(1, xRatio));
  }

  addScore(points) {
    this.score += points;

    // Level Up every 1000 points
    const newLevel = Math.floor(this.score / 1000) + 1;

    if (newLevel > this.level) {
      this.level = newLevel;
      this.baseSpeed *= 1.1;

      // Increase difficulty: Add lanes every 2 levels?
      // Let's just add a lane every 2 levels to keep it sane.
      if (this.level % 2 === 1) { // Level 3, 5, 7...
        this.totalLanes++;
      }

      // Shrink basket slightly each level (down to min 10%)
      this.basketWidthRatio = Math.max(0.1, 0.2 - (this.level - 1) * 0.02);
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level, Math.floor(this.timeLimit));
    }
  }

  // Getters for Renderer
  getItems() { return this.items; }
  getBasketX() { return this.basketX; }
  getBasketWidthRatio() { return this.basketWidthRatio; }
  getTotalLanes() { return this.totalLanes; }

  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
}

window.GameEngine = GameEngine;

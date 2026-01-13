/**
 * gameEngine.js
 * Fruit Catcher Game Logic (Lives System)
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.lives = 3; // Heart System
    this.items = [];
    this.isGameActive = false;
    this.lastTime = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1500;
    this.baseSpeed = 150;

    // Dynamic Difficulty Parameters
    this.totalLanes = 3;
    this.basketWidthRatio = 0.2;

    // Player Position
    this.basketX = 0.5;

    // Callbacks
    this.onScoreChange = null;
    this.onGameEnd = null;
  }

  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.lives = 3; // Reset lives
    this.items = [];
    this.spawnInterval = 1500;
    this.baseSpeed = 150;
    this.lastTime = performance.now();

    // Reset difficulty
    this.totalLanes = 3;
    this.basketWidthRatio = 0.2;

    this.updateScoreUI(); // Initial update
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
    // 1. Spawn Items
    this.spawnTimer += deltaTime * 1000;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnItem();
      this.spawnTimer = 0;
    }

    // 2. Update Items & Check Misses
    const canvasHeight = 600;

    for (let i = this.items.length - 1; i >= 0; i--) {
      let item = this.items[i];
      item.y += item.speed * deltaTime;

      // Collision Detection
      if (item.y >= canvasHeight - 50 && item.y < canvasHeight + 20) {
        if (this.checkCollision(item)) {
          this.handleItemCollection(item);
          this.items.splice(i, 1);
          continue;
        }
      }

      // Missed Item Detection
      if (item.y > canvasHeight) {
        // If it was a good item (Apple/Grape), lose a life
        if (item.type !== "bomb") {
          this.loseLife();
        }
        this.items.splice(i, 1);
      }
    }
  }

  spawnItem() {
    const laneIndex = Math.floor(Math.random() * this.totalLanes);
    const laneCenter = (2 * laneIndex + 1) / (2 * this.totalLanes);

    const rand = Math.random();
    let type = "apple";
    if (rand > 0.9) type = "bomb";
    else if (rand > 0.6) type = "grape";

    this.items.push({
      laneIndex: laneIndex,
      xRatio: laneCenter,
      y: -50,
      type: type,
      speed: this.baseSpeed * (1 + (this.level - 1) * 0.15)
    });
  }

  checkCollision(item) {
    const basketHalfWidth = this.basketWidthRatio / 2;
    const itemHalfWidth = 0.04;

    const dist = Math.abs(this.basketX - item.xRatio);
    return dist < (basketHalfWidth + itemHalfWidth);
  }

  handleItemCollection(item) {
    if (item.type === "bomb") {
      this.lives = 0; // Instant death
      this.updateScoreUI();
      this.stop();
    } else if (item.type === "apple") {
      this.addScore(100);
    } else if (item.type === "grape") {
      this.addScore(300);
    }
  }

  loseLife() {
    this.lives--;
    this.updateScoreUI();
    if (this.lives <= 0) {
      this.stop();
    }
  }

  setBasketPosition(xRatio) {
    if (!this.isGameActive) return;
    this.basketX = Math.max(0, Math.min(1, xRatio));
  }

  addScore(points) {
    this.score += points;

    // Level Up
    const newLevel = Math.floor(this.score / 1000) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      this.baseSpeed *= 1.1;
      if (this.level % 2 === 1) {
        this.totalLanes++;
      }
      this.basketWidthRatio = Math.max(0.1, 0.2 - (this.level - 1) * 0.02);
    }

    this.updateScoreUI();
  }

  updateScoreUI() {
    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level, this.lives);
    }
  }

  getItems() { return this.items; }
  getBasketX() { return this.basketX; }
  getBasketWidthRatio() { return this.basketWidthRatio; }
  getTotalLanes() { return this.totalLanes; }

  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
}

window.GameEngine = GameEngine;

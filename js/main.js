/**
 * main.js
 * connects PoseEngine, GameEngine, and UI, handles Input Selection
 */

// Global Variables
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

// State
let inputType = null; // 'camera' | 'keyboard'
let animationId = null;
let keys = { ArrowLeft: false, ArrowRight: false };

// Space Theme Background Stars
const STAR_BG = [];
const GAME_SIZE = 600; // Large Canvas Size
// Generate random stars for background once
for (let i = 0; i < 100; i++) {
  STAR_BG.push({
    x: Math.random() * GAME_SIZE,
    y: Math.random() * GAME_SIZE,
    size: Math.random() * 2 + 1,
    opacity: Math.random()
  });
}

// UI Elements
const scoreVal = document.getElementById("score-val");
const levelVal = document.getElementById("level-val");
const livesVal = document.getElementById("lives-val");

// Configuration
const WEBCAM_SIZE = 200; // Model input size
const KEYBOARD_SPEED = 1.5; // Speed for keyboard movement

/**
 * Mode Selection
 */
function selectMode(mode) {
  inputType = mode;
  document.getElementById("selection-screen").style.display = "none";
  document.getElementById("game-container").style.display = "block";

  // Hide max-prediction if keyboard
  if (mode === 'keyboard') {
    document.getElementById("max-prediction").style.display = "none";
    document.getElementById("label-container").style.display = "none";
  }
}

/**
 * Initialize Game based on selection
 */
async function initGame() {
  if (!inputType) {
    alert("Please select a control mode first!");
    return;
  }

  const startBtn = document.getElementById("startBtn");
  startBtn.disabled = true;

  try {
    // Common Game Engine Init
    if (!gameEngine) {
      gameEngine = new GameEngine();
      setupGameCallbacks();
    }

    const canvas = document.getElementById("canvas");
    canvas.width = GAME_SIZE;
    canvas.height = GAME_SIZE;
    ctx = canvas.getContext("2d");

    // Start Game Logic first
    gameEngine.start();

    if (inputType === 'camera') {
      await startCameraMode();
    } else {
      startKeyboardMode();
    }

    document.getElementById("stopBtn").disabled = false;

  } catch (error) {
    console.error("Init Error:", error);
    alert("Failed to initialize. Check console.");
    startBtn.disabled = false;
  }
}

function setupGameCallbacks() {
  gameEngine.setScoreChangeCallback((score, level, lives) => {
    if (scoreVal) scoreVal.innerText = score;
    if (levelVal) levelVal.innerText = level;

    // Render Hearts
    if (livesVal) {
      let hearts = "";
      for (let i = 0; i < lives; i++) hearts += "❤️";
      livesVal.innerText = hearts;
    }
  });

  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    alert(`Game Over! Score: ${finalScore}\nReturning to Menu...`);
    location.reload();
  });
}

/**
 * Camera Mode Implementation
 */
async function startCameraMode() {
  // 1. PoseEngine Init
  poseEngine = new PoseEngine("./my_model/");
  const { maxPredictions } = await poseEngine.init({
    size: WEBCAM_SIZE,
    flip: true
  });

  // 2. Stabilizer Init
  stabilizer = new PredictionStabilizer({
    threshold: 0.8,
    smoothingFrames: 3
  });

  // 3. Label Container
  labelContainer = document.getElementById("label-container");
  labelContainer.innerHTML = "";
  for (let i = 0; i < maxPredictions; i++) {
    labelContainer.appendChild(document.createElement("div"));
  }

  // 4. Callbacks
  poseEngine.setPredictionCallback(handlePrediction);
  poseEngine.setDrawCallback(drawPose);

  // 5. Start Webcam Loop
  poseEngine.start();
}

/**
 * Keyboard Mode Implementation
 */
function startKeyboardMode() {
  // Setup Key Listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Start Input/Render Loop
  loopKeyboard();
}

function handleKeyDown(e) {
  if (e.code === "ArrowLeft") keys.ArrowLeft = true;
  if (e.code === "ArrowRight") keys.ArrowRight = true;
}

function handleKeyUp(e) {
  if (e.code === "ArrowLeft") keys.ArrowLeft = false;
  if (e.code === "ArrowRight") keys.ArrowRight = false;
}

function loopKeyboard() {
  if (!gameEngine || !gameEngine.isGameActive) return;

  // Update Basket Position
  updateKeyboardInput();

  // Render Frame
  drawKeyboardFrame();

  animationId = requestAnimationFrame(loopKeyboard);
}

function updateKeyboardInput() {
  let currentX = gameEngine.getBasketX(); // 0.0 to 1.0

  if (keys.ArrowLeft) currentX -= 0.01 * KEYBOARD_SPEED;
  if (keys.ArrowRight) currentX += 0.01 * KEYBOARD_SPEED;

  gameEngine.setBasketPosition(currentX);
}

function drawKeyboardFrame() {
  // Clear / Space Background
  ctx.fillStyle = "#0d1b2a"; // Deep Space Blue
  ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);

  // Draw Stars
  ctx.fillStyle = "white";
  STAR_BG.forEach(star => {
    ctx.globalAlpha = star.opacity;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;

  // Draw Game Elements
  drawGameElements();
}

/**
 * Stop Application
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) poseEngine.stop();
  if (gameEngine) gameEngine.stop();
  if (stabilizer) stabilizer.reset();

  if (inputType === 'keyboard') {
    window.cancelAnimationFrame(animationId);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * Handle Prediction & Control (Camera Mode)
 */
function handlePrediction(predictions, pose) {
  // Stabilize & UI
  const stabilized = stabilizer.stabilize(predictions);

  if (labelContainer && labelContainer.childNodes.length > 0) {
    for (let i = 0; i < predictions.length; i++) {
      const classPrediction =
        predictions[i].className + ": " + predictions[i].probability.toFixed(2);
      labelContainer.childNodes[i].innerHTML = classPrediction;
    }
  }

  const maxPredictionDiv = document.getElementById("max-prediction");
  if (maxPredictionDiv) {
    maxPredictionDiv.innerHTML = stabilized.className || "Detecting...";
  }

  // Head Tracking Control
  if (gameEngine && gameEngine.isGameActive && pose) {
    const nose = pose.keypoints.find(k => k.part === "nose");

    if (nose && nose.score > 0.5) {
      const normalizedX = nose.position.x / WEBCAM_SIZE;
      gameEngine.setBasketPosition(normalizedX);
    }
  }
}

/**
 * Draw Pose (Camera Mode)
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    // Draw Webcam Feed Background
    ctx.save();
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0, GAME_SIZE, GAME_SIZE);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);
    ctx.restore();

    // Draw Game Elements
    if (gameEngine && gameEngine.isGameActive) {
      drawGameElements();
    }
  }
}

/**
 * Render Game Elements (Common)
 */
function drawGameElements() {
  const items = gameEngine.getItems();
  const basketXRatio = gameEngine.getBasketX();
  const basketWidthRatio = gameEngine.getBasketWidthRatio();
  const totalLanes = gameEngine.getTotalLanes();

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Draw Lanes (Subtle Energy Beams)
  ctx.strokeStyle = "rgba(100, 255, 218, 0.1)"; // Cyan faint
  ctx.lineWidth = 1;
  ctx.beginPath();
  const laneWidth = width / totalLanes;
  for (let i = 1; i < totalLanes; i++) {
    ctx.moveTo(laneWidth * i, 0);
    ctx.lineTo(laneWidth * i, height);
  }
  ctx.stroke();

  // Draw Spaceship (Player)
  const shipW = width * basketWidthRatio;
  const shipX = (width * basketXRatio);
  const shipY = height - 50;

  ctx.save();
  ctx.translate(shipX, shipY);

  // Ship Body
  ctx.beginPath();
  ctx.moveTo(0, -30); // Tip
  ctx.lineTo(shipW / 2, 20); // Right Wing
  ctx.lineTo(0, 10); // Rear Center
  ctx.lineTo(-shipW / 2, 20); // Left Wing
  ctx.closePath();

  ctx.fillStyle = "#e74c3c"; // Red/Orange Ship
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#c0392b";
  ctx.stroke();

  // Cockpit
  ctx.beginPath();
  ctx.arc(0, -5, 8, 0, 2 * Math.PI);
  ctx.fillStyle = "#3498db"; // Blue Glass
  ctx.fill();

  // Engine Flame
  ctx.beginPath();
  ctx.moveTo(-5, 10);
  ctx.lineTo(5, 10);
  ctx.lineTo(0, 30 + Math.random() * 10); // Flicker
  ctx.fillStyle = "#f1c40f"; // Yellow Flame
  ctx.fill();

  // Label "ME"
  ctx.fillStyle = "white";
  ctx.font = "bold 12px Arial";
  ctx.fillText("ME", 0, 35);

  ctx.restore();

  // Draw Space Items
  items.forEach(item => {
    const itemX = item.xRatio * width;
    const itemY = item.y;

    ctx.save();
    ctx.translate(itemX, itemY);

    if (item.type === "apple" || item.type === "grape") {
      // Draw Star (Points)
      const color = item.type === "apple" ? "#f1c40f" : "#9b59b6"; // Yellow or Purple Star
      const points = 5;
      const outerRadius = 25;
      const innerRadius = 12;

      ctx.beginPath();
      ctx.fillStyle = color;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / points;
        ctx.lineTo(r * Math.sin(angle), r * Math.cos(angle));
      }
      ctx.closePath();
      ctx.fill();

      // Glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.stroke();

    } else if (item.type === "bomb") {
      // Draw Asteroid (Rock)
      ctx.fillStyle = "#7f8c8d"; // Grey
      ctx.beginPath();
      // Irregular circle shape approximation
      ctx.moveTo(20, 0);
      ctx.lineTo(15, 15);
      ctx.lineTo(0, 25);
      ctx.lineTo(-15, 15);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-15, -15);
      ctx.lineTo(0, -20);
      ctx.lineTo(18, -10);
      ctx.closePath();
      ctx.fill();

      // Craters
      ctx.fillStyle = "#636e72"; // Darker Grey
      ctx.beginPath();
      ctx.arc(-5, -5, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8, 5, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  });

  // Keyboard mode hint
  if (inputType === 'keyboard') {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "14px Arial";
    ctx.fillText("Use Arrow Keys to Fly", 10, 30);
  }
}

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

// UI Elements
const scoreVal = document.getElementById("score-val");
const levelVal = document.getElementById("level-val");
const livesVal = document.getElementById("lives-val");

// Configuration
const GAME_SIZE = 600; // Large Canvas Size
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
  // Clear / Background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);

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

  // Draw Lanes
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const laneWidth = width / totalLanes;
  for (let i = 1; i < totalLanes; i++) {
    ctx.moveTo(laneWidth * i, 0);
    ctx.lineTo(laneWidth * i, height);
  }
  ctx.stroke();

  // Draw Basket
  const basketW = width * basketWidthRatio;
  const basketX = (width * basketXRatio) - (basketW / 2);

  ctx.fillStyle = "rgba(0, 255, 100, 0.8)";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.fillRect(basketX, height - 40, basketW, 30);
  ctx.strokeRect(basketX, height - 40, basketW, 30);

  ctx.fillStyle = "white";
  ctx.font = "bold 16px Arial";
  ctx.fillText("ME", Math.max(0, basketX), height - 45);

  // Draw Items
  items.forEach(item => {
    const itemX = item.xRatio * width;
    const itemY = item.y;

    ctx.beginPath();
    if (item.type === "apple") {
      ctx.fillStyle = "#ff4757"; // Red
      ctx.arc(itemX, itemY, 20, 0, 2 * Math.PI);
      ctx.fill();
      // Stem
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(itemX - 2, itemY - 24, 4, 8);
    } else if (item.type === "grape") {
      ctx.fillStyle = "#8e44ad"; // Purple
      ctx.arc(itemX, itemY, 18, 0, 2 * Math.PI);
      ctx.fill();
      // Cluster
      ctx.beginPath();
      ctx.arc(itemX - 10, itemY - 10, 10, 0, 2 * Math.PI);
      ctx.arc(itemX + 10, itemY - 10, 10, 0, 2 * Math.PI);
      ctx.arc(itemX, itemY + 14, 10, 0, 2 * Math.PI);
      ctx.fill();
    } else if (item.type === "bomb") {
      ctx.fillStyle = "#2f3542"; // Black
      ctx.arc(itemX, itemY, 25, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#eccc68";
      ctx.fillText("!", itemX - 4, itemY + 8);
    }
  });

  // Keyboard mode hint
  if (inputType === 'keyboard') {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "14px Arial";
    ctx.fillText("Use Arrow Keys to Move", 10, 30);
  }
}

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

  // 3. Setup Webcam Container (Side View)
  const webcamArea = document.getElementById("webcam-area");
  webcamArea.style.display = "flex"; // Show separate webcam area

  // Clear and Append Webcam Canvas to the DOM Container (NOT the Game Canvas)
  const webcamContainer = document.getElementById("webcam-container");
  webcamContainer.innerHTML = "";
  webcamContainer.appendChild(poseEngine.webcam.canvas);

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

  // Hide Webcam Area
  document.getElementById("webcam-area").style.display = "none";

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
  // Reuse the Space Background Draw Logic
  drawSpaceBackground();

  // Draw Game Elements
  drawGameElements();
}

/**
 * Helper to Draw Space Background (Used in both modes)
 */
function drawSpaceBackground() {
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
 * Renders Game Frame using Space BG (No webcam feed on game canvas)
 */
function drawPose(pose) {
  // IMPORTANT: Do NOT draw webcam feed here.
  // Webcam feed is shown in the separate #webcam-container DOM element.

  // Render Game Canvas
  drawSpaceBackground();

  // Draw Game Elements
  if (gameEngine && gameEngine.isGameActive) {
    drawGameElements();
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

  // Draw Spaceship (Player) - Detailed Design
  const shipW = width * basketWidthRatio;
  const shipX = (width * basketXRatio);
  const shipY = height - 50;

  ctx.save();
  ctx.translate(shipX, shipY);

  const scale = 0.8;
  ctx.scale(scale, scale);

  // 1. Side Boosters
  ctx.fillStyle = "#bdc3c7";
  ctx.strokeStyle = "#7f8c8d";

  ctx.beginPath(); ctx.rect(-shipW / 2 - 5, 0, 10, 30); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(shipW / 2 - 5, 0, 10, 30); ctx.fill(); ctx.stroke();

  // 2. Main Fuselage
  ctx.fillStyle = "#ecf0f1";
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.quadraticCurveTo(15, -10, 15, 30);
  ctx.lineTo(0, 40);
  ctx.lineTo(-15, 30);
  ctx.quadraticCurveTo(-15, -10, 0, -50);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#95a5a6";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(0, 35); ctx.stroke();

  // 3. Wings
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(shipW / 1.5, 35); ctx.lineTo(10, 25); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-shipW / 1.5, 35); ctx.lineTo(-10, 25); ctx.fill();

  // 4. Cockpit
  ctx.fillStyle = "#2c3e50";
  ctx.beginPath(); ctx.ellipse(0, -15, 5, 12, 0, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath(); ctx.ellipse(-2, -18, 1, 3, 0, 0, 2 * Math.PI); ctx.fill();

  // 5. Engine Flames
  ctx.fillStyle = "#e67e22";
  ctx.beginPath(); ctx.moveTo(-5, 40); ctx.lineTo(5, 40); ctx.lineTo(0, 60 + Math.random() * 15); ctx.fill();
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath(); ctx.moveTo(-shipW / 2 - 3, 30); ctx.lineTo(-shipW / 2 + 3, 30); ctx.lineTo(-shipW / 2, 45 + Math.random() * 5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(shipW / 2 - 3, 30); ctx.lineTo(shipW / 2 + 3, 30); ctx.lineTo(shipW / 2, 45 + Math.random() * 5); ctx.fill();

  // Label "ME"
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.fillText("ME", 0, 75);

  ctx.restore();

  // Draw Space Items
  items.forEach(item => {
    const itemX = item.xRatio * width;
    const itemY = item.y;

    ctx.save();
    ctx.translate(itemX, itemY);

    if (item.type === "apple" || item.type === "grape") {
      // Star
      const color = item.type === "apple" ? "#f1c40f" : "#9b59b6";
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

      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.stroke();

    } else if (item.type === "bomb") {
      // Asteroid
      ctx.fillStyle = "#7f8c8d";
      ctx.beginPath();
      ctx.moveTo(20, 0); ctx.lineTo(15, 15); ctx.lineTo(0, 25); ctx.lineTo(-15, 15);
      ctx.lineTo(-25, 0); ctx.lineTo(-15, -15); ctx.lineTo(0, -20); ctx.lineTo(18, -10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#636e72";
      ctx.beginPath(); ctx.arc(-5, -5, 5, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(8, 5, 3, 0, 2 * Math.PI); ctx.fill();
    }

    ctx.restore();
  });
}

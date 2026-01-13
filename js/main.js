/**
 * main.js
 * connects PoseEngine, GameEngine, and UI
 */

// Global Variables
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

// UI Elements
const scoreVal = document.getElementById("score-val");
const levelVal = document.getElementById("level-val");
const timeVal = document.getElementById("time-val");

// Configuration
const GAME_SIZE = 600; // Large Canvas Size
const WEBCAM_SIZE = 200; // Model input size

/**
 * Initialize Application
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine Init (Webcam 200px for model performance)
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: WEBCAM_SIZE,
      flip: true
    });

    // 2. Stabilizer (Not strictly needed for continuous control but keeps noise down in UI)
    stabilizer = new PredictionStabilizer({
      threshold: 0.8,
      smoothingFrames: 3
    });

    // 3. GameEngine Init
    gameEngine = new GameEngine();

    // UI Callbacks
    gameEngine.setScoreChangeCallback((score, level, time) => {
      if (scoreVal) scoreVal.innerText = score;
      if (levelVal) levelVal.innerText = level;
      if (timeVal) timeVal.innerText = time;
    });

    gameEngine.setGameEndCallback((finalScore, finalLevel) => {
      alert(`Game Over! Score: ${finalScore}`);
      stop();
    });

    // 4. Canvas Setup (SCALED UP)
    const canvas = document.getElementById("canvas");
    canvas.width = GAME_SIZE;
    canvas.height = GAME_SIZE;
    ctx = canvas.getContext("2d");

    // 5. Label Container Setup (Optional debug)
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine Callbacks
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. Start Engines
    poseEngine.start();
    gameEngine.start();

    stopBtn.disabled = false;
  } catch (error) {
    console.error("Init Error:", error);
    alert("Failed to initialize. Check console.");
    startBtn.disabled = false;
  }
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

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * Handle Prediction & Control
 */
function handlePrediction(predictions, pose) {
  // 1. Process Classification (for Debug UI)
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

  // 2. Head Tracking Control (Continuous)
  if (gameEngine && gameEngine.isGameActive && pose) {
    // Find Nose Keypoint (Label "nose")
    // Keypoints: 0: nose, 1: leftEye, 2: rightEye, 3: leftEar, 4: rightEar...
    const nose = pose.keypoints.find(k => k.part === "nose");

    if (nose && nose.score > 0.5) {
      // webcam.canvas is 200x200
      // Normalized X (0.0 to 1.0)
      // Note: Webcam is flipped in PoseEngine, so x=0 is left on screen (mirror)
      const normalizedX = nose.position.x / WEBCAM_SIZE;

      gameEngine.setBasketPosition(normalizedX);
    }
  }
}

/**
 * Draw Pose & Game Elements
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    // 1. Draw Webcam Feed Background (Scaled Up)
    ctx.save();
    // Use scaling or drawImage size
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0, GAME_SIZE, GAME_SIZE);

    // Optional: Darken background to make game elements pop
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);

    // 2. Draw Skeleton (Visual Debug - Scaled)
    /*
    if (pose) {
      const scale = GAME_SIZE / WEBCAM_SIZE;
      const minPartConfidence = 0.5;
      
      // Helper to scale and draw
      // (Simplified: just drawing nose logic for verification if needed)
      const nose = pose.keypoints.find(k => k.part === "nose");
      if (nose && nose.score > 0.5) {
          ctx.beginPath();
          ctx.arc(nose.position.x * scale, nose.position.y * scale, 10, 0, 2*Math.PI);
          ctx.fillStyle = "yellow";
          ctx.fill();
      }
    }
    */
    ctx.restore();

    // 3. Draw Game Elements
    if (gameEngine && gameEngine.isGameActive) {
      drawGameElements();
    }
  }
}

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

  // Draw Basket (Player)
  // basketXRatio is center, basketWidthRatio is total width
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
    // item.xRatio is center
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
      ctx.arc(itemX, itemY, 18, 0, 2 * Math.PI); // Main body
      ctx.fill();
      // Simple grape cluster look
      ctx.beginPath();
      ctx.arc(itemX - 10, itemY - 10, 10, 0, 2 * Math.PI);
      ctx.arc(itemX + 10, itemY - 10, 10, 0, 2 * Math.PI);
      ctx.arc(itemX, itemY + 14, 10, 0, 2 * Math.PI);
      ctx.fill();
    } else if (item.type === "bomb") {
      ctx.fillStyle = "#2f3542"; // Black/Grey
      ctx.arc(itemX, itemY, 25, 0, 2 * Math.PI);
      ctx.fill();
      // Spark
      ctx.fillStyle = "#eccc68";
      ctx.fillText("!", itemX - 4, itemY + 8);
    }
  });
}

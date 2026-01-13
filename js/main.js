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

/**
 * Initialize Application
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine Init
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer Init
    stabilizer = new PredictionStabilizer({
      threshold: 0.8, // Slightly higher threshold for stability
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

    // 4. Canvas Setup
    const canvas = document.getElementById("canvas");
    canvas.width = 200;
    canvas.height = 200;
    ctx = canvas.getContext("2d");

    // 5. Label Container Setup
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
 * Handle Prediction
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilize
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Update Label UI
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction =
      predictions[i].className + ": " + predictions[i].probability.toFixed(2);
    labelContainer.childNodes[i].innerHTML = classPrediction;
  }

  // 3. Max Prediction UI
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "Detecting...";

  // 4. Pass to GameEngine
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.onPoseDetected(stabilized.className);
  }
}

/**
 * Draw Pose & Game Elements
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    // Draw Webcam Feed
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    // Draw Skeleton (Optional, maybe distracting for game?)
    // if (pose) {
    //   const minPartConfidence = 0.5;
    //   tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
    //   tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    // }

    // Draw Game Elements
    if (gameEngine && gameEngine.isGameActive) {
      drawGameElements();
    }
  }
}

function drawGameElements() {
  const items = gameEngine.getItems();
  const basketPos = gameEngine.getBasketPosition();
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const laneWidth = width / 3;

  // Draw Lanes (Visual Guide)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(laneWidth, 0);
  ctx.lineTo(laneWidth, height);
  ctx.moveTo(laneWidth * 2, 0);
  ctx.lineTo(laneWidth * 2, height);
  ctx.stroke();

  // Draw Basket (Player)
  let basketX = laneWidth * 1.5; // Default Center
  if (basketPos === "LEFT") basketX = laneWidth * 0.5;
  else if (basketPos === "RIGHT") basketX = laneWidth * 2.5;

  ctx.fillStyle = "rgba(0, 255, 0, 0.7)";
  ctx.fillRect(basketX - 25, height - 30, 50, 20);
  ctx.fillStyle = "white";
  ctx.font = "12px Arial";
  ctx.fillText("ME", basketX - 10, height - 15);

  // Draw Items
  items.forEach(item => {
    let itemX = laneWidth * 1.5;
    if (item.lane === "LEFT") itemX = laneWidth * 0.5;
    else if (item.lane === "RIGHT") itemX = laneWidth * 2.5;

    // Draw different shapes/colors based on type
    if (item.type === "apple") {
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(itemX, item.y, 10, 0, 2 * Math.PI);
      ctx.fill();
    } else if (item.type === "grape") {
      ctx.fillStyle = "purple";
      ctx.beginPath();
      ctx.arc(itemX, item.y, 8, 0, 2 * Math.PI);
      ctx.fill();
    } else if (item.type === "bomb") {
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(itemX, item.y, 12, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "red";
      ctx.fillText("!", itemX - 2, item.y + 4);
    }
  });
}


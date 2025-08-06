// Sheep Farm Sorting Game

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const PATH_Y = 200;
const PATH_WIDTH = 100;
// Remove DOOR_X constant, use dynamic calculation
// const DOOR_X = 400;
const DOOR_Y = PATH_Y + PATH_WIDTH / 2 - 30;
const DOOR_WIDTH = 24; // much smaller width for the door
const DOOR_HEIGHT = 60;
// Update lamb area to be at the top
const LAMB_AREA_X = 0;
const LAMB_AREA_Y = 0;
const LAMB_AREA_HEIGHT = 80; // height at the top
const SHEEP_AREA_X = 650;
const SHEEP_AREA_Y = 100;
const SHEEP_AREA_WIDTH = 120;
const SHEEP_AREA_HEIGHT = 300;

let doorPosition = 'straight'; // 'straight' or 'left'
let sheepList = [];
let score = 0;
let missed = 0;
let spawnTimer = 0;
let paused = false;
let gameOver = false;
let lastFrameTime = null;
let pausedAt = null;

// Store persistent grass positions
let grassTufts = null;
// Store persistent dirt patches
let lambDirtPatches = null;
let sheepDirtPatches = null;

function randomSheep() {
  // 60% sheep, 40% lamb
  return Math.random() < 0.6 ? 'sheep' : 'lamb';
}

function spawnSheep() {
  const type = randomSheep();
  sheepList.push({
    x: 0,
    y: PATH_Y + PATH_WIDTH / 2 - 20 + Math.random() * 20,
    type,
    sorted: false,
    speed: type === 'sheep' ? (4 + Math.random() * 3) : (2 + Math.random() * 1.5), // sheep are twice as fast
  });
}

// Lamb area is now half the canvas width and right-aligned with the sheep area
function getLambArea() {
  const width = Math.floor(canvas.width / 2);
  const x = canvas.width - width;
  return { x, y: 0, width, height: LAMB_AREA_HEIGHT };
}

function generateGrassTufts() {
  const grassColors = ['#7ec850', '#5fa83c', '#a2e06e'];
  const tufts = [];
  const lambArea = getLambArea();
  // Top left (above path, left of lamb area)
  for (let x = 0; x < lambArea.x; x += 10) {
    for (let y = 0; y < LAMB_AREA_HEIGHT; y += 10) {
      tufts.push(generateGrassTuft(x, y, grassColors));
    }
  }
  // Below path (left of sheep area)
  for (let x = 0; x < canvas.width - SHEEP_AREA_WIDTH; x += 10) {
    for (let y = PATH_Y + PATH_WIDTH; y < canvas.height; y += 10) {
      tufts.push(generateGrassTuft(x, y, grassColors));
    }
  }
  // Below path (right of sheep area)
  for (let x = canvas.width - SHEEP_AREA_WIDTH; x < canvas.width; x += 10) {
    for (let y = PATH_Y + PATH_WIDTH; y < canvas.height; y += 10) {
      tufts.push(generateGrassTuft(x, y, grassColors));
    }
  }
  // Above path, right of lamb area (if any)
  for (let x = lambArea.x + lambArea.width; x < canvas.width; x += 10) {
    for (let y = 0; y < LAMB_AREA_HEIGHT; y += 10) {
      tufts.push(generateGrassTuft(x, y, grassColors));
    }
  }
  return tufts;
}

function generateGrassTuft(x, y, colors) {
  // Each tuft is a set of static blades
  const bladeCount = 3 + Math.floor(Math.random() * 3);
  const blades = [];
  for (let i = 0; i < bladeCount; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const dx = Math.floor(Math.random() * 6);
    const dy = Math.floor(Math.random() * 6);
    blades.push({ color, dx, dy });
  }
  return { x, y, blades };
}

function drawGrass() {
  // 8-bit: Fill all non-playable areas with grass tufts in a grid
  const lambArea = getLambArea();
  const sheepArea = {
    x: canvas.width - SHEEP_AREA_WIDTH,
    y: SHEEP_AREA_Y,
    width: SHEEP_AREA_WIDTH,
    height: SHEEP_AREA_HEIGHT
  };
  const pathRect = { x: 0, y: PATH_Y, width: canvas.width, height: PATH_WIDTH };
  const cellSize = 10;
  for (let x = 0; x < canvas.width; x += cellSize) {
    for (let y = 0; y < canvas.height; y += cellSize) {
      // Skip playable areas
      const inLamb = x >= lambArea.x && x < lambArea.x + lambArea.width && y >= lambArea.y && y < lambArea.y + lambArea.height;
      const inSheep = x >= sheepArea.x && x < sheepArea.x + sheepArea.width && y >= sheepArea.y && y < sheepArea.y + sheepArea.height;
      const inPath = x >= pathRect.x && x < pathRect.x + pathRect.width && y >= pathRect.y && y < pathRect.y + pathRect.height;
      if (!inLamb && !inSheep && !inPath) {
        // Draw a grass tuft (blocky)
        const color = ['#7ec850', '#5fa83c', '#a2e06e'][((x + y) / cellSize) % 3];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 8, 8);
        // Add a few extra blocks for variety
        if ((x + y) % 20 < 7) ctx.fillRect(x + 2, y + 4, 4, 4);
      }
    }
  }
}

function drawGrassTuft(tuft) {
  // 8-bit: Each tuft is a cluster of small green blocks
  for (const blade of tuft.blades) {
    ctx.fillStyle = blade.color;
    ctx.fillRect(Math.round(tuft.x + blade.dx), Math.round(tuft.y + blade.dy), 4, 4);
  }
}

function generateDirtPatches(x, y, width, height, patchColors) {
  const patches = [];
  for (let i = 0; i < Math.floor((width * height) / 120); i++) {
    const px = x + Math.floor(Math.random() * width);
    const py = y + Math.floor(Math.random() * height);
    const w = 8 + Math.floor(Math.random() * 16);
    const h = 4 + Math.floor(Math.random() * 10);
    const color = patchColors[Math.floor(Math.random() * patchColors.length)];
    patches.push({ px, py, w, h, color });
  }
  return patches;
}

function drawDirtArea(x, y, width, height, baseColor, patchColors, patches) {
  // 8-bit: Fill base and overlay with blocky patches
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, width, height);
  for (const patch of patches) {
    ctx.fillStyle = patch.color;
    ctx.fillRect(Math.round(patch.px), Math.round(patch.py), 8, 4);
  }
}

function drawFence(x, y, width, height, postColor, railColor) {
  // 8-bit: Fence is blocky, made of rectangles
  // Horizontal rails
  ctx.fillStyle = railColor;
  ctx.fillRect(x, y + 4, width, 4);
  ctx.fillRect(x, y + height - 8, width, 4);
  // Vertical posts
  ctx.fillStyle = postColor;
  const postSpacing = 24;
  for (let px = x; px <= x + width; px += postSpacing) {
    ctx.fillRect(px, y, 4, height);
  }
  // Posts at corners
  ctx.fillRect(x, y, 4, height);
  ctx.fillRect(x + width - 4, y, 4, height);
}

function drawExampleAnimals() {
  // Draw example lamb in lamb area
  const lambArea = getLambArea();
  drawSheepSprite(
    lambArea.x + lambArea.width / 2,
    lambArea.y + lambArea.height / 2,
    'lamb',
    true
  );
  // Draw example sheep in sheep area
  drawSheepSprite(
    canvas.width - SHEEP_AREA_WIDTH / 2,
    SHEEP_AREA_Y + SHEEP_AREA_HEIGHT / 2,
    'sheep',
    true
  );
}

function drawSheepSprite(x, y, type, isExample) {
  // 8-bit: blocky rectangles, pixel clusters
  let bodyWidth, bodyHeight, headWidth, headHeight, legWidth, legHeight, fluffCount, fluffRadius, bodyColor, fluffColor;
  if (type === 'lamb') {
    bodyWidth = 24;
    bodyHeight = 16;
    headWidth = 10;
    headHeight = 12;
    legWidth = 4;
    legHeight = 6;
    fluffCount = 8;
    fluffRadius = 10;
    bodyColor = '#d3d3d3'; // light grey
    fluffColor = '#e5e5e5'; // lighter grey for fluff
  } else {
    bodyWidth = 48;
    bodyHeight = 32;
    headWidth = 20;
    headHeight = 24;
    legWidth = 8;
    legHeight = 12;
    fluffCount = 16;
    fluffRadius = 20;
    bodyColor = '#fff';
    fluffColor = '#fff';
  }
  // Fluffy border (8-bit: small blocks)
  ctx.fillStyle = fluffColor;
  for (let i = 0; i < fluffCount; i++) {
    const angle = (2 * Math.PI * i) / fluffCount;
    const fx = Math.round(x + Math.cos(angle) * fluffRadius);
    const fy = Math.round(y + Math.sin(angle) * (fluffRadius * 0.7));
    ctx.fillRect(fx - 4, fy - 3, 8, 6);
  }
  // Body (blocky)
  ctx.fillStyle = bodyColor;
  ctx.fillRect(Math.round(x) - bodyWidth/2, Math.round(y) - bodyHeight/2, bodyWidth, bodyHeight);
  // Head (blocky)
  ctx.fillStyle = '#b5a27a';
  ctx.fillRect(Math.round(x) + bodyWidth/2 - 4, Math.round(y) - headHeight/2 + 2, headWidth, headHeight);
  // Legs (blocky)
  ctx.fillStyle = '#444';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(Math.round(x) - bodyWidth/2 + 4 + i*(bodyWidth-12)/3, Math.round(y) + bodyHeight/2 - 1, legWidth, legHeight);
  }
  // Eyes (blocky)
  ctx.fillStyle = '#fff';
  ctx.fillRect(Math.round(x) + bodyWidth/2 + 2, Math.round(y) - 2, 3, 3);
  ctx.fillRect(Math.round(x) + bodyWidth/2 + 6, Math.round(y) - 2, 3, 3);
  ctx.fillStyle = '#222';
  ctx.fillRect(Math.round(x) + bodyWidth/2 + 3, Math.round(y) - 1, 1, 1);
  ctx.fillRect(Math.round(x) + bodyWidth/2 + 7, Math.round(y) - 1, 1, 1);
}

function drawFarm() {
  // Draw grass first
  drawGrass();
  // Lamb area (top, right-aligned, 8-bit dirt style)
  const lambArea = getLambArea();
  if (!lambDirtPatches) {
    lambDirtPatches = generateDirtPatches(
      lambArea.x,
      lambArea.y,
      lambArea.width,
      lambArea.height,
      ['#a07a4a', '#c09a6a', '#8c6a3a', '#d2b48c']
    );
  }
  drawDirtArea(
    lambArea.x,
    lambArea.y,
    lambArea.width,
    lambArea.height,
    '#b08a5a',
    ['#a07a4a', '#c09a6a', '#8c6a3a', '#d2b48c'],
    lambDirtPatches
  );
  drawFence(lambArea.x, lambArea.y, lambArea.width, lambArea.height, '#a97c50', '#e2c48a');
  ctx.strokeStyle = '#e75480';
  ctx.lineWidth = 2;
  ctx.strokeRect(lambArea.x, lambArea.y, lambArea.width, lambArea.height);

  // Main Pathway (8-bit: blocky rectangle)
  ctx.fillStyle = '#c9b07a';
  ctx.fillRect(0, PATH_Y, canvas.width, PATH_WIDTH);

  // Secondary Path (diagonal, 45 degree, from door to lamb area)
  const doorX = Math.floor(canvas.width / 2);
  const branchWidth = 32;
  ctx.save();
  ctx.translate(doorX, PATH_Y);
  ctx.rotate(-Math.PI / 4); // 45 degree angle
  ctx.fillStyle = '#c9b07a';
  ctx.fillRect(-branchWidth/2, 0, branchWidth, PATH_Y - LAMB_AREA_HEIGHT);
  ctx.restore();

  // Sheep area (right, 8-bit dirt style)
  if (!sheepDirtPatches) {
    sheepDirtPatches = generateDirtPatches(
      canvas.width - SHEEP_AREA_WIDTH,
      SHEEP_AREA_Y,
      SHEEP_AREA_WIDTH,
      SHEEP_AREA_HEIGHT,
      ['#a07a4a', '#c09a6a', '#8c6a3a', '#d2b48c']
    );
  }
  drawDirtArea(
    canvas.width - SHEEP_AREA_WIDTH,
    SHEEP_AREA_Y,
    SHEEP_AREA_WIDTH,
    SHEEP_AREA_HEIGHT,
    '#b08a5a',
    ['#a07a4a', '#c09a6a', '#8c6a3a', '#d2b48c'],
    sheepDirtPatches
  );
  drawFence(canvas.width - SHEEP_AREA_WIDTH, SHEEP_AREA_Y, SHEEP_AREA_WIDTH, SHEEP_AREA_HEIGHT, '#a97c50', '#e2c48a');
  ctx.strokeStyle = '#2c54b5';
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width - SHEEP_AREA_WIDTH, SHEEP_AREA_Y, SHEEP_AREA_WIDTH, SHEEP_AREA_HEIGHT);

  // Door (8-bit: classic wooden farm gate style)
  ctx.save();
  ctx.translate(doorX, DOOR_Y);
  if (doorPosition === 'straight') {
    drawGateDoor(ctx, 0, 0, DOOR_WIDTH, DOOR_HEIGHT);
  } else {
    ctx.rotate(-Math.PI / 4); // 45 degrees
    drawGateDoor(ctx, 0, 0, DOOR_WIDTH, DOOR_HEIGHT);
  }
  ctx.restore();
  // Draw example animals on top
  drawExampleAnimals();
}

function drawSheep() {
  for (const sheep of sheepList) {
    // 8-bit: blocky rectangles, pixel clusters

    // If poofing, draw a shrinking/fading sheep and a cloud
    if (sheep.poofing) {
      const poofProgress = Math.min(sheep.poofTime / 0.4, 1); // 0..1
      const scale = 1 - poofProgress; // Shrinks from 1 to 0
      ctx.save();
      ctx.globalAlpha = 1 - poofProgress; // Fade out

      ctx.translate(sheep.x, sheep.y);

      // Draw a simple "poof" cloud (circle/oval with white border)
      ctx.beginPath();
      ctx.arc(0, 0, 18 * scale + 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.8 * (1 - poofProgress);
      ctx.fill();
      ctx.globalAlpha = 1 - poofProgress;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ddd';
      ctx.stroke();

      // Draw the sheep scaled down
      ctx.scale(scale, scale);
      ctx.globalAlpha = 1 - poofProgress;
      drawSheepSprite(0, 0, sheep.type, false);

      ctx.restore();
      continue;
    }

    // Draw regular sheep
    drawSheepSprite(sheep.x, sheep.y, sheep.type, false);
  }
}


function resetGame() {
  sheepList = [];
  score = 0;
  missed = 0;
  spawnTimer = 0;
  paused = false;
  gameOver = false;
  doorPosition = 'straight';
  spawnSheep();
}

function drawPause() {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
  ctx.font = '24px Segoe UI';
  ctx.fillText('Press SPACE to resume', canvas.width / 2, canvas.height / 2 + 50);
  ctx.textAlign = 'start';
  ctx.restore();
}

function drawGameOver() {
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = '32px Segoe UI';
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
  ctx.font = '24px Segoe UI';
  ctx.fillText('Press SPACE to restart', canvas.width / 2, canvas.height / 2 + 60);
  ctx.textAlign = 'start';
  ctx.restore();
}

function updateSheep() {
  if (paused || gameOver) return;
  const doorX = Math.floor(canvas.width / 2);
  const lambArea = getLambArea();
  const sheepAreaX = canvas.width - SHEEP_AREA_WIDTH;
  for (const sheep of sheepList) {
    if (sheep.sorted && !sheep.poofing) continue;

    // Handle "poof" animation for wrongly sorted sheep
    if (sheep.poofing) {
      sheep.poofTime += 1 / 60; // ~frames to seconds
      if (sheep.poofTime > 0.4) { // Poof duration: 0.4 seconds
        sheep.sorted = true;
        sheep.poofing = false;
      }
      continue; // Don't move while poofing
    }

    // Move sheep forward
    sheep.x += sheep.speed;

    // At door (not yet assigned a path)
    if (sheep.x > doorX && !sheep.sorted) {
      if (!sheep.sortPath) {
        if (doorPosition === 'straight' && sheep.type === 'sheep') {
          sheep.sortPath = 'straight';
        } else if (doorPosition === 'left' && sheep.type === 'lamb') {
          sheep.sortPath = 'left';
        } else {
          sheep.sortPath = 'wrong';
          sheep.poofing = true;
          sheep.poofTime = 0;
          missed++;
          continue; // Trigger poof animation, stop logic here
        }
      }
      // Follow assigned path
      if (sheep.sortPath === 'straight') {
        sheep.x += sheep.speed * 2;
        if (sheep.x > sheepAreaX + 30) {
          sheep.sorted = true;
          score++;
        }
      } else if (sheep.sortPath === 'left') {
        sheep.y -= 4;
        sheep.x += 1;
        if (
          sheep.y < lambArea.y + lambArea.height - 20 &&
          sheep.y > lambArea.y &&
          sheep.x > lambArea.x + 20 &&
          sheep.x < lambArea.x + lambArea.width - 20
        ) {
          sheep.sorted = true;
          score++;
        }
      }
    }

    // Out of bounds
    if (sheep.x > canvas.width + 50 || sheep.y < 0) {
      sheep.sorted = true;
      missed++;
    }
  }
  // Remove sorted sheep (and poofed ones)
  sheepList = sheepList.filter(s => !s.sorted || (s.poofing && !s.sorted));
}

function drawScore() {
  // Draw white background container
  ctx.save();
  const boxX = 12;
  const boxY = 12;
  const boxW = 140;
  const boxH = 54;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#fff';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  // Draw score and missed text
  ctx.fillStyle = '#4a7c2c';
  ctx.font = '20px Segoe UI, Arial, sans-serif';
  ctx.fillText(`Score: ${score}`, boxX + 12, boxY + 28);
  ctx.fillStyle = '#b52c2c';
  ctx.fillText(`Missed: ${missed}`, boxX + 12, boxY + 48);
  ctx.restore();
}

function drawGateDoor(ctx, x, y, w, h) {
  // Two vertical posts
  ctx.fillStyle = '#8b5c2a';
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + w - 4, y, 4, h);
  // Three horizontal slats
  ctx.fillStyle = '#e2c48a';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 2, y + 8 + i * (h - 16) / 2, w - 4, 6);
  }
}

let spawnInterval = 1000; // ms, half the previous 2000ms
function gameLoop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFarm();
  drawSheep();
  drawScore();
  if (paused) {
    drawPause();
    pausedAt = timestamp;
    requestAnimationFrame(gameLoop);
    return;
  }
  if (gameOver) {
    drawGameOver();
    return;
  }
  updateSheep();
  // Spawn sheep every 1 second (1000 ms)
  spawnTimer += delta;
  if (spawnTimer > spawnInterval) {
    spawnSheep();
    spawnTimer = 0;
  }
  if (score >= 20) {
    gameOver = true;
    drawGameOver();
    return;
  }
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    if (gameOver) {
      lastFrameTime = null;
      resetGame();
      gameLoop(performance.now());
    } else {
      paused = !paused;
      if (!paused) {
        // Adjust lastFrameTime so delta is not huge after pause
        if (pausedAt) {
          lastFrameTime += performance.now() - pausedAt;
          pausedAt = null;
        }
        gameLoop(performance.now());
      }
    }
    e.preventDefault();
  } else if (!paused && !gameOver) {
    if (e.key === 'ArrowLeft') {
      doorPosition = 'left';
    } else if (e.key === 'ArrowRight') {
      doorPosition = 'straight';
    }
  }
});

// Add click to pause/resume
canvas.addEventListener('click', () => {
  if (gameOver) {
    lastFrameTime = null;
    resetGame();
    gameLoop(performance.now());
  } else {
    paused = !paused;
    if (!paused) {
      if (pausedAt) {
        lastFrameTime += performance.now() - pausedAt;
        pausedAt = null;
      }
      gameLoop(performance.now());
    }
  }
});

window.addEventListener('resize', () => {
  lambDirtPatches = null;
  sheepDirtPatches = null;
});

// Start the game
resetGame();
lastFrameTime = null;
gameLoop(performance.now()); 
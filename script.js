/* ===========================================================================
   1. THE RANDOMNESS ENGINE
   Math.random() gives a flat (uniform) number in [0,1). Real market returns
   cluster around an average and tail off — a bell curve. The Box-Muller
   transform converts two uniform randoms into one normally-distributed draw.
   This is the mathematical centre of the tool
   =========================================================================== */
function randNormal(mean, stdDev) {
  let u1 = 0, u2 = 0;
  // avoid log(0) by rejecting exact zeros
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  // Box-Muller: produces a standard normal value (mean 0, std 1)
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  // shift and scale it to the distribution we actually want
  return mean + z * stdDev;
}

/* ===========================================================================
   2. ONE LIFETIME
   Simulate a single investor's journey: start with a balance, and for each
   year apply a random return, then add this year's contribution.
   Returns the full year-by-year path so we can chart it.
   =========================================================================== */
function simulateOnePath(start, contribution, years, meanReturn, volatility) {
  const path = [start];
  let balance = start;

  for (let y = 0; y < years; y++) {
    // draw this year's return as a decimal, e.g. 0.07 = +7%
    const yearlyReturn = randNormal(meanReturn, volatility);
    // apply growth, then add the fresh contribution
    balance = balance * (1 + yearlyReturn) + contribution;
    // a portfolio can't go below zero
    if (balance < 0) balance = 0;
    path.push(balance);
  }
  return path;
}

/* ===========================================================================
   3. TEN THOUSAND LIFETIMES
   Run the single-path simulation many times. For each YEAR we collect every
   simulation's balance, sort them, and read off percentiles. That sorted
   spread is what makes the "fan", representing the cone of possible futures.

   We now ALSO keep a small sample of full paths (samplePaths) so the animation
   can draw individual journeys without trying to render all 10,000 — drawing
   ten thousand polylines every frame would crawl. A representative few hundred
   tells the same visual story far more cheaply.
   =========================================================================== */
function runMonteCarlo(params, numSims = 10000) {
  const { start, contribution, years, meanReturn, volatility, goal } = params;

  const allPaths = [];
  let successCount = 0;

  for (let i = 0; i < numSims; i++) {
    const path = simulateOnePath(start, contribution, years, meanReturn, volatility);
    allPaths.push(path);
    // success = the FINAL balance met or beat the goal
    if (path[path.length - 1] >= goal) successCount++;
  }

  // For each year (0..years), gather every sim's value and sort ascending.
  // Sorting lets us grab the value sitting at, say, the 50th percentile.
  const bands = []; // each entry: { p10, p25, p50, p75, p90 } for that year
  for (let y = 0; y <= years; y++) {
    const column = allPaths.map(p => p[y]).sort((a, b) => a - b);
    bands.push({
      p10: percentile(column, 0.10),
      p25: percentile(column, 0.25),
      p50: percentile(column, 0.50),
      p75: percentile(column, 0.75),
      p90: percentile(column, 0.90),
    });
  }

  // grab ~300 evenly-spaced paths for the streaming animation
  const SAMPLE = 300;
  const stride = Math.max(1, Math.floor(numSims / SAMPLE));
  const samplePaths = [];
  for (let i = 0; i < numSims; i += stride) samplePaths.push(allPaths[i]);

  return {
    successRate: successCount / numSims,   // 0..1
    bands,                                  // the fan, year by year
    final: bands[bands.length - 1],         // the spread of final outcomes
    samplePaths,                            // a few hundred journeys to animate
  };
}

// pull a percentile value out of an already-sorted array
function percentile(sortedArr, p) {
  const idx = Math.floor(p * (sortedArr.length - 1));
  return sortedArr[idx];
}

/* ===========================================================================
   4. CHART PRIMITIVES
   The chart is drawn by hand on a <canvas> — no chart library. We split the
   old single draw() into reusable pieces so the animation loop can call them:
     - computeScale()  : work out the pixel mappers for a given result
     - drawAxes()      : gridlines + dollar/year labels + goal line
     - drawPaths()     : faint individual journeys (the "swarm")
     - drawFan()       : the shaded percentile bands + median line
   =========================================================================== */
function computeScale(result, params) {
  const canvas = document.getElementById('chart');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 30, right: 30, bottom: 50, left: 90 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const years = params.years;
  // the y-axis must reach the higher of: the best-case fan top, or the goal
  const maxVal = Math.max(result.final.p90, params.goal) * 1.08;

  return {
    W, H, pad, years, maxVal,
    xAt: y => pad.left + (y / years) * plotW,
    yAt: dollars => pad.top + plotH - (dollars / maxVal) * plotH,
  };
}

function drawAxes(ctx, s, params) {
  // --- gridlines + y-axis dollar labels ---
  ctx.strokeStyle = '#ddd7ca';
  ctx.fillStyle = '#5a554c';
  ctx.lineWidth = 1;
  ctx.font = '20px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const val = (s.maxVal / 4) * i;
    const py = s.yAt(val);
    ctx.beginPath(); ctx.moveTo(s.pad.left, py); ctx.lineTo(s.W - s.pad.right, py); ctx.stroke();
    ctx.fillText(shortMoney(val), s.pad.left - 12, py);
  }

  // --- x-axis year labels ---
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = s.years <= 10 ? 2 : s.years <= 30 ? 5 : 10;
  for (let y = 0; y <= s.years; y += step) {
    ctx.fillText('Yr ' + y, s.xAt(y), s.H - s.pad.bottom + 14);
  }

  // --- goal line (dashed green) drawn underneath everything else ---
  ctx.beginPath();
  ctx.setLineDash([10, 8]);
  ctx.moveTo(s.pad.left, s.yAt(params.goal));
  ctx.lineTo(s.W - s.pad.right, s.yAt(params.goal));
  ctx.strokeStyle = '#3a6b4f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

// draw the first `count` sample paths as faint orange threads (the swarm)
function drawPaths(ctx, s, paths, count) {
  ctx.lineWidth = 1;
  for (let i = 0; i < count && i < paths.length; i++) {
    const path = paths[i];
    ctx.beginPath();
    ctx.moveTo(s.xAt(0), s.yAt(path[0]));
    for (let y = 1; y < path.length; y++) ctx.lineTo(s.xAt(y), s.yAt(path[y]));
    // very low alpha so hundreds of overlapping threads build up density,
    // exactly like Malkiel's cloud of possible futures
    ctx.strokeStyle = 'rgba(180, 84, 31, 0.06)';
    ctx.stroke();
  }
}

// draw the percentile bands and median. `alpha` lets us fade the fan IN
// on top of the swarm once the streaming finishes.
function drawFan(ctx, s, result, alpha) {
  const years = s.years;
  ctx.globalAlpha = alpha;

  // --- outer band (10th to 90th percentile) ---
  ctx.beginPath();
  ctx.moveTo(s.xAt(0), s.yAt(result.bands[0].p90));
  for (let y = 1; y <= years; y++) ctx.lineTo(s.xAt(y), s.yAt(result.bands[y].p90));
  for (let y = years; y >= 0; y--) ctx.lineTo(s.xAt(y), s.yAt(result.bands[y].p10));
  ctx.closePath();
  ctx.fillStyle = 'rgba(217, 138, 94, 0.30)';
  ctx.fill();

  // --- inner band (25th to 75th) — the "more likely" zone ---
  ctx.beginPath();
  ctx.moveTo(s.xAt(0), s.yAt(result.bands[0].p75));
  for (let y = 1; y <= years; y++) ctx.lineTo(s.xAt(y), s.yAt(result.bands[y].p75));
  for (let y = years; y >= 0; y--) ctx.lineTo(s.xAt(y), s.yAt(result.bands[y].p25));
  ctx.closePath();
  ctx.fillStyle = 'rgba(180, 84, 31, 0.22)';
  ctx.fill();

  // --- median path (the "typical" outcome) ---
  ctx.beginPath();
  ctx.moveTo(s.xAt(0), s.yAt(result.bands[0].p50));
  for (let y = 1; y <= years; y++) ctx.lineTo(s.xAt(y), s.yAt(result.bands[y].p50));
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.globalAlpha = 1;
}

/* ===========================================================================
   5. THE ANIMATION
   This is the new wow factor and the most on-thesis part of the tool: you
   literally watch the random walk happen. Two phases, driven by one
   requestAnimationFrame loop:

     PHASE 1 (stream): each frame adds a batch of sample paths to the swarm.
       The faint threads accumulate into a glowing cloud — the cone of
       possible futures emerging from pure randomness.
     PHASE 2 (resolve): once every sample path is drawn, the percentile fan
       and median line fade in on top, turning the chaos into a clear summary.

   We redraw the whole canvas each frame (cheap at a few hundred thin lines)
   so the fade-in compositing stays clean.
   =========================================================================== */
let animHandle = null; // so a new run can cancel an in-flight animation

function animateChart(result, params) {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const s = computeScale(result, params);

  const total = result.samplePaths.length;
  const perFrame = Math.max(2, Math.ceil(total / 45)); // ~45 frames to stream all paths
  let drawn = 0;
  let fanAlpha = 0;
  let phase = 'stream';

  // if the user prefers reduced motion, skip straight to the final frame
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    ctx.clearRect(0, 0, s.W, s.H);
    drawAxes(ctx, s, params);
    drawPaths(ctx, s, result.samplePaths, total);
    drawFan(ctx, s, result, 1);
    return;
  }

  if (animHandle) cancelAnimationFrame(animHandle);

  function frame() {
    ctx.clearRect(0, 0, s.W, s.H);
    drawAxes(ctx, s, params);

    if (phase === 'stream') {
      drawn = Math.min(total, drawn + perFrame);
      drawPaths(ctx, s, result.samplePaths, drawn);
      if (drawn >= total) phase = 'resolve';
    } else {
      // keep the full swarm visible underneath, fade the fan in over it
      drawPaths(ctx, s, result.samplePaths, total);
      fanAlpha = Math.min(1, fanAlpha + 0.06);
      drawFan(ctx, s, result, fanAlpha);
    }

    if (phase === 'stream' || fanAlpha < 1) {
      animHandle = requestAnimationFrame(frame);
    }
  }
  frame();
}

/* ===========================================================================
   6. COUNTING-UP NUMBERS
   Animate a number from 0 to its target over a short duration using an
   ease-out curve, so the headline percentage "lands" rather than snapping.
   `format` turns the running value into the string we show (e.g. add a %).
   =========================================================================== */
function countUp(el, target, durationMs, format) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { el.textContent = format(target); return; }

  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    // ease-out cubic: fast at first, gently decelerating to the target
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(target * eased);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = format(target); // guarantee an exact final value
  }
  requestAnimationFrame(tick);
}

/* ===========================================================================
   7. FORMATTING + WIRING UP THE INTERFACE
   =========================================================================== */
function money(n)      { return '$' + Math.round(n).toLocaleString('en-US'); }
function shortMoney(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'k';
  return '$' + Math.round(n);
}

// read every slider into a clean params object (returns as decimals where needed)
function readParams() {
  return {
    start:        +document.getElementById('start').value,
    contribution: +document.getElementById('contrib').value,
    years:        +document.getElementById('years').value,
    meanReturn:   +document.getElementById('return').value / 100,  // % -> decimal
    volatility:   +document.getElementById('vol').value / 100,
    goal:         +document.getElementById('goal').value,
  };
}

// keep the little value labels next to each slider in sync
function syncLabels() {
  document.getElementById('v-start').textContent   = money(+document.getElementById('start').value);
  document.getElementById('v-contrib').textContent = money(+document.getElementById('contrib').value);
  document.getElementById('v-years').textContent   = document.getElementById('years').value;
  document.getElementById('v-return').textContent  = (+document.getElementById('return').value).toFixed(1) + '%';
  document.getElementById('v-vol').textContent     = (+document.getElementById('vol').value).toFixed(1) + '%';
  document.getElementById('v-goal').textContent    = money(+document.getElementById('goal').value);
}

// run everything and paint the (animated) results
function runAndRender() {
  const params = readParams();
  const runBtn = document.getElementById('run');

  // disable the button briefly so the heavy loop + animation can't be re-triggered mid-flight
  runBtn.disabled = true;
  // let the browser paint the disabled state before we block on 10k sims
  requestAnimationFrame(() => {
    const result = runMonteCarlo(params, 10000);

    // headline success number — counts up to its final value
    const pct = Math.round(result.successRate * 100);
    const successEl = document.getElementById('success');
    successEl.classList.toggle('is-good', pct >= 75); // colour eases via CSS transition
    countUp(successEl, pct, 900, v => Math.round(v) + '%');

    // the animated chart
    animateChart(result, params);

    // percentile table — translate cold numbers into plain English.
    // each row fades in slightly later than the last (staggered reveal).
    const rows = [
      ['Pessimistic (10th)', result.final.p10, 'Poor run of markets'],
      ['Below par (25th)',   result.final.p25, 'Subpar outcome'],
      ['Median (50th)',      result.final.p50, 'The middle outcome'],
      ['Above par (75th)',   result.final.p75, 'Above average'],
      ['Optimistic (90th)',  result.final.p90, 'Lucky run of markets'],
    ];
    document.querySelector('#percentiles tbody').innerHTML = rows.map(
      ([label, val, reads], i) =>
        `<tr style="animation-delay:${0.5 + i * 0.08}s">
           <td>${label}</td><td class="money">${money(val)}</td><td>${reads}</td>
         </tr>`
    ).join('');

    runBtn.disabled = false;
  });
}

// every slider: live-update its label, and re-run on release
document.querySelectorAll('input[type=range]').forEach(slider => {
  slider.addEventListener('input', syncLabels);
});
document.getElementById('run').addEventListener('click', runAndRender);

// first paint
syncLabels();
runAndRender();

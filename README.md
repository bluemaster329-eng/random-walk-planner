# random-walk-planner
**Purpose**

The Monte Carlo retirement simulator acts as a model that simulates thousands of possible market futures, providing a more accurate forecast and also showing the variability of this outcome over a single, false forecast

**[Live Site] https://bluemaster329-eng.github.io/random-walk-planner/)**

## Idea 

This project is centred around "A Random Walk Down Wall Street", using the book's central thesis that short-term market movements are essentially random and unpredictable. Most retirement calculators contradict this idea however, providing a single confident number and create the false sense of concrete wealth, despite the future being unknowable (as exemplified in the book)

This tool provides a more accurate and truthful alternative, taking randomness as a key consideration and incorporating it into the engine. Each simulated year draws a return from a bell curve without assuming a fixed rate, so thus providing a probability forecast. The odds of actually reaching the goal, with a helpful visual fan showing the full range of possible outcomes, are provided as the key output. The wide spread of results shows the honest picture of an uncertain future 

## Breakdown of its Mechanisms

Simulation has 4 stages, written in plain JavaScript:

1. **Randomness Engine** The "Math.random()" is only capable of producing a flat, evenly-spread number, real market returns cluster around averages with occasional extremities, acting as a bell curve. The Box-Muller transform converts the flat random numbers into normally-distributed ones, applied with the help of AI
2. **Simulated Lifetime (Singular)** Starting from an opening balance, each year applies a random return drawn from the bell curve and adds the year's contribution, thus producing a single x-year journey (with x determined by the user's input)
3. **Ten Thousand Lifetimes** The singular simulation runs 10,000 times, with each year having every simulation's balance sorted. Then aggregates are made and percentiles are read off with the spread sorted to form a fan chart
4. **Visual Display** The chart is drawn onto the HTML canvas using individual paths streaming on one batch at a time, using the 'requestAnimationFrame', building the cloud of possibilites for future investments. After this animation for aesthetic appeal, percentile bands and a median line resolve on top for deeper analytics

## Default Settings 
- **Expected return: 7%** -> the long-run US stock market return is about 10% (used in this over the Aus market due to its size and wide usage). Subtracting around 3% for inflation gives about 7%, acting as an honest figure for planning in the current macroeconomci conditions
- **Volatility: 15%** -> this is close to the historical standard deviation on annual US stock returns, that sits in the 15-20% range

## Caveats + Weaknesses
- NB: the simplification loses market realism as the model assumes returns are normally distributed when real markets have flatter tails with crashes occurring more often than a pure bell curve predicts, thus the model understates extreme outcomes, such as the 2008-09 GFC and the 2020-21 COVID Recession

## Running it 
No build step and no installation. Open `index.html` in any browser, or visit the live link above. The three files are:

- `index.html` — the page structure
- `style.css` — the styling
- `script.js` — the simulation, maths, and chart

Composition -> Plain HTML, CSS, and JavaScript

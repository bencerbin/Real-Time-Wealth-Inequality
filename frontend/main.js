let value = 0;
let perSecond = 0;
let yearValue = 0;
let totalWealth = 0;
let lastFrameTime = performance.now();
const revealText = document.getElementById("reveal-text");
const revealSection = document.getElementById("reveal-section");
const scrollIndicator = document.getElementById("scroll-indicator");

function updateReveal() {
  if (!revealText || !revealSection) return;

  const viewportHeight = window.innerHeight;
  const rect = revealSection.getBoundingClientRect();
  const start = viewportHeight * 1.25;
  const end = viewportHeight * 0.7;
  const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
  const eased = progress * progress * (3 - 2 * progress);

  revealText.style.opacity = String(eased);
  revealText.style.transform = `translateY(${40 - 40 * eased}px)`;

  if (scrollIndicator) {
    const fade = Math.max(0, 1 - window.scrollY / 120);
    scrollIndicator.style.opacity = String(fade);
    scrollIndicator.style.transform = `translateX(-50%) rotate(45deg) translateY(${(1 - fade) * 20}px)`;
  }
}

fetch("http://127.0.0.1:5000/api/billionaires")
  .then(res => res.json())
  .then(data => {
    let totalDelta = 0;
    let yearDelta = 0;

    data.forEach(p => {
      if (typeof p.delta === "number") totalDelta += p.delta;
      if (typeof p.wealth === "number") totalWealth += p.wealth;
      if (p.last_year_wealth != null) {
        yearDelta += (p.wealth - p.last_year_wealth);
      }
    });

    perSecond = totalDelta / 86400;
    yearValue = yearDelta;
  })
  .catch(err => {
    console.error("Failed to load billionaire data:", err);
  });

function animateCounter(now) {
  const deltaSeconds = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  value += perSecond * deltaSeconds;
  yearValue += perSecond * deltaSeconds;

  document.getElementById("counter").innerText =
    "$" + Math.floor(value).toLocaleString();

  document.getElementById("counter2").innerText =
    "$" + Math.floor(yearValue).toLocaleString();

  updateReveal();
  requestAnimationFrame(animateCounter);
}

window.addEventListener("scroll", updateReveal, { passive: true });
window.addEventListener("resize", updateReveal);
requestAnimationFrame(animateCounter);

const STEPS = ["3", "2", "1", "GO!"];
const STEP_MS = 760;

export class LevelTransition {
  constructor(element) {
    this.element = element;
    this.levelEl = element.querySelector(".level-transition__level");
    this.countEl = element.querySelector(".level-transition__count");
    this.timeout = null;
    this.token = 0;
  }

  play(level, onDone) {
    this.cancel();
    const token = ++this.token;
    let index = 0;

    this.levelEl.textContent = String(level);
    this.element.classList.add("visible");
    this.element.setAttribute("aria-hidden", "false");

    const showStep = () => {
      if (token !== this.token) return;
      this.countEl.textContent = STEPS[index];
      this.countEl.classList.toggle("pulse", index % 2 === 1);

      index += 1;
      if (index < STEPS.length) {
        this.timeout = window.setTimeout(showStep, STEP_MS);
        return;
      }

      this.timeout = window.setTimeout(() => {
        if (token !== this.token) return;
        this.hide();
        onDone?.();
      }, STEP_MS);
    };

    showStep();
  }

  cancel() {
    this.token += 1;
    if (this.timeout) {
      window.clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.hide();
  }

  hide() {
    this.element.classList.remove("visible");
    this.element.setAttribute("aria-hidden", "true");
  }
}

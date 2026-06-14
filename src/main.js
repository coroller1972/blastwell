import "./styles.css";
import { TetriSiloGame } from "./simulation/game.js";
import { bindKeyboard } from "./input/actions.js";
import { GameRenderer } from "./render/gameRenderer.js";
import { Hud } from "./ui/hud.js";
import { LevelTransition } from "./ui/levelTransition.js";
import { SoundFx } from "./audio/soundFx.js";
import { LevelMusic } from "./audio/levelMusic.js";
import blastwellLogoUrl from "./assets/blastwell-logo.png";

const sceneEl = document.querySelector("#scene");
document.querySelector("#brand-logo").src = blastwellLogoUrl;
const game = new TetriSiloGame({ autoStart: false });
const renderer = new GameRenderer(sceneEl);
const hud = new Hud();
const levelTransition = new LevelTransition(document.querySelector("#level-transition"));
const soundFx = new SoundFx();
const levelMusic = new LevelMusic();
const rotationButtons = [...document.querySelectorAll("[data-rotation]")];
const startButton = document.querySelector("#start-game");

let previousTime = performance.now();
let clearRowsKey = "";
let transitionLevel = null;

const keyboard = bindKeyboard((action) => {
  soundFx.resume();
  levelMusic.resume();
  game.action(action);
  if (action === "restart") {
    levelTransition.cancel();
    transitionLevel = null;
    clearRowsKey = "";
  }
  levelMusic.sync(game.snapshot());
});

startButton.addEventListener("click", () => {
  soundFx.resume();
  levelMusic.resume();
  levelTransition.cancel();
  game.startGame();
  levelMusic.sync(game.snapshot());
  transitionLevel = null;
  clearRowsKey = "";
});

for (const button of rotationButtons) {
  button.addEventListener("click", () => {
    soundFx.resume();
    levelMusic.resume();
    const direction = Number(button.dataset.rotation);
    keyboard.setRotationDirection(direction);
    for (const option of rotationButtons) {
      option.setAttribute("aria-pressed", String(option === button));
    }
  });
}

function playEvents(events) {
  for (const event of events) {
    if (event.type === "tick") {
      soundFx.tick();
    } else if (event.type === "land") {
      soundFx.land();
    } else if (event.type === "clear") {
      soundFx.explosion();
    } else if (event.type === "bombClear") {
      soundFx.bombExplosion();
    }
  }
}

document.addEventListener("pointerdown", () => {
  soundFx.resume();
  levelMusic.resume();
}, { once: true });

document.addEventListener("keydown", () => {
  soundFx.resume();
  levelMusic.resume();
}, { once: true });

function frame(time) {
  const delta = Math.min(80, time - previousTime);
  previousTime = time;

  game.update(delta);
  playEvents(game.drainEvents());
  const snapshot = game.snapshot();

  if (snapshot.status === "clearing" && snapshot.lastClear) {
    const key = snapshot.lastClear.rows.join(",");
    if (key !== clearRowsKey) {
      clearRowsKey = key;
      renderer.animateClear(snapshot.lastClear.rows, () => {
        game.applyClear();
        playEvents(game.drainEvents());
        clearRowsKey = "";
      }, snapshot, () => {
        soundFx.bombExplosion();
      });
    }
  }

  renderer.updateAnimations(time);
  renderer.render(snapshot);
  if (snapshot.status === "levelIntro" && transitionLevel !== snapshot.level) {
    transitionLevel = snapshot.level;
    levelTransition.play(snapshot.level, () => {
      game.startPreparedLevel();
      transitionLevel = null;
      levelMusic.sync(game.snapshot());
    });
  } else if (snapshot.status !== "levelIntro" && transitionLevel !== null) {
    levelTransition.cancel();
    transitionLevel = null;
  }
  levelMusic.sync(snapshot);
  hud.update(snapshot);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.__TETRI_SILO__ = {
  game,
  snapshot: () => game.snapshot()
};

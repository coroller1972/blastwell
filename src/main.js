import "./styles.css";
import { TetriSiloGame } from "./simulation/game.js";
import { bindKeyboard } from "./input/actions.js";
import { bindTouchControls } from "./input/touchControls.js";
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
const settingsDialog = document.querySelector("#settings-dialog");
const openSettingsButton = document.querySelector("#open-settings");
const closeSettingsButton = document.querySelector("#close-settings");
const ghostSetting = document.querySelector("#setting-ghost");
const musicSetting = document.querySelector("#setting-music");
const SETTINGS_KEY = "blastwell-settings";

function loadSettings() {
  try {
    return {
      rotationDirection: -1,
      ghostVisible: true,
      musicEnabled: true,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}")
    };
  } catch {
    return { rotationDirection: -1, ghostVisible: true, musicEnabled: true };
  }
}

const settings = loadSettings();
const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The game remains usable when storage is unavailable.
  }
};

let previousTime = performance.now();
let clearRowsKey = "";
let transitionLevel = null;
let pausedBySettings = false;

const performAction = (action) => {
  if (settingsDialog.open) return;
  soundFx.resume();
  levelMusic.resume();
  game.action(action);
  if (action === "restart") {
    levelTransition.cancel();
    transitionLevel = null;
    clearRowsKey = "";
  }
  levelMusic.sync(game.snapshot());
};

const keyboard = bindKeyboard(performAction);
keyboard.setRotationDirection(settings.rotationDirection);
renderer.setGhostVisible(settings.ghostVisible);
levelMusic.setEnabled(settings.musicEnabled);
ghostSetting.checked = settings.ghostVisible;
musicSetting.checked = settings.musicEnabled;
const touchControls = bindTouchControls(
  sceneEl,
  performAction,
  () => keyboard.getPrimaryRotationAction()
);

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
  button.setAttribute("aria-pressed", String(Number(button.dataset.rotation) === settings.rotationDirection));
  button.addEventListener("click", () => {
    const direction = Number(button.dataset.rotation);
    settings.rotationDirection = direction;
    keyboard.setRotationDirection(direction);
    for (const option of rotationButtons) {
      option.setAttribute("aria-pressed", String(option === button));
    }
    saveSettings();
  });
}

openSettingsButton.addEventListener("click", () => {
  if (game.status === "playing") {
    game.action("pause");
    pausedBySettings = true;
    levelMusic.sync(game.snapshot());
  }
  settingsDialog.showModal();
});

closeSettingsButton.addEventListener("click", () => settingsDialog.close());

settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

settingsDialog.addEventListener("close", () => {
  if (pausedBySettings && game.status === "paused") {
    game.action("pause");
    levelMusic.sync(game.snapshot());
  }
  pausedBySettings = false;
  openSettingsButton.focus();
});

ghostSetting.addEventListener("change", () => {
  settings.ghostVisible = ghostSetting.checked;
  renderer.setGhostVisible(settings.ghostVisible);
  saveSettings();
});

musicSetting.addEventListener("change", () => {
  settings.musicEnabled = musicSetting.checked;
  levelMusic.setEnabled(settings.musicEnabled);
  if (settings.musicEnabled) levelMusic.resume();
  levelMusic.sync(game.snapshot());
  saveSettings();
});

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

  if (settingsDialog.open && game.status === "playing") {
    game.action("pause");
    pausedBySettings = true;
  }

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
  touchControls.setEnabled(snapshot.status === "playing");
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.__TETRI_SILO__ = {
  game,
  snapshot: () => game.snapshot()
};

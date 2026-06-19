import level1Url from "../assets/audio/level_1.mp3";
import level2Url from "../assets/audio/level_2.mp3";
import level3Url from "../assets/audio/level_3.mp3";
import level4Url from "../assets/audio/level_4.mp3";
import level5Url from "../assets/audio/level_5.mp3";
import level6Url from "../assets/audio/level_6.mp3";

export const LEVEL_TRACKS = {
  1: level1Url,
  2: level2Url,
  3: level3Url,
  4: level4Url,
  5: level5Url,
  6: level6Url,
};

export class LevelMusic {
  constructor(tracks = LEVEL_TRACKS) {
    this.tracks = tracks;
    this.audio = null;
    this.currentLevel = null;
    this.unlocked = false;
    this.enabled = true;
  }

  resume() {
    this.unlocked = true;
    if (this.enabled && this.audio && this.audio.paused) {
      this.audio.play().catch(() => {});
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.pause();
  }

  sync(snapshot) {
    if (!this.enabled) {
      this.pause();
      return;
    }
    if (snapshot.status === "ready" || snapshot.status === "gameOver" || snapshot.status === "levelIntro") {
      this.stop();
      return;
    }

    if (snapshot.status === "paused") {
      this.pause();
      return;
    }

    if (snapshot.status === "playing" || snapshot.status === "clearing") {
      this.playLevel(snapshot.level);
    }
  }

  playLevel(level) {
    const url = this.tracks[level];
    if (!url) {
      this.stop();
      return;
    }

    if (this.currentLevel !== level) {
      this.stop();
      this.audio = new Audio(url);
      this.audio.loop = true;
      this.audio.volume = 0.42;
      this.currentLevel = level;
    }

    if (this.unlocked && this.audio.paused) {
      this.audio.play().catch(() => {});
    }
  }

  pause() {
    this.audio?.pause();
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio = null;
    this.currentLevel = null;
  }
}

import { PIECES } from "../simulation/pieces.js";

export class Hud {
  constructor() {
    this.score = document.querySelector("#score");
    this.level = document.querySelector("#level");
    this.lines = document.querySelector("#lines");
    this.speed = document.querySelector("#speed");
    this.status = document.querySelector("#status");
    this.nextPiece = document.querySelector("#next-piece");
    this.gameOver = document.querySelector("#game-over");
    this.startButton = document.querySelector("#start-game");
  }

  update(snapshot) {
    this.score.textContent = String(snapshot.score);
    this.level.textContent = String(snapshot.level);
    this.lines.textContent = String(snapshot.totalLines);
    this.speed.textContent = String(snapshot.speedLevel);
    this.status.textContent = this.statusText(snapshot.status);
    this.gameOver.classList.toggle("visible", snapshot.status === "gameOver");
    this.gameOver.setAttribute("aria-hidden", String(snapshot.status !== "gameOver"));
    this.updateStartButton(snapshot.status);
    this.renderNext(snapshot.nextType);
  }

  statusText(status) {
    if (status === "ready") return "Pret - demarrer une partie";
    if (status === "paused") return "Pause";
    if (status === "clearing") return "Explosion de ligne";
    if (status === "levelIntro") return "Nouveau niveau";
    if (status === "gameOver") return "Partie terminee - R pour recommencer";
    return "En jeu";
  }

  updateStartButton(status) {
    const gameInProgress = status === "playing" || status === "clearing" || status === "paused" || status === "levelIntro";
    this.startButton.disabled = gameInProgress;
    this.startButton.textContent = status === "gameOver" ? "Rejouer" : gameInProgress ? "Partie en cours" : "Demarrer";
  }

  renderNext(type) {
    const matrix = PIECES[type] ?? [];
    this.nextPiece.replaceChildren();
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const cell = document.createElement("span");
        cell.className = "preview-cell";
        if (matrix[y]?.[x]) {
          cell.classList.add("filled");
        }
        this.nextPiece.append(cell);
      }
    }
  }
}

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
    this.gameComplete = document.querySelector("#game-complete");
    this.restartCampaign = document.querySelector("#restart-campaign");
    this.hud = document.querySelector("#hud");
    this.startButton = document.querySelector("#start-game");
    this.previousStatus = null;
  }

  update(snapshot) {
    this.score.textContent = String(snapshot.score);
    this.level.textContent = String(snapshot.level);
    this.lines.textContent = String(snapshot.totalLines);
    this.speed.textContent = String(snapshot.speedLevel);
    this.status.textContent = this.statusText(snapshot.status);
    this.gameOver.classList.toggle("visible", snapshot.status === "gameOver");
    this.gameOver.setAttribute("aria-hidden", String(snapshot.status !== "gameOver"));
    this.gameComplete.classList.toggle("visible", snapshot.status === "completed");
    this.gameComplete.setAttribute("aria-hidden", String(snapshot.status !== "completed"));
    this.hud.inert = snapshot.status === "completed";
    if (snapshot.status === "completed" && this.previousStatus !== "completed") {
      this.restartCampaign.focus();
    }
    this.updateStartButton(snapshot.status);
    this.renderNext(snapshot.nextType);
    this.previousStatus = snapshot.status;
  }

  statusText(status) {
    if (status === "ready") return "Pret - demarrer une partie";
    if (status === "paused") return "Pause";
    if (status === "clearing") return "Explosion de ligne";
    if (status === "levelIntro") return "Nouveau niveau";
    if (status === "gameOver") return "Partie terminee - R pour recommencer";
    if (status === "completed") return "Campagne terminee";
    return "En jeu";
  }

  updateStartButton(status) {
    const gameInProgress = status === "playing" || status === "clearing" || status === "paused" || status === "levelIntro";
    this.startButton.disabled = gameInProgress;
    this.startButton.textContent = status === "gameOver" || status === "completed" ? "Recommencer" : gameInProgress ? "Partie en cours" : "Demarrer";
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

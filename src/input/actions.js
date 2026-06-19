const KEY_TO_ACTION = {
  ArrowLeft: "moveLeft",
  ArrowRight: "moveRight",
  ArrowUp: "rotatePrimary",
  KeyZ: "rotateSecondary",
  ArrowDown: "softDrop",
  Space: "hardDrop",
  KeyP: "pause",
  KeyR: "restart"
};

export function bindKeyboard(onAction) {
  const held = new Set();
  let rotationDirection = -1;

  const onKeyDown = (event) => {
    let action = KEY_TO_ACTION[event.code];
    if (!action) return;
    event.preventDefault();

    if (action === "rotatePrimary") {
      action = rotationDirection > 0 ? "rotateCW" : "rotateCCW";
    } else if (action === "rotateSecondary") {
      action = rotationDirection > 0 ? "rotateCCW" : "rotateCW";
    }

    if (["softDrop", "moveLeft", "moveRight"].includes(action)) {
      onAction(action);
      return;
    }

    if (held.has(event.code)) return;
    held.add(event.code);
    onAction(action);
  };

  const onKeyUp = (event) => {
    held.delete(event.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    getPrimaryRotationAction() {
      return rotationDirection > 0 ? "rotateCW" : "rotateCCW";
    },
    setRotationDirection(direction) {
      rotationDirection = direction;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    }
  };
}

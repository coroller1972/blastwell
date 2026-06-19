export function classifyTouchGesture(dx, dy, durationMs) {
  const absoluteX = Math.abs(dx);
  const absoluteY = Math.abs(dy);

  if (absoluteX < 12 && absoluteY < 12 && durationMs < 320) {
    return { action: "rotatePrimary", repetitions: 1 };
  }

  if (absoluteY > absoluteX * 1.15 && dy > 72 && durationMs < 340) {
    return { action: "hardDrop", repetitions: 1 };
  }

  if (absoluteX > absoluteY && absoluteX > 24) {
    return {
      action: dx < 0 ? "moveLeft" : "moveRight",
      repetitions: Math.min(5, Math.max(1, Math.round(absoluteX / 38)))
    };
  }

  if (dy > 24) {
    return {
      action: "softDrop",
      repetitions: Math.min(6, Math.max(1, Math.round(dy / 32)))
    };
  }

  return null;
}

export function bindTouchControls(element, onAction, getPrimaryRotationAction) {
  let gesture = null;

  const resolveAction = (action) => action === "rotatePrimary" ? getPrimaryRotationAction() : action;
  const dispatch = (action, repetitions = 1) => {
    const resolved = resolveAction(action);
    for (let index = 0; index < repetitions; index += 1) {
      onAction(resolved);
    }
  };

  const onPointerDown = (event) => {
    if (event.pointerType === "mouse" || event.target.closest("button")) return;
    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: performance.now()
    };
    element.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const result = classifyTouchGesture(
      event.clientX - gesture.x,
      event.clientY - gesture.y,
      performance.now() - gesture.startedAt
    );
    gesture = null;
    if (result) dispatch(result.action, result.repetitions);
  };

  const onPointerCancel = () => {
    gesture = null;
  };

  const buttons = [...element.querySelectorAll("[data-touch-action]")];
  const onButtonClick = (event) => {
    dispatch(event.currentTarget.dataset.touchAction);
  };

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerCancel);
  for (const button of buttons) button.addEventListener("click", onButtonClick);

  return {
    setEnabled(enabled) {
      for (const button of buttons) button.disabled = !enabled;
    },
    dispose() {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
      for (const button of buttons) button.removeEventListener("click", onButtonClick);
    }
  };
}

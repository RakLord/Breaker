export function updateCanvasView(canvas, world, view) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);

  const dpr = window.devicePixelRatio || 1;
  const pxWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const pxHeight = Math.max(1, Math.floor(cssHeight * dpr));

  if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
    canvas.width = pxWidth;
    canvas.height = pxHeight;
  }

  view.dpr = dpr;
  view.cssWidth = cssWidth;
  view.cssHeight = cssHeight;
  view.scale = Math.min(cssWidth / world.width, cssHeight / world.height);
  view.offsetX = (cssWidth - world.width * view.scale) * 0.5;
  view.offsetY = (cssHeight - world.height * view.scale) * 0.5;
}

export function applyWorldTransform(ctx, view) {
  ctx.setTransform(
    view.dpr * view.scale,
    0,
    0,
    view.dpr * view.scale,
    view.dpr * view.offsetX,
    view.dpr * view.offsetY
  );
}

export function screenToWorld(canvas, view, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const xCss = clientX - rect.left;
  const yCss = clientY - rect.top;
  return {
    x: (xCss - view.offsetX) / view.scale,
    y: (yCss - view.offsetY) / view.scale,
  };
}

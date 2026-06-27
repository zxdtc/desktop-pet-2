export function selectSpriteAction(sprite, animation) {
  if (!sprite?.actions?.length) return null;
  return sprite.actions.find((item) => item.id === animation)
    || sprite.actions.find((item) => item.id === 'idle')
    || sprite.actions[0];
}

export function spriteFrameStyle(sprite, action, frame) {
  const cellWidth = sprite?.cellWidth || 192;
  const cellHeight = sprite?.cellHeight || 208;
  const columns = sprite?.columns || action?.frameCount || 1;
  const rows = sprite?.rows || sprite?.actions?.length || 1;
  return {
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${columns > 1 ? (frame / (columns - 1)) * 100 : 0}% ${rows > 1 ? ((action?.rowIndex || 0) / (rows - 1)) * 100 : 0}%`,
    aspectRatio: `${cellWidth} / ${cellHeight}`
  };
}

export function choosePetRenderSource(appliedSprite, activeAsset) {
  if (appliedSprite) return 'applied-spritesheet';
  if (activeAsset) return 'asset-slot';
  return 'fallback-illustration';
}

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { choosePetRenderSource, selectSpriteAction, spriteFrameStyle } from '../shared/petSpritePlayback.js';
import './PetApp.css';

const faceByAnimation = {
  idle: { eyes: 'calm', mouth: 'smile', mark: '' },
  happy: { eyes: 'happy', mouth: 'smile', mark: '' },
  sad: { eyes: 'sad', mouth: 'sad', mark: '' },
  sleep: { eyes: 'sleep', mouth: 'flat', mark: 'zzz' },
  working: { eyes: 'focus', mouth: 'flat', mark: '...' },
  waiting: { eyes: 'round', mouth: 'flat', mark: '?' },
  failed: { eyes: 'sad', mouth: 'sad', mark: '!' },
  remind: { eyes: 'round', mouth: 'smile', mark: '!' },
  celebrate: { eyes: 'happy', mouth: 'open', mark: '*' },
  'peek-left': { eyes: 'round', mouth: 'smile', mark: '' },
  'peek-right': { eyes: 'round', mouth: 'smile', mark: '' },
  'pop-out': { eyes: 'round', mouth: 'open', mark: '!' },
  attention: { eyes: 'round', mouth: 'open', mark: '?' },
  rainy: { eyes: 'calm', mouth: 'flat', mark: 'rain' },
  hot: { eyes: 'sad', mouth: 'flat', mark: 'hot' },
  cold: { eyes: 'calm', mouth: 'flat', mark: 'cold' },
  night: { eyes: 'sleep', mouth: 'flat', mark: 'zzz' },
  'focus-working': { eyes: 'focus', mouth: 'flat', mark: '...' },
  'focus-complete': { eyes: 'happy', mouth: 'open', mark: '*' },
  'memo-write': { eyes: 'focus', mouth: 'smile', mark: 'note' },
  'memo-remind': { eyes: 'round', mouth: 'open', mark: '!' },
  'push-window': { eyes: 'happy', mouth: 'smirk', mark: '!' },
  'drag-note': { eyes: 'focus', mouth: 'smile', mark: 'note' },
  'follow-mouse': { eyes: 'happy', mouth: 'open', mark: '*' }
};

function usePetState() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    window.desktopPet?.getState().then((next) => {
      if (alive) setState(next);
    });
    return window.desktopPet?.onState((next) => {
      if (alive) setState(next);
    });
  }, []);

  return state;
}

function Eye({ type, side }) {
  const cx = side === 'left' ? 55 : 95;
  if (type === 'sleep') return <path d={`M${cx - 9} 78 q9 6 18 0`} className="pet-line" />;
  if (type === 'happy') return <path d={`M${cx - 9} 78 q9 -7 18 0`} className="pet-line" />;
  if (type === 'sad') return <path d={`M${cx - 9} 74 q9 7 18 0`} className="pet-line" />;
  if (type === 'focus') return <rect x={cx - 9} y="73" width="18" height="5" rx="2.5" className="pet-eye" />;
  return <circle cx={cx} cy="76" r="7" className="pet-eye" />;
}

function Mouth({ type }) {
  if (type === 'sad') return <path d="M64 105 q11 -9 22 0" className="pet-line" />;
  if (type === 'open') return <ellipse cx="75" cy="101" rx="10" ry="8" className="pet-mouth-fill" />;
  if (type === 'smirk') return <path d="M64 99 q15 11 31 0" className="pet-line" />;
  if (type === 'flat') return <path d="M64 100 h22" className="pet-line" />;
  return <path d="M61 98 q14 15 29 0" className="pet-line" />;
}

function Mark({ type }) {
  if (!type) return null;
  const label = { zzz: '睡', rain: '雨', note: '便签', hot: '热', cold: '冷' }[type] || type;
  return <text x="112" y="43" className="pet-mark">{label}</text>;
}

function PetIllustration({ animation }) {
  const face = faceByAnimation[animation] || faceByAnimation.idle;
  return (
    <svg className="pet-illustration" viewBox="0 0 150 160" role="img" aria-label="桌宠">
      <path d="M34 50 C25 17 47 19 59 47" className="pet-ear" />
      <path d="M91 47 C103 19 125 17 116 50" className="pet-ear" />
      <path d="M25 71 C25 33 125 33 125 71 v38 C125 138 104 150 75 150 C46 150 25 138 25 109 Z" className="pet-body-shape" />
      <circle cx="48" cy="91" r="7" className="pet-blush" />
      <circle cx="102" cy="91" r="7" className="pet-blush" />
      <Eye type={face.eyes} side="left" />
      <Eye type={face.eyes} side="right" />
      <Mouth type={face.mouth} />
      <Mark type={face.mark} />
    </svg>
  );
}

function SpritePet({ sprite, animation }) {
  const action = useMemo(() => {
    return selectSpriteAction(sprite, animation);
  }, [sprite, animation]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!action || action.frameCount <= 1) return undefined;
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % action.frameCount);
    }, 140);
    return () => clearInterval(timer);
  }, [action]);

  if (!sprite?.spritesheetUrl || !action) return null;

  return (
    <div
      className="pet-sprite-frame"
      aria-label={action.id}
      style={{
        backgroundImage: `url("${sprite.spritesheetUrl}")`,
        ...spriteFrameStyle(sprite, action, frame)
      }}
    />
  );
}

function PetApp() {
  const state = usePetState();
  const [dragging, setDragging] = useState(false);

  const runtime = state?.runtime;
  const isMini = runtime?.mode === 'mini' || state?.preferences?.miniMode;
  const activeAsset = useMemo(() => {
    if (!state || !runtime?.animation) return null;
    return state.assetSlots?.find((slot) => slot.id === runtime.animation && slot.assetUrl) || null;
  }, [state, runtime?.animation]);
  const appliedSprite = state?.petSpriteGenerator?.appliedSprite || null;
  const renderSource = choosePetRenderSource(appliedSprite, activeAsset);

  if (!state) return null;

  const handleMouseDown = () => {
    setDragging(true);
    window.desktopPet.beginDrag();
  };

  const handleMouseMove = () => {
    if (dragging) window.desktopPet.dragBy(0, 0);
  };

  const stopDrag = () => setDragging(false);
  const handlePetClick = () => window.desktopPet.triggerEvent(isMini ? 'agent_task_completed' : 'work_focus_long');

  const handleContextMenu = (event) => {
    event.preventDefault();
    window.desktopPet.openPetMenu();
  };

  return (
    <main
      className={`pet-shell ${isMini ? 'mini' : 'normal'} ${state.preferences.dnd ? 'dnd' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onContextMenu={handleContextMenu}
    >
      <button
        className={`pet-body animation-${runtime.animation}`}
        onMouseDown={handleMouseDown}
        onClick={handlePetClick}
        title="拖动移动桌宠，右键打开菜单"
      >
        {renderSource === 'applied-spritesheet' ? (
          <SpritePet sprite={appliedSprite} animation={runtime.animation} />
        ) : renderSource === 'asset-slot' ? (
          <img className="pet-asset" src={activeAsset.assetUrl} alt={activeAsset.name} />
        ) : (
          <PetIllustration animation={runtime.animation} />
        )}
      </button>
</main>
  );
}

createRoot(document.getElementById('root')).render(<PetApp />);

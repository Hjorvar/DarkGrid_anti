/**
 * DARKGRID ADVENTURE LAB — Living Environments & Atmospheric Particle Engine (ES Module)
 */
import { store } from '../state/store.js';
import { isReducedMotionPreferred } from '../ui/utils.js';

export function syncEffectsButtons(mode) {
  const norm = ['off', 'subtle', 'full'].includes(String(mode || 'subtle').toLowerCase())
    ? String(mode || 'subtle').toLowerCase()
    : 'subtle';
  store.currentEffectsMode = norm;
  ['off', 'subtle', 'full'].forEach(m => {
    const btn = document.getElementById('fx-btn-' + m);
    if (btn) btn.classList.toggle('is-active', m === norm);
  });
}

export function stopAtmosphericParticleLoop() {
  store.atmoParticles = [];
  if (store.atmoAnimFrameId) {
    cancelAnimationFrame(store.atmoAnimFrameId);
    store.atmoAnimFrameId = null;
  }
  const canvas = document.getElementById('fp-atmo-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export function setAtmosphericEffectsMode(mode) {
  syncEffectsButtons(mode);
  const norm = store.currentEffectsMode;

  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove('fx-mode-off', 'fx-mode-subtle', 'fx-mode-full');
    vp.classList.add('fx-mode-' + norm);
  }

  if (store.currentState) {
    syncAtmosphericEffects(store.currentState);
  }
}

export function syncAtmosphericEffects(state) {
  const vp = document.getElementById('fp-viewport');
  const atmoLayer = document.getElementById('fp-atmosphere-layer');
  const pulseLayer = document.getElementById('fp-light-pulse-layer');
  const canvas = document.getElementById('fp-atmo-canvas');
  if (!vp || !atmoLayer) return;

  vp.classList.remove('fx-mode-off', 'fx-mode-subtle', 'fx-mode-full');
  vp.classList.add('fx-mode-' + store.currentEffectsMode);

  const scene = state && state.viewportScene;
  const mode = (state && state.sceneMode) || store.currentSceneMode || 'C';
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const profile = activeScene.effectProfile || (scene && scene.effectProfile) || {
    profileKey: 'forest-deep',
    mistColor: 'rgba(155, 190, 168, 0.14)',
    mistOpacity: 0.15,
    mistSpeedSec: 34,
    lightPulseColor: 'rgba(120, 175, 135, 0.08)',
    lightPulseStyle: 'canopy-breathe',
    particleType: 'spores',
    particleColor: 'rgba(188, 225, 195, 0.52)',
    particleCountSubtle: 11,
    particleCountFull: 24,
    particleSpeed: 0.35,
    windDriftX: 0.12
  };

  store.activeEffectProfile = profile;
  const mult = store.currentEffectsMode === 'full' ? 1.45 : (store.currentEffectsMode === 'subtle' ? 1.0 : 0);
  const mistOp = Math.min(0.32, (Number(profile.mistOpacity || 0.14) * mult)).toFixed(3);
  const speedBack = Math.max(16, Math.round((Number(profile.mistSpeedSec || 32)) / (store.currentEffectsMode === 'full' ? 1.2 : 1.0)));
  const speedFront = Math.max(12, Math.round(speedBack * 0.78));

  atmoLayer.style.setProperty('--mist-color', profile.mistColor || 'rgba(165, 195, 180, 0.14)');
  atmoLayer.style.setProperty('--mist-opacity', mistOp);
  atmoLayer.style.setProperty('--mist-duration-back', `${speedBack}s`);
  atmoLayer.style.setProperty('--mist-duration-front', `${speedFront}s`);

  if (pulseLayer) {
    pulseLayer.className = `fp-light-pulse-layer pulse-${profile.lightPulseStyle || 'canopy-breathe'}`;
    pulseLayer.style.setProperty('--pulse-color', profile.lightPulseColor || 'rgba(120, 175, 135, 0.08)');
    pulseLayer.style.setProperty('--pulse-opacity', store.currentEffectsMode === 'full' ? '1' : '0.72');
  }

  // Re-seed particle pool for canvas
  if (!canvas || store.currentEffectsMode === 'off' || isReducedMotionPreferred() || mode === 'LEGACY') {
    store.atmoParticles = [];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  const targetCount = store.currentEffectsMode === 'full'
    ? Number(profile.particleCountFull || 20)
    : Number(profile.particleCountSubtle || 9);

  const rect = canvas.getBoundingClientRect();
  const cw = Math.max(320, Math.round(rect.width || 800));
  const ch = Math.max(220, Math.round(rect.height || 500));
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  store.atmoParticles = [];
  for (let i = 0; i < targetCount; i++) {
    const pType = profile.particleType || 'spores';
    const isEmber = pType === 'embers';
    const isWind = pType === 'dust-wind';
    store.atmoParticles.push({
      x: Math.random() * cw,
      y: Math.random() * ch,
      r: isEmber ? (1.2 + Math.random() * 1.6) : (isWind ? (1.0 + Math.random() * 1.4) : (1.3 + Math.random() * 2.1)),
      vx: (Number(profile.windDriftX || 0.15) * (0.65 + Math.random() * 0.7)) * (store.currentEffectsMode === 'full' ? 1.25 : 0.85),
      vy: isEmber
        ? -(0.22 + Math.random() * 0.38)
        : ((Math.random() - 0.46) * Number(profile.particleSpeed || 0.35)),
      phase: Math.random() * Math.PI * 2,
      alphaBase: 0.24 + Math.random() * 0.44
    });
  }

  if (!store.atmoAnimFrameId) {
    store.atmoAnimFrameId = requestAnimationFrame(stepAtmosphericParticles);
  }
}

export function stepAtmosphericParticles(ts) {
  if (store.currentEffectsMode === 'off' || isReducedMotionPreferred() || store.atmoParticles.length === 0) {
    store.atmoAnimFrameId = null;
    return;
  }
  // Throttle to ~30fps for ultra-low CPU/GPU footprint
  if (ts - store.atmoLastTick < 32) {
    store.atmoAnimFrameId = requestAnimationFrame(stepAtmosphericParticles);
    return;
  }
  store.atmoLastTick = ts;

  const canvas = document.getElementById('fp-atmo-canvas');
  if (!canvas) {
    store.atmoAnimFrameId = null;
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    store.atmoAnimFrameId = null;
    return;
  }

  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  const colorStr = (store.activeEffectProfile && store.activeEffectProfile.particleColor) || 'rgba(188, 225, 195, 0.52)';
  ctx.fillStyle = colorStr;

  for (let i = 0; i < store.atmoParticles.length; i++) {
    const p = store.atmoParticles[i];
    p.phase += 0.04;
    p.x += p.vx + Math.sin(p.phase) * 0.18;
    p.y += p.vy + Math.cos(p.phase * 0.8) * 0.10;

    if (p.x > cw + 8) p.x = -6;
    if (p.x < -8) p.x = cw + 6;
    if (p.y > ch + 8) p.y = -6;
    if (p.y < -8) p.y = ch + 6;

    const pulseAlpha = Math.max(0.08, Math.min(0.85, p.alphaBase + Math.sin(p.phase) * 0.16));
    ctx.globalAlpha = pulseAlpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  store.atmoAnimFrameId = requestAnimationFrame(stepAtmosphericParticles);
}

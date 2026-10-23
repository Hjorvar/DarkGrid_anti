/**
 * DARKGRID ADVENTURE LAB — Conflict-Free Keyboard Shortcuts & Viewport Resize Handler (ES Module)
 */
import { store } from '../state/store.js';
import { isEditableTarget } from './utils.js';
import { closeLabModal, openLabModal } from './modals.js';
import { toggleMonsterSizeComparisonLab } from '../combat/size-arena.js';
import { closePoiPlaque, dispatchMove, dispatchRelativeMove, dispatchTurn, triggerInspectPoi } from '../api/client.js';
import { toggleChronicleHistory } from './chronicle.js';
import { toggleDevToolsDrawer } from './hud.js';
import {
  handleSlot1Click,
  handleSlot2Click,
  handleSlot3Click,
  handleSlot4Click,
  handleBattlePrayerClick,
  handleSmiteClick,
  handleDivineShieldClick
} from '../combat/combat-ui.js';
import { renderViewportCenterStage } from '../world/scene-renderer.js';

let shortcutsInitialized = false;

export function setupKeyboardShortcuts() {
  if (shortcutsInitialized) return;
  shortcutsInitialized = true;

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (isEditableTarget(e.target)) return;

    const backdrop = document.getElementById('lab-modal-backdrop');
    const modalOpen = backdrop && !backdrop.hidden;

    if (e.key === 'Escape') {
      if (modalOpen) {
        e.preventDefault();
        closeLabModal();
      } else if (store.isSizeComparisonLabOpen) {
        e.preventDefault();
        toggleMonsterSizeComparisonLab(false);
      } else if (store.isPoiPlaqueOpen) {
        e.preventDefault();
        closePoiPlaque();
      } else if (store.isChronicleExpanded) {
        e.preventDefault();
        toggleChronicleHistory(false);
      }
      return;
    }

    // Do not trigger game navigation or action hotkeys while a modal dialog owns keyboard focus
    if (modalOpen) return;

    const labAllowed = !store.currentState || store.currentState.labToolsAllowed !== false;

    switch (e.key) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        e.preventDefault();
        dispatchMove('NORTH');
        break;
      case 's':
      case 'S':
      case 'ArrowDown':
        e.preventDefault();
        dispatchMove('SOUTH');
        break;
      case 'a':
      case 'A':
      case 'ArrowLeft':
        e.preventDefault();
        dispatchMove('WEST');
        break;
      case 'd':
      case 'D':
      case 'ArrowRight':
        e.preventDefault();
        dispatchMove('EAST');
        break;
      case 'q':
      case 'Q':
        e.preventDefault();
        dispatchTurn('LEFT');
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        dispatchTurn('RIGHT');
        break;
      case ' ':
      case '1':
        e.preventDefault();
        handleSlot1Click();
        break;
      case '2':
        e.preventDefault();
        handleSlot2Click();
        break;
      case '3':
      case 'r':
      case 'R':
        e.preventDefault();
        handleSlot3Click();
        break;
      case '4':
      case 'f':
      case 'F':
        e.preventDefault();
        handleSlot4Click();
        break;
      case '5':
        e.preventDefault();
        handleBattlePrayerClick();
        break;
      case '6':
        e.preventDefault();
        handleSmiteClick();
        break;
      case '7':
        e.preventDefault();
        handleDivineShieldClick();
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        triggerInspectPoi();
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        toggleChronicleHistory();
        break;
      case '?':
      case '/':
        e.preventDefault();
        openLabModal('help');
        break;
      case '`':
      case '~':
        if (labAllowed) {
          e.preventDefault();
          toggleDevToolsDrawer();
        }
        break;
      case 'v':
      case 'V':
        if (labAllowed) {
          e.preventDefault();
          openLabModal('atlas');
        }
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        openLabModal('character');
        break;
      case 'b':
      case 'B':
        e.preventDefault();
        openLabModal('backpack');
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        openLabModal('market');
        break;
      case 'j':
      case 'J':
        e.preventDefault();
        openLabModal('quests');
        break;
      case 'l':
      case 'L':
        e.preventDefault();
        openLabModal('journal');
        break;
      case 'g':
      case 'G':
        if (labAllowed) {
          e.preventDefault();
          openLabModal('director');
        }
        break;
      case 'z':
      case 'Z':
        if (labAllowed) {
          e.preventDefault();
          toggleMonsterSizeComparisonLab();
        }
        break;
    }
  });

  let resizeScaleDebounce = null;
  window.addEventListener('resize', () => {
    if (resizeScaleDebounce) clearTimeout(resizeScaleDebounce);
    resizeScaleDebounce = setTimeout(() => {
      if (store.currentState && store.currentState.mode !== 'FALLEN' && !store.isSequencePlaying) {
        renderViewportCenterStage(store.currentState);
      }
    }, 80);
  });
}

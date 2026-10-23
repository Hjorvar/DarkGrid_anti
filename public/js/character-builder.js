function initCharacterBuilder() {
  const form = document.getElementById('character-creation-form');
  if (!form) return;

  const classCards = document.querySelectorAll('.class-card');
  const classInput = document.getElementById('selected-class-input');
  const remainingPointsDisplay = document.getElementById('remaining-points-count');
  const resetPresetBtn = document.getElementById('reset-preset-btn');
  const submitBtn = document.getElementById('create-hero-btn');

  const STATS = ['strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma'];

  const classBasesData = JSON.parse(document.getElementById('class-bases-json').textContent);
  const statRules = JSON.parse(document.getElementById('stat-rules-json').textContent);

  const requiredTotal = Number(statRules.requiredTotalSum || statRules.totalSum || 72);
  const minScore = Number(statRules.minScore || 8);
  const maxScore = Number(statRules.maxScore || 18);

  let currentClass = classInput.value || 'FIGHTER';
  let stats = {};

  function initStatsForClass(clsKey) {
    const base = classBasesData[clsKey] || classBasesData.FIGHTER;
    STATS.forEach(s => {
      stats[s] = Number(base[s]);
    });
  }

  function getModifier(score) {
    return Math.floor((score - 10) / 2);
  }

  function formatModifier(score) {
    const mod = getModifier(score);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  function getAttributeTierLabel(score) {
    const s = Number(score || 10);
    if (s <= 7) return 'Weak';
    if (s <= 9) return 'Below Average';
    if (s <= 11) return 'Average';
    if (s <= 13) return 'Good';
    if (s <= 15) return 'Strong';
    if (s <= 17) return 'Exceptional';
    if (s <= 19) return 'Heroic';
    return 'Legendary';
  }

  function calculateTotalPoints() {
    let totalScore = 0;
    STATS.forEach(s => {
      totalScore += Number(stats[s] || 0);
    });
    return totalScore;
  }

  function updateUI() {
    const base = classBasesData[currentClass] || classBasesData.FIGHTER;
    const totalAllocated = calculateTotalPoints();
    const remainingPoints = requiredTotal - totalAllocated;

    if (remainingPointsDisplay) {
      remainingPointsDisplay.textContent = remainingPoints;
      remainingPointsDisplay.style.color = remainingPoints === 0 ? '#68d391' : (remainingPoints < 0 ? '#fc8181' : '#f6e05e');
    }

    STATS.forEach(s => {
      const displayElem = document.getElementById(`val-${s}`);
      const modElem = document.getElementById(`mod-${s}`);
      const tierElem = document.getElementById(`tier-${s}`);
      const inputElem = document.getElementById(`input-${s}`);
      const btnMinus = document.getElementById(`btn-minus-${s}`);
      const btnPlus = document.getElementById(`btn-plus-${s}`);
      const baseLabel = document.getElementById(`base-${s}`);

      const currentVal = stats[s];
      const baseVal = base[s];

      if (displayElem) displayElem.textContent = currentVal;
      if (modElem) modElem.textContent = formatModifier(currentVal);
      if (tierElem) tierElem.textContent = getAttributeTierLabel(currentVal);
      if (inputElem) inputElem.value = currentVal;
      if (baseLabel) baseLabel.textContent = `(preset ${baseVal})`;

      if (btnMinus) {
        btnMinus.disabled = currentVal <= minScore;
      }
      if (btnPlus) {
        btnPlus.disabled = (currentVal >= maxScore) || (remainingPoints <= 0);
      }
    });

    if (submitBtn) {
      submitBtn.disabled = remainingPoints !== 0;
    }
  }

  const favoredGroup = document.getElementById('ranger-favored-enemy-group');
  const favoredSelect = document.getElementById('favored-enemy-select');
  const favoredTypeInput = document.getElementById('favored-enemy-type-input');
  const favoredSubtypeInput = document.getElementById('favored-enemy-subtype-input');

  function syncFavoredEnemy() {
    if (!favoredSelect || !favoredTypeInput) return;
    favoredTypeInput.value = favoredSelect.value || 'ANIMALS';
    if (favoredSubtypeInput) {
      favoredSubtypeInput.value = '';
    }
  }

  if (favoredSelect) {
    favoredSelect.addEventListener('change', syncFavoredEnemy);
    syncFavoredEnemy();
  }

  if (resetPresetBtn) {
    resetPresetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      initStatsForClass(currentClass);
      updateUI();
    });
  }

  // Class selection handler
  classCards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedClass = card.getAttribute('data-class');
      classCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      currentClass = selectedClass;
      classInput.value = selectedClass;

      if (favoredGroup) {
        favoredGroup.style.display = selectedClass === 'RANGER' ? 'block' : 'none';
      }

      initStatsForClass(selectedClass);
      updateUI();
    });
  });

  // Attach stepper buttons
  STATS.forEach(s => {
    const btnMinus = document.getElementById(`btn-minus-${s}`);
    const btnPlus = document.getElementById(`btn-plus-${s}`);

    if (btnMinus) {
      btnMinus.addEventListener('click', (e) => {
        e.preventDefault();
        if (stats[s] > minScore) {
          stats[s]--;
          updateUI();
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', (e) => {
        e.preventDefault();
        const remaining = requiredTotal - calculateTotalPoints();
        if (stats[s] < maxScore && remaining > 0) {
          stats[s]++;
          updateUI();
        }
      });
    }
  });

  // Initial load
  const initialClass = classInput.value || 'FIGHTER';
  initStatsForClass(initialClass);
  updateUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCharacterBuilder);
} else {
  initCharacterBuilder();
}

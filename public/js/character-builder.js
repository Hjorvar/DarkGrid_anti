document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('character-creation-form');
  if (!form) return;

  const classCards = document.querySelectorAll('.class-card');
  const classInput = document.getElementById('selected-class-input');
  const remainingPointsDisplay = document.getElementById('remaining-points-count');
  const submitBtn = document.getElementById('create-hero-btn');

  const STATS = ['strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma'];

  // Read class bases from data attributes embedded in DOM
  const classBasesData = JSON.parse(document.getElementById('class-bases-json').textContent);
  const statRules = JSON.parse(document.getElementById('stat-rules-json').textContent);

  let currentClass = classInput.value || 'FIGHTER';
  let stats = {};

  function initStatsForClass(clsKey) {
    const base = classBasesData[clsKey];
    STATS.forEach(s => {
      stats[s] = base[s];
    });
  }

  function getModifier(score) {
    return Math.floor((score - 10) / 2);
  }

  function formatModifier(score) {
    const mod = getModifier(score);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  function calculatePointsSpent() {
    const base = classBasesData[currentClass];
    let totalScore = 0;
    STATS.forEach(s => {
      totalScore += stats[s];
    });
    return totalScore - statRules.baseSum;
  }

  function updateUI() {
    const base = classBasesData[currentClass];
    const pointsSpent = calculatePointsSpent();
    const remainingPoints = statRules.bonusPoints - pointsSpent;

    if (remainingPointsDisplay) {
      remainingPointsDisplay.textContent = remainingPoints;
      remainingPointsDisplay.style.color = remainingPoints === 0 ? '#68d391' : (remainingPoints < 0 ? '#fc8181' : '#f6e05e');
    }

    STATS.forEach(s => {
      const displayElem = document.getElementById(`val-${s}`);
      const modElem = document.getElementById(`mod-${s}`);
      const inputElem = document.getElementById(`input-${s}`);
      const btnMinus = document.getElementById(`btn-minus-${s}`);
      const btnPlus = document.getElementById(`btn-plus-${s}`);
      const baseLabel = document.getElementById(`base-${s}`);

      const currentVal = stats[s];
      const baseVal = base[s];
      const minVal = baseVal - statRules.maxReductionPerStat;
      const maxVal = statRules.maxScore;

      if (displayElem) displayElem.textContent = currentVal;
      if (modElem) modElem.textContent = formatModifier(currentVal);
      if (inputElem) inputElem.value = currentVal;
      if (baseLabel) baseLabel.textContent = `(base ${baseVal})`;

      // Disable conditions
      if (btnMinus) {
        btnMinus.disabled = currentVal <= minVal;
      }
      if (btnPlus) {
        btnPlus.disabled = (currentVal >= maxVal) || (remainingPoints <= 0);
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
    if (!favoredSelect || !favoredTypeInput || !favoredSubtypeInput) return;
    const parts = (favoredSelect.value || 'ANIMAL:').split(':');
    favoredTypeInput.value = parts[0] || 'ANIMAL';
    favoredSubtypeInput.value = parts[1] || '';
  }

  if (favoredSelect) {
    favoredSelect.addEventListener('change', syncFavoredEnemy);
    syncFavoredEnemy();
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
        const base = classBasesData[currentClass];
        const minVal = base[s] - statRules.maxReductionPerStat;
        if (stats[s] > minVal) {
          stats[s]--;
          updateUI();
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', (e) => {
        e.preventDefault();
        const pointsSpent = calculatePointsSpent();
        const remaining = statRules.bonusPoints - pointsSpent;
        if (stats[s] < statRules.maxScore && remaining > 0) {
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
});

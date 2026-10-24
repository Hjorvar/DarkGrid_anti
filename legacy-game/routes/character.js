const express = require('express');
const router = express.Router();
const config = require('../../src/config');
const { requireAuth } = require('../../src/middleware/auth');
const {
  getLivingCharacterByUserId,
  createCharacter,
  getModifier,
  formatModifier,
  getAttributeTierLabel
} = require('../../src/domain/character/rules');
const { getRangerSelectableFamilies } = require('../../src/domain/monsters/taxonomy');

router.use(requireAuth);

router.get('/create', (req, res) => {
  const existingCharacter = getLivingCharacterByUserId(req.db, req.user.id);
  if (existingCharacter) {
    return res.redirect('/game');
  }

  res.render('create-character', {
    error: null,
    errors: [],
    classBases: config.classBases,
    statRules: config.statRules,
    favoredEnemyOptions: getRangerSelectableFamilies(),
    getModifier,
    formatModifier,
    getAttributeTierLabel,
    formData: {
      name: '',
      classType: 'FIGHTER',
      favoredEnemyFamily: 'ANIMALS'
    }
  });
});

router.post('/create', (req, res) => {
  const existingCharacter = getLivingCharacterByUserId(req.db, req.user.id);
  if (existingCharacter) {
    return res.redirect('/game');
  }

  const {
    name,
    classType,
    strength,
    constitution,
    dexterity,
    intelligence,
    wisdom,
    charisma,
    favoredEnemyFamily,
    favoredEnemyType,
    favoredEnemySubtype
  } = req.body;

  const stats = {
    strength: parseInt(strength, 10),
    constitution: parseInt(constitution, 10),
    dexterity: parseInt(dexterity, 10),
    intelligence: parseInt(intelligence, 10),
    wisdom: parseInt(wisdom, 10),
    charisma: parseInt(charisma, 10)
  };

  try {
    createCharacter(req.db, {
      userId: req.user.id,
      name,
      classType,
      stats,
      favoredEnemyFamily: favoredEnemyFamily || favoredEnemyType || null,
      favoredEnemyType: favoredEnemyType || favoredEnemyFamily || null,
      favoredEnemySubtype: favoredEnemySubtype || null
    });

    res.redirect('/game');
  } catch (err) {
    res.status(err.status || 400).render('create-character', {
      error: err.message,
      errors: err.validationErrors || [err.message],
      classBases: config.classBases,
      statRules: config.statRules,
      favoredEnemyOptions: getRangerSelectableFamilies(),
      getModifier,
      formatModifier,
      getAttributeTierLabel,
      formData: {
        name,
        classType,
        favoredEnemyFamily: favoredEnemyFamily || favoredEnemyType || 'ANIMALS',
        favoredEnemyType,
        favoredEnemySubtype,
        ...stats
      }
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const {
  getLivingCharacterByUserId,
  createCharacter,
  getModifier,
  formatModifier
} = require('../domain/character/rules');

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
    getModifier,
    formatModifier,
    formData: {
      name: '',
      classType: 'FIGHTER'
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
      favoredEnemyType: favoredEnemyType || null,
      favoredEnemySubtype: favoredEnemySubtype || null
    });

    res.redirect('/game');
  } catch (err) {
    res.status(err.status || 400).render('create-character', {
      error: err.message,
      errors: err.validationErrors || [err.message],
      classBases: config.classBases,
      statRules: config.statRules,
      getModifier,
      formatModifier,
      formData: {
        name,
        classType,
        favoredEnemyType,
        favoredEnemySubtype,
        ...stats
      }
    });
  }
});

module.exports = router;

/**
 * Darkgrid Economy & Shop System
 * Manages City General Stores, standard equipment trade, free healing,
 * and the shared Global Magical Resale Market.
 */

const { withTransaction } = require('../../db/connection');

/**
 * Validates that character is alive and located in a safe city haven.
 */
function assertInSafeCity(tx, characterId) {
  const character = tx.prepare(`
    SELECT c.*, t.terrain, t.is_safe
    FROM characters c
    JOIN map_tiles t ON c.tile_id = t.id
    WHERE c.id = ?
  `).get(characterId);

  if (!character || character.is_alive !== 1) {
    throw new Error('Only living heroes can visit the market.');
  }

  if (character.terrain !== 'CITY' || character.is_safe !== 1) {
    throw new Error('Stores and trading are only available within safe haven cities.');
  }

  return character;
}

/**
 * Returns available store inventory in the city:
 * 1. Standard unlimited stock (all non-magical equipment + Minor Healing Potion)
 * 2. Active global magical resale listings
 */
function getCityStoreStock(db) {
  // 1. Unlimited standard merchandise
  const standardItems = db.prepare(`
    SELECT id, name, category, description, buy_price, sell_price, is_magical,
           damage_dice, armor_bonus, shield_bonus, max_dex_bonus, enhancement_bonus,
           weapon_range_type, is_two_handed, allowed_classes
    FROM item_definitions
    WHERE is_magical = 0 OR name = 'Minor Healing Potion'
    ORDER BY category ASC, buy_price ASC
  `).all();

  // 2. Global magical resale market items
  const resaleListings = db.prepare(`
    SELECT ml.id as listing_id, ml.price as resale_price, ml.created_at as listed_at,
           ii.id as item_instance_id, id.id as definition_id, id.name, id.category,
           id.description, id.damage_dice, id.armor_bonus, id.shield_bonus,
           id.max_dex_bonus, id.enhancement_bonus, id.weapon_range_type,
           id.is_two_handed, id.allowed_classes, id.is_magical
    FROM market_listings ml
    JOIN item_instances ii ON ml.item_instance_id = ii.id
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ml.status = 'ACTIVE' AND ii.owner_type = 'MARKET'
    ORDER BY ml.id DESC
  `).all();

  return {
    standardItems,
    resaleListings
  };
}

/**
 * Buys a standard item definition or a global magical resale listing.
 */
function buyItem(db, characterId, { itemDefinitionId, listingId }) {
  return withTransaction(db, (tx) => {
    const character = assertInSafeCity(tx, characterId);

    // Inventory capacity check (M6)
    const totalInventoryCount = tx.prepare(`
      SELECT COUNT(*) as count FROM item_instances
      WHERE owner_type = 'CHARACTER' AND owner_character_id = ?
    `).get(characterId).count;

    if (totalInventoryCount >= 50) {
      throw new Error('Your backpack is full. You cannot carry more than 50 items.');
    }

    if (listingId) {
      // Purchasing from the Shared Global Magical Resale Market
      const listing = tx.prepare(`
        SELECT ml.*, ii.id as instance_id, ii.item_definition_id,
               id.name, id.category, id.is_magical
        FROM market_listings ml
        JOIN item_instances ii ON ml.item_instance_id = ii.id
        JOIN item_definitions id ON ii.item_definition_id = id.id
        WHERE ml.id = ? AND ml.status = 'ACTIVE' AND ii.owner_type = 'MARKET'
      `).get(listingId);

      if (!listing) {
        throw new Error('This magical artifact has already been acquired by another hero or withdrawn.');
      }

      if (character.gold < listing.price) {
        throw new Error(`Insufficient gold. Price is ${listing.price} gp, but you only carry ${character.gold} gp.`);
      }

      // Deduct gold
      tx.prepare('UPDATE characters SET gold = gold - ? WHERE id = ?').run(listing.price, characterId);

      // Conclude market listing
      tx.prepare(`
        UPDATE market_listings
        SET status = 'SOLD', buyer_character_id = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(characterId, listing.id);

      // Transfer the unique item instance to the buyer
      tx.prepare(`
        UPDATE item_instances
        SET owner_type = 'CHARACTER', owner_character_id = ?, equipped_slot = NULL
        WHERE id = ?
      `).run(characterId, listing.instance_id);

      return {
        success: true,
        purchasedItem: {
          instanceId: listing.instance_id,
          name: listing.name,
          price: listing.price,
          isMagical: true,
          fromMarket: true
        },
        remainingGold: character.gold - listing.price
      };
    }

    // Purchasing from Standard General Store Stock
    const itemDef = tx.prepare(`
      SELECT * FROM item_definitions
      WHERE id = ? AND (is_magical = 0 OR name = 'Minor Healing Potion')
    `).get(itemDefinitionId);

    if (!itemDef) {
      throw new Error('Item definition not available for regular purchase.');
    }

    const price = itemDef.buy_price;
    if (character.gold < price) {
      throw new Error(`Insufficient gold. Price is ${price} gp, but you only possess ${character.gold} gp.`);
    }

    // Free item abuse prevention (M6): limit zero-cost items (e.g. Club) to 2 per character
    if (price === 0) {
      const freeItemCount = tx.prepare(`
        SELECT COUNT(*) as count FROM item_instances
        WHERE owner_type = 'CHARACTER' AND owner_character_id = ? AND item_definition_id = ?
      `).get(characterId, itemDef.id).count;

      if (freeItemCount >= 2) {
        throw new Error(`You already possess the maximum permitted amount of ${itemDef.name}.`);
      }
    }

    // Deduct gold
    tx.prepare('UPDATE characters SET gold = gold - ? WHERE id = ?').run(price, characterId);

    // Create new item instance
    const insertRes = tx.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
      VALUES (?, 'CHARACTER', ?, NULL)
    `).run(itemDef.id, characterId);

    return {
      success: true,
      purchasedItem: {
        instanceId: Number(insertRes.lastInsertRowid),
        name: itemDef.name,
        price,
        isMagical: itemDef.is_magical === 1,
        fromMarket: false
      },
      remainingGold: character.gold - price
    };
  });
}

/**
 * Sells an item from player inventory to the shop.
 * Non-magical: shop pays 50% base price (floor), item is liquidated.
 * Magical: shop pays 40% base price (floor), unique item moves to Global Resale Market at 125% base price (ceil).
 */
function sellItem(db, characterId, itemInstanceId) {
  return withTransaction(db, (tx) => {
    const character = assertInSafeCity(tx, characterId);

    const item = tx.prepare(`
      SELECT ii.*, id.name, id.category, id.buy_price, id.is_magical
      FROM item_instances ii
      JOIN item_definitions id ON ii.item_definition_id = id.id
      WHERE ii.id = ? AND ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
    `).get(itemInstanceId, characterId);

    if (!item) {
      throw new Error('Item not found in your inventory.');
    }

    if (item.equipped_slot !== null && item.equipped_slot !== undefined) {
      throw new Error('Cannot sell equipped gear. You must unequip the item first.');
    }

    // Minor Healing Potion exception: consumable potion sold back as standard goods
    const isPotion = (item.category === 'POTION');

    if (item.is_magical === 1 && !isPotion) {
      // Magical Item: 40% payout to hero, moves to Global Resale Market at 125%
      const payPrice = Math.floor(item.buy_price * 0.40);
      const resalePrice = Math.ceil(item.buy_price * 1.25);

      // Pay player
      tx.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(payPrice, characterId);

      // Move unique item instance to MARKET ownership
      tx.prepare(`
        UPDATE item_instances
        SET owner_type = 'MARKET', owner_character_id = NULL, equipped_slot = NULL
        WHERE id = ?
      `).run(item.id);

      // Create active market listing visible across all cities
      tx.prepare(`
        INSERT INTO market_listings (
          item_instance_id, seller_character_id, price, status
        ) VALUES (?, ?, ?, 'ACTIVE')
      `).run(item.id, characterId, resalePrice);

      return {
        success: true,
        goldEarned: payPrice,
        itemName: item.name,
        resalePrice,
        movedToMarket: true,
        totalGold: character.gold + payPrice
      };
    }

    // Normal Item: 50% payout to hero, liquidated
    const payPrice = Math.floor(item.buy_price * 0.50);

    // Pay player
    tx.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(payPrice, characterId);

    // Remove item instance
    tx.prepare('DELETE FROM item_instances WHERE id = ?').run(item.id);

    return {
      success: true,
      goldEarned: payPrice,
      itemName: item.name,
      resalePrice: null,
      movedToMarket: false,
      totalGold: character.gold + payPrice
    };
  });
}

module.exports = {
  getCityStoreStock,
  buyItem,
  sellItem
};

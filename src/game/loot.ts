import { Item } from '../types'
import { d100 } from './dice'

export const LOOT_TABLES: Item[] = [
  // Helmets
  { id: '53', name: 'Leather Cap', type: 'helmet', rarity: 'common', stat_bonus: 1, description: 'Keeps your head mostly intact.' },
  { id: '54', name: 'Iron Helm', type: 'helmet', rarity: 'uncommon', stat_bonus: 2, description: 'Heavy but protective.' },
  { id: '55', name: 'Helm of Brilliance', type: 'helmet', rarity: 'rare', stat_bonus: 4, description: 'Glitters with inner light.' },
  // Cloaks
  { id: '56', name: 'Tattered Cloak', type: 'cloak', rarity: 'common', stat_bonus: 1, description: 'Barely holds together.' },
  { id: '57', name: 'Cloak of Elvenkind', type: 'cloak', rarity: 'uncommon', stat_bonus: 2, description: 'Hard to spot in the shadows.' },
  { id: '58', name: 'Cloak of the Bat', type: 'cloak', rarity: 'rare', stat_bonus: 4, description: 'Smells faintly of caves.' },
  // Neck
  { id: '59', name: 'Copper Pendant', type: 'neck', rarity: 'common', stat_bonus: 1, description: 'A simple charm.' },
  { id: '60', name: 'Necklace of Fireballs', type: 'neck', rarity: 'uncommon', stat_bonus: 3, description: 'Handle with care.' },
  { id: '61', name: 'Periapt of Wound Closure', type: 'neck', rarity: 'rare', stat_bonus: 5, description: 'Wounds close faster.' },
  // Eyes
  { id: '62', name: 'Smoked Goggles', type: 'eyes', rarity: 'common', stat_bonus: 1, description: 'Protects against bright light.' },
  { id: '63', name: 'Goggles of Night', type: 'eyes', rarity: 'uncommon', stat_bonus: 2, description: 'See in the dark.' },
  { id: '64', name: 'Eyes of the Eagle', type: 'eyes', rarity: 'rare', stat_bonus: 4, description: 'Spot a coin at 100 yards.' },
  // Waist
  { id: '65', name: 'Leather Belt', type: 'waist', rarity: 'common', stat_bonus: 1, description: 'Holds your pants up.' },
  { id: '66', name: 'Belt of Giant Strength', type: 'waist', rarity: 'rare', stat_bonus: 5, description: 'You feel impossibly strong.' },
  { id: '67', name: 'Cord of Direction', type: 'waist', rarity: 'uncommon', stat_bonus: 2, description: 'Always points the way.' },
  // Wrists
  { id: '68', name: 'Leather Bracers', type: 'wrist', rarity: 'common', stat_bonus: 1, description: 'Basic wrist protection.' },
  { id: '69', name: 'Bracers of Archery', type: 'wrist', rarity: 'uncommon', stat_bonus: 3, description: 'Your aim improves.' },
  { id: '70', name: 'Bracers of Defense', type: 'wrist', rarity: 'rare', stat_bonus: 5, description: 'Hard as adamantine.' },
  // Hands
  { id: '71', name: 'Worn Gloves', type: 'hands', rarity: 'common', stat_bonus: 1, description: 'Better than bare hands.' },
  { id: '72', name: 'Gloves of Thievery', type: 'hands', rarity: 'uncommon', stat_bonus: 2, description: 'Nimble fingers.' },
  { id: '73', name: 'Gauntlets of Ogre Power', type: 'hands', rarity: 'rare', stat_bonus: 4, description: 'Crush anything.' },
  // Feet
  { id: '74', name: 'Worn Boots', type: 'feet', rarity: 'common', stat_bonus: 1, description: 'Keep your feet dry. Mostly.' },
  { id: '75', name: 'Boots of Elvenkind', type: 'feet', rarity: 'uncommon', stat_bonus: 2, description: 'Silent as a whisper.' },
  { id: '76', name: 'Boots of Speed', type: 'feet', rarity: 'rare', stat_bonus: 4, description: 'Strike first, strike fast.' },
  // Rings
  { id: '77', name: 'Copper Ring', type: 'ring', rarity: 'common', stat_bonus: 1, description: 'A plain copper band.' },
  { id: '78', name: 'Ring of Feather Falling', type: 'ring', rarity: 'uncommon', stat_bonus: 2, description: 'Slow as a feather.' },
  { id: '79', name: 'Ring of Spell Storing', type: 'ring', rarity: 'rare', stat_bonus: 4, description: 'Holds a spell in reserve.' },
  // Shields
  { id: '80', name: 'Wooden Shield', type: 'shield', rarity: 'common', stat_bonus: 1, description: 'Better than nothing.' },
  { id: '81', name: 'Steel Shield', type: 'shield', rarity: 'uncommon', stat_bonus: 3, description: 'Solid protection.' },
  { id: '82', name: 'Shield of Missile Attraction', type: 'shield', rarity: 'rare', stat_bonus: 4, description: 'Draws fire away from allies.' },
  // Offensive scrolls
  { id: '83', name: 'Scroll of Magic Missile', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'Three darts of magical force.' },
  { id: '84', name: 'Scroll of Acid Arrow', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'A green bolt of acid.' },
  { id: '85', name: 'Scroll of Fireball', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'A roiling ball of fire.' },
  { id: '86', name: 'Scroll of Lightning Bolt', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'A stroke of lightning.' },
  { id: '87', name: 'Scroll of Ice Storm', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'Pelts foes with ice.' },
  { id: '88', name: 'Scroll of Chain Lightning', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Leaps between enemies.' },
  { id: '89', name: 'Scroll of Cone of Cold', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'A blast of freezing air.' },
  { id: '90', name: 'Scroll of Flame Strike', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Divine fire from above.' },
  { id: '91', name: 'Scroll of Disintegrate', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Reduces a target to dust.' },
  { id: '92', name: 'Scroll of Finger of Death', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'A dark ray of necrotic energy.' },
  // Healing scrolls
  { id: '93', name: 'Scroll of Cure Light Wounds', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'Heals minor wounds.' },
  { id: '94', name: 'Scroll of Cure Minor Wounds', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'Closes small cuts.' },
  { id: '95', name: 'Scroll of Cure Moderate Wounds', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'Heals moderate injuries.' },
  { id: '96', name: 'Scroll of Cure Serious Wounds', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'Heals serious injuries.' },
  { id: '97', name: 'Scroll of Cure Critical Wounds', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Heals critical injuries.' },
  // Cursed items
  { id: '98', name: 'Sword of Berserking', type: 'weapon', rarity: 'uncommon', stat_bonus: 3, description: 'Rage fills your mind.', is_cursed: true },
  { id: '99', name: 'Armor of Arrow Attraction', type: 'armor', rarity: 'uncommon', stat_bonus: 2, description: 'Something feels wrong.', is_cursed: true },
  { id: '100', name: 'Ring of Clumsiness', type: 'ring', rarity: 'common', stat_bonus: 2, description: 'Feels oddly heavy.', is_cursed: true },
  { id: '101', name: 'Helm of Opposite Alignment', type: 'helmet', rarity: 'uncommon', stat_bonus: 2, description: 'Your thoughts feel strange.', is_cursed: true },
  { id: '102', name: 'Cloak of Poison', type: 'cloak', rarity: 'uncommon', stat_bonus: 2, description: 'Smells faintly of nightshade.', is_cursed: true },
  // Arms
  { id: '103', name: 'Worn Vambraces', type: 'arms', rarity: 'common', stat_bonus: 1, description: 'Battered arm guards. Still better than nothing.' },
  { id: '104', name: 'Armbands of the Pit', type: 'arms', rarity: 'uncommon', stat_bonus: 3, description: 'Infernal markings that sharpen your strikes.' },
  { id: '105', name: 'Vambraces of the Warlord', type: 'arms', rarity: 'rare', stat_bonus: 5, description: 'Commanders wear these for a reason.' },
  // ── Rare ─────────────────────────────────────────────────────
  { id: '106', name: 'Amulet of Health', type: 'neck', rarity: 'rare', stat_bonus: 5, description: 'Your constitution feels fortified.' },
  { id: '107', name: 'Winged Boots', type: 'feet', rarity: 'rare', stat_bonus: 5, description: 'Step lightly. Very lightly.' },
  { id: '108', name: 'Ring of Protection', type: 'ring', rarity: 'rare', stat_bonus: 4, description: 'A faint shimmer surrounds you.' },
  { id: '109', name: 'Cloak of Displacement', type: 'cloak', rarity: 'rare', stat_bonus: 5, description: 'You appear to be somewhere else.' },
  { id: '110', name: 'Helm of Telepathy', type: 'helmet', rarity: 'rare', stat_bonus: 4, description: 'Whispers at the edge of thought.' },
  { id: '111', name: 'Gloves of Missile Snaring', type: 'hands', rarity: 'rare', stat_bonus: 4, description: 'Catch what comes at you.' },
  { id: '112', name: 'Belt of Dwarvenkind', type: 'waist', rarity: 'rare', stat_bonus: 5, description: 'You feel stout. Stouter.' },
  { id: '113', name: 'Vambraces of the Elven Court', type: 'arms', rarity: 'rare', stat_bonus: 5, description: 'Precision forged over centuries.' },
  { id: '114', name: 'Wristguards of the Duelist', type: 'wrist', rarity: 'rare', stat_bonus: 5, description: 'For those who fight with style.' },
  { id: '115', name: 'Goggles of Object Reading', type: 'eyes', rarity: 'rare', stat_bonus: 4, description: 'Objects have stories. Now you can read them.' },
  { id: '116', name: 'Ring of Mind Shielding', type: 'ring', rarity: 'rare', stat_bonus: 4, description: 'Your thoughts are your own.' },
  { id: '117', name: 'Cloak of the Manta Ray', type: 'cloak', rarity: 'rare', stat_bonus: 4, description: 'Useful if the dungeon floods.' },
  { id: '118', name: 'Boots of the Winterlands', type: 'feet', rarity: 'rare', stat_bonus: 4, description: 'Cold does not bother you anymore.' },
  { id: '119', name: 'Shield of Expression', type: 'shield', rarity: 'rare', stat_bonus: 5, description: 'The face on it changes. Do not ask what it means.' },
  { id: '120', name: 'Helm of Comprehending Languages', type: 'helmet', rarity: 'rare', stat_bonus: 4, description: 'Everything makes sense now. Almost.' },
  { id: '121', name: 'Necklace of Adaptation', type: 'neck', rarity: 'rare', stat_bonus: 4, description: 'Breathe easy. Anywhere.' },
  { id: '122', name: 'Gauntlets of the Pugilist', type: 'hands', rarity: 'rare', stat_bonus: 5, description: 'Built for hitting things repeatedly.' },
  { id: '123', name: 'Belt of the Brawler', type: 'waist', rarity: 'rare', stat_bonus: 4, description: 'You were already dangerous.' },
  { id: '124', name: 'Vambraces of the Pit Fighter', type: 'arms', rarity: 'rare', stat_bonus: 6, description: 'Arena-tested. Arena-proven.' },
  { id: '125', name: 'Circlet of Blasting', type: 'helmet', rarity: 'rare', stat_bonus: 5, description: 'Point and think. Results vary.' },
  { id: '126', name: 'Slippers of Spider Climbing', type: 'feet', rarity: 'rare', stat_bonus: 5, description: 'The ceiling is now an option.' },
  { id: '127', name: 'Ring of Warmth', type: 'ring', rarity: 'rare', stat_bonus: 4, description: 'The cold cannot reach you.' },
  { id: '128', name: 'Bracers of the Veteran', type: 'wrist', rarity: 'rare', stat_bonus: 6, description: 'Earned, not given.' },
  { id: '129', name: 'Goggles of the Hawk', type: 'eyes', rarity: 'rare', stat_bonus: 5, description: 'Nothing escapes your sight.' },
  { id: '130', name: 'Cloak of Many Fashions', type: 'cloak', rarity: 'rare', stat_bonus: 4, description: 'Practical magic for practical people.' },
  { id: '131', name: 'Shield of the Hidden Lord', type: 'shield', rarity: 'rare', stat_bonus: 6, description: 'Something is watching from behind the steel.' },
  { id: '132', name: 'Amulet of the Devout', type: 'neck', rarity: 'rare', stat_bonus: 5, description: 'Faith made tangible.' },
  { id: '133', name: 'Gauntlets of Flaming Fury', type: 'hands', rarity: 'rare', stat_bonus: 6, description: 'Warm to the touch. Very warm.' },
  { id: '134', name: 'Belt of Hill Giant Strength', type: 'waist', rarity: 'rare', stat_bonus: 6, description: 'Hills feel smaller now.' },
  { id: '135', name: 'Vambraces of the Fallen', type: 'arms', rarity: 'rare', stat_bonus: 5, description: 'Worn by someone who did not make it.' },

  // ── Epic ─────────────────────────────────────────────────────
  { id: '136', name: 'Mantle of Spell Resistance', type: 'cloak', rarity: 'epic', stat_bonus: 7, description: 'Magic slides off you like water.' },
  { id: '137', name: 'Helm of Brilliant Light', type: 'helmet', rarity: 'epic', stat_bonus: 7, description: 'Radiance that hurts to look at.' },
  { id: '138', name: 'Girdle of Stone Giant Strength', type: 'waist', rarity: 'epic', stat_bonus: 8, description: 'Stone bends before you.' },
  { id: '139', name: 'Ring of Regeneration', type: 'ring', rarity: 'epic', stat_bonus: 8, description: 'Wounds close on their own schedule.' },
  { id: '140', name: 'Boots of Teleportation', type: 'feet', rarity: 'epic', stat_bonus: 7, description: 'Here one moment. There the next.' },
  { id: '141', name: 'Gloves of the Artificer', type: 'hands', rarity: 'epic', stat_bonus: 7, description: 'Every tool responds to your touch.' },
  { id: '142', name: 'Amulet of the Planes', type: 'neck', rarity: 'epic', stat_bonus: 8, description: 'The planes are closer than they appear.' },
  { id: '143', name: 'Vambraces of the Warlord King', type: 'arms', rarity: 'epic', stat_bonus: 8, description: 'Armies have followed the bearer of these.' },
  { id: '144', name: 'Wristguards of the Arcane', type: 'wrist', rarity: 'epic', stat_bonus: 7, description: 'Spell energy crackles along the edges.' },
  { id: '145', name: 'Eyes of Charming', type: 'eyes', rarity: 'epic', stat_bonus: 7, description: 'They find you very persuasive.' },
  { id: '146', name: 'Ring of Free Action', type: 'ring', rarity: 'epic', stat_bonus: 7, description: 'Nothing slows you down.' },
  { id: '147', name: 'Cloak of Arachnida', type: 'cloak', rarity: 'epic', stat_bonus: 8, description: 'The spiders consider you one of their own.' },
  { id: '148', name: 'Boots of Striding and Springing', type: 'feet', rarity: 'epic', stat_bonus: 8, description: 'Cover ground fast. Very fast.' },
  { id: '149', name: 'Shield of the Sentinel', type: 'shield', rarity: 'epic', stat_bonus: 8, description: 'It has never let anyone through. Until now, possibly.' },
  { id: '150', name: 'Circlet of the Archdruid', type: 'helmet', rarity: 'epic', stat_bonus: 8, description: 'The wild recognizes your authority.' },
  { id: '151', name: 'Necklace of Prayer Beads', type: 'neck', rarity: 'epic', stat_bonus: 7, description: 'Each bead holds a blessing.' },
  { id: '152', name: 'Gauntlets of the Titan', type: 'hands', rarity: 'epic', stat_bonus: 9, description: 'Made for something larger than you.' },
  { id: '153', name: 'Belt of Fire Giant Strength', type: 'waist', rarity: 'epic', stat_bonus: 9, description: 'Fire giants are not known for subtlety.' },
  { id: '154', name: 'Vambraces of the Storm', type: 'arms', rarity: 'epic', stat_bonus: 7, description: 'Lightning traces the runes on every strike.' },
  { id: '155', name: 'Diadem of the Mage', type: 'helmet', rarity: 'epic', stat_bonus: 7, description: 'Power radiates from every facet.' },
  { id: '156', name: 'Boots of the Planar Walker', type: 'feet', rarity: 'epic', stat_bonus: 6, description: 'You have walked roads most cannot find.' },
  { id: '157', name: 'Ring of Shooting Stars', type: 'ring', rarity: 'epic', stat_bonus: 8, description: 'The stars answer to you now.' },
  { id: '158', name: 'Wristguards of the Giantslayer', type: 'wrist', rarity: 'epic', stat_bonus: 8, description: 'The name is not metaphorical.' },
  { id: '159', name: 'Lenses of the Comet', type: 'eyes', rarity: 'epic', stat_bonus: 8, description: 'You see things coming from very far away.' },
  { id: '160', name: 'Cloak of the Shadowmaster', type: 'cloak', rarity: 'epic', stat_bonus: 7, description: 'Even your shadow has a shadow.' },
  { id: '161', name: 'Aegis Shield', type: 'shield', rarity: 'epic', stat_bonus: 7, description: 'Ancient. Proven. Unyielding.' },
  { id: '162', name: 'Amulet of the Undying', type: 'neck', rarity: 'epic', stat_bonus: 8, description: 'Something keeps pulling you back.' },
  { id: '163', name: 'Gauntlets of the Warlord', type: 'hands', rarity: 'epic', stat_bonus: 7, description: 'Command presence starts at the hands.' },
  { id: '164', name: 'Belt of the Frost Giant', type: 'waist', rarity: 'epic', stat_bonus: 8, description: 'Cold as the north. Twice as dangerous.' },
  { id: '165', name: 'Vambraces of the Undying Champion', type: 'arms', rarity: 'epic', stat_bonus: 9, description: 'The champion fell. The arms remain.' },

  // ── Legendary ────────────────────────────────────────────────
  { id: '166', name: 'Cloak of Invisibility', type: 'cloak', rarity: 'legendary', stat_bonus: 10, description: 'You are not here.' },
  { id: '167', name: 'Helm of the Dragon', type: 'helmet', rarity: 'legendary', stat_bonus: 11, description: 'Dragonfire shaped this. Dragonfire fears it.' },
  { id: '168', name: 'Belt of Cloud Giant Strength', type: 'waist', rarity: 'legendary', stat_bonus: 11, description: 'The clouds are below you now.' },
  { id: '169', name: 'Ring of Djinni Summoning', type: 'ring', rarity: 'legendary', stat_bonus: 10, description: 'Three wishes. Choose carefully.' },
  { id: '170', name: 'Boots of the Void', type: 'feet', rarity: 'legendary', stat_bonus: 11, description: 'You leave no footprints. In anything.' },
  { id: '171', name: 'Gauntlets of the Overlord', type: 'hands', rarity: 'legendary', stat_bonus: 12, description: 'Armies knelt before whoever wore these last.' },
  { id: '172', name: 'Amulet of the Planes — Bound', type: 'neck', rarity: 'legendary', stat_bonus: 11, description: 'The planes do not merely open. They obey.' },
  { id: '173', name: 'Vambraces of the Lich', type: 'arms', rarity: 'legendary', stat_bonus: 11, description: 'Death wears these on Tuesdays.' },
  { id: '174', name: 'Wristguards of the Void', type: 'wrist', rarity: 'legendary', stat_bonus: 10, description: 'Between strikes, nothing exists.' },
  { id: '175', name: 'Eyes of the Dragon', type: 'eyes', rarity: 'legendary', stat_bonus: 11, description: 'See everything. Fear nothing.' },
  { id: '176', name: 'Ring of Three Wishes', type: 'ring', rarity: 'legendary', stat_bonus: 11, description: 'One has already been used. Maybe two.' },
  { id: '177', name: 'Cloak of the Archlich', type: 'cloak', rarity: 'legendary', stat_bonus: 11, description: 'Smells faintly of eternity.' },
  { id: '178', name: 'Boots of the Legends', type: 'feet', rarity: 'legendary', stat_bonus: 10, description: 'Bards have written songs about these boots.' },
  { id: '179', name: 'Bulwark of the Undying', type: 'shield', rarity: 'legendary', stat_bonus: 12, description: 'It has never been breached.' },
  { id: '180', name: 'Crown of the Warlord', type: 'helmet', rarity: 'legendary', stat_bonus: 12, description: 'Nations were built on the back of whoever wore this.' },
  { id: '181', name: 'Necklace of the Dragon Lord', type: 'neck', rarity: 'legendary', stat_bonus: 10, description: 'The dragons remember this. They are not pleased.' },
  { id: '182', name: 'Gauntlets of the Demigod', type: 'hands', rarity: 'legendary', stat_bonus: 11, description: 'Half divine. Fully dangerous.' },
  { id: '183', name: 'Belt of the Storm Giant', type: 'waist', rarity: 'legendary', stat_bonus: 12, description: 'The storm does not follow you. It obeys you.' },
  { id: '184', name: 'Vambraces of the Fallen God', type: 'arms', rarity: 'legendary', stat_bonus: 12, description: 'A god wore these. Once.' },
  { id: '185', name: 'Diadem of the Archlich', type: 'helmet', rarity: 'legendary', stat_bonus: 10, description: 'Absolute authority over the dead.' },
  { id: '186', name: 'Boots of the Eternal Chase', type: 'feet', rarity: 'legendary', stat_bonus: 12, description: 'You always catch what you pursue.' },
  { id: '187', name: 'Ring of the Archmage', type: 'ring', rarity: 'legendary', stat_bonus: 12, description: 'The tower recognizes the ring. Not you.' },
  { id: '188', name: 'Wristguards of the Dragon', type: 'wrist', rarity: 'legendary', stat_bonus: 11, description: 'Forged from a dragon\'s dying breath.' },
  { id: '189', name: 'Lenses of True Sight', type: 'eyes', rarity: 'legendary', stat_bonus: 12, description: 'Nothing is hidden from you. Nothing.' },
  { id: '190', name: 'Cloak of the Archmage', type: 'cloak', rarity: 'legendary', stat_bonus: 12, description: 'The tower is empty. The cloak remains.' },
  { id: '191', name: 'Aegis of the Eternal', type: 'shield', rarity: 'legendary', stat_bonus: 11, description: 'It predates the kingdom it protected.' },
  { id: '192', name: 'Amulet of the Lich King', type: 'neck', rarity: 'legendary', stat_bonus: 12, description: 'Zulkir Jax is looking for this.' },
  { id: '193', name: 'Gauntlets of the Void', type: 'hands', rarity: 'legendary', stat_bonus: 13, description: 'Between strikes, nothing exists.' },
  { id: '194', name: 'Belt of the Titan', type: 'waist', rarity: 'legendary', stat_bonus: 13, description: 'Titans are no longer common. This is why.' },
  { id: '195', name: 'Vambraces of the Dread Knight', type: 'arms', rarity: 'legendary', stat_bonus: 13, description: 'The Dread Knight fell. The arms did not.' },

  // ── Mythic ───────────────────────────────────────────────────
  { id: '196', name: 'Cloak of the Outer Dark', type: 'cloak', rarity: 'mythic', stat_bonus: 14, description: 'The void peers through it. Back at you.' },
  { id: '197', name: 'Helm of Absolute Authority', type: 'helmet', rarity: 'mythic', stat_bonus: 15, description: 'The gods notice when you wear this.' },
  { id: '198', name: 'Belt of Titanic Strength', type: 'waist', rarity: 'mythic', stat_bonus: 16, description: 'The word "impossible" no longer applies.' },
  { id: '199', name: 'Ring of the Wish Eternal', type: 'ring', rarity: 'mythic', stat_bonus: 15, description: 'It grants what it wants to grant. Mostly what you want.' },
  { id: '200', name: 'Boots of the Godwalker', type: 'feet', rarity: 'mythic', stat_bonus: 15, description: 'Gods walk paths mortals cannot see. Now you can.' },
  { id: '201', name: 'Gauntlets of the World Breaker', type: 'hands', rarity: 'mythic', stat_bonus: 17, description: 'The name is a warning.' },
  { id: '202', name: 'Amulet of the First Gods', type: 'neck', rarity: 'mythic', stat_bonus: 16, description: 'Older than the pantheon currently in charge.' },
  { id: '203', name: 'Vambraces of the Primordial', type: 'arms', rarity: 'mythic', stat_bonus: 16, description: 'Before gods. Before mortals. This.' },
  { id: '204', name: 'Wristguards of the Void Eternal', type: 'wrist', rarity: 'mythic', stat_bonus: 15, description: 'The void does not end. Neither does this protection.' },
  { id: '205', name: 'Eyes of the Overgod', type: 'eyes', rarity: 'mythic', stat_bonus: 16, description: 'Ao sees everything. So do you now.' },
  { id: '206', name: 'Ring of Absolute Power', type: 'ring', rarity: 'mythic', stat_bonus: 16, description: 'Power recognizes power.' },
  { id: '207', name: 'Cloak of the Dread Eternal', type: 'cloak', rarity: 'mythic', stat_bonus: 15, description: 'Eternity wears a cloak. This is it.' },
  { id: '208', name: 'Boots of the World Wanderer', type: 'feet', rarity: 'mythic', stat_bonus: 14, description: 'Every road. Every plane. Every world.' },
  { id: '209', name: 'Shield of the Eternal Bastion', type: 'shield', rarity: 'mythic', stat_bonus: 17, description: 'It has never failed. It will not start now.' },
  { id: '210', name: 'Crown of the Overgod', type: 'helmet', rarity: 'mythic', stat_bonus: 16, description: 'Ao is going to want this back.' },
  { id: '211', name: 'Necklace of the World Soul', type: 'neck', rarity: 'mythic', stat_bonus: 15, description: 'The world knows you wear this. It approves.' },
  { id: '212', name: 'Gauntlets of the Primordial Titan', type: 'hands', rarity: 'mythic', stat_bonus: 16, description: 'Primordial titans are extinct. Possibly because of these.' },
  { id: '213', name: 'Belt of the World Breaker', type: 'waist', rarity: 'mythic', stat_bonus: 17, description: 'The world has not broken yet. Encourage that trend.' },
  { id: '214', name: 'Vambraces of the Eternal War', type: 'arms', rarity: 'mythic', stat_bonus: 17, description: 'The war never ended. It just moved.' },
  { id: '215', name: 'Diadem of the Overgod', type: 'helmet', rarity: 'mythic', stat_bonus: 15, description: 'Authority absolute. Responsibility unclear.' },
  { id: '216', name: 'Boots of the Infinite Road', type: 'feet', rarity: 'mythic', stat_bonus: 16, description: 'The road goes on. So do you.' },
  { id: '217', name: 'Ring of the Overgod', type: 'ring', rarity: 'mythic', stat_bonus: 17, description: 'Ao is definitely going to want this back.' },
  { id: '218', name: 'Wristguards of the Primordial', type: 'wrist', rarity: 'mythic', stat_bonus: 16, description: 'Before the first war. Still standing.' },
  { id: '219', name: 'Eyes of the Void', type: 'eyes', rarity: 'mythic', stat_bonus: 15, description: 'The void looks back. You look first.' },
  { id: '220', name: 'Cloak of the World Soul', type: 'cloak', rarity: 'mythic', stat_bonus: 16, description: 'The world wraps around you. Literally.' },
  { id: '221', name: 'Aegis of the First Age', type: 'shield', rarity: 'mythic', stat_bonus: 16, description: 'The first age ended. This survived it.' },
  { id: '222', name: 'Amulet of the World Tree', type: 'neck', rarity: 'mythic', stat_bonus: 17, description: 'Yggdrasil remembers the one who wore this.' },
  { id: '223', name: 'Gauntlets of the Eternal Champion', type: 'hands', rarity: 'mythic', stat_bonus: 18, description: 'The champion is eternal. So is the burden.' },
  { id: '224', name: 'Belt of the Eternal Conqueror', type: 'waist', rarity: 'mythic', stat_bonus: 18, description: 'Nothing stands before you. Nothing ever has.' },
  { id: '225', name: 'Vambraces of the World Breaker', type: 'arms', rarity: 'mythic', stat_bonus: 18, description: 'The last thing standing after everything else falls.' },
]

export function rollRarity(): string {
  const roll = d100()
  if (roll <= 1) return 'mythic'
  if (roll <= 3) return 'legendary'
  if (roll <= 8) return 'epic'
  if (roll <= 15) return 'rare'
  if (roll <= 40) return 'uncommon'
  return 'common'
}

export function rollLoot(): Item {
  const rarity = rollRarity()
  const pool = LOOT_TABLES.filter(i => i.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function rollLootByRarity(rarity: string): Item {
  const pool = LOOT_TABLES.filter(i => i.rarity === rarity && i.type !== 'potion')
  return pool[Math.floor(Math.random() * pool.length)]
}

export function shouldDropLoot(lootChance: number): boolean {
  return d100() <= lootChance
}
const fs = require('fs');
const path = require('path');

const NEW_MONSTERS = [
  {
    name: 'Stirge',
    symbol: 's',
    color: '#8b0000',
    base_hp: 5,
    xp_reward: 200,
    damage_dice: '1d4-2',
    initiative_bonus: 4,
    armor_class: 16,
    attack_bonus: 7,
    challenge_rating: 0.5,
    solo_level: 1,
    spawn_weight: 12,
    habitat: '["S", "F"]',
    movement_type: 'FLY',
    special_abilities: '["blood_drain", "attached"]',
    image_slug: 'stirge',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Stirge',
    creature_type: 'Magical Beast',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'SWAMP', is_primary: 1 },
      { name: 'FOREST', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A high-pitched, droning buzz vibrates through the stagnant air as a cluster of needle-beaked shapes dart between shadows.",
      "2_ranger_distant": "Punctured, bloodless animal carcasses hang drained in the reeds; voracious winged parasites are seeking fresh warm blood.",
      "3_close": "A grotesque, winged fiend with the bloated abdomen of a mosquito, leathery bat wings, and a razor-sharp four-inch proboscis.",
      "4_ranger_close": "Its flight is erratic but blindingly swift; crush it with a direct strike before its barbed needle sinks into your flesh.",
      "5_health_100": "The winged horror hovers with rapid, frantic wingbeats, aligning its vicious needle-proboscis with your throat.",
      "6_health_75": "Shattered wing membranes flutter erratically as the creature emits shrill, furious buzzing.",
      "7_health_50": "Punctured and leaking acrid yellow fluid, the parasite struggles to maintain altitude but dives with bloodlust.",
      "8_health_25": "With its abdomen ruptured and legs twitching, the dying parasite makes a desperate, blind lunging buzz.",
      "9_dead": "The needle-nosed horror lies crushed in the mud, its swollen sac deflated and ruined."
    }
  },
  {
    name: 'Dire Rat',
    symbol: 'r',
    color: '#5c4033',
    base_hp: 5,
    xp_reward: 135,
    damage_dice: '1d4',
    initiative_bonus: 3,
    armor_class: 14,
    attack_bonus: 1,
    challenge_rating: 0.33,
    solo_level: 1,
    spawn_weight: 15,
    habitat: '["U", "T", "S"]',
    movement_type: 'WALK',
    special_abilities: '["disease", "low_light_vision", "scent"]',
    image_slug: 'dire_rat',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Dire%20Rat',
    creature_type: 'Animal',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'CITY', is_primary: 0 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "Wet scraping claws and the pungent, repulsive stench of rotting waste emanate from a nearby culvert.",
      "2_ranger_distant": "Gnawed marrow bones and wide claw marks indicate an overgrown filth-dweller scavenging aggressively in the gloom.",
      "3_close": "A three-foot rodent bristling with greasy coarse fur, covered in weeping scabs, bearing elongated yellow incisors that drip foul saliva.",
      "4_ranger_close": "Its jaws carry grave sepsis; strike cleanly and keep distance to prevent its filthy teeth from grazing bare skin.",
      "5_health_100": "The massive rodent bares curved incisors, chittering aggressively with beady red eyes fixed upon you.",
      "6_health_75": "A deep gash parts its diseased pelt, evoking a shrill defensive squeak as it circles closer to the ground.",
      "7_health_50": "Trailing blood over the cobblestones, the rodent snarls through broken teeth, backed into a corner.",
      "8_health_25": "Panting and dragging its hind legs, the feral vermin snaps blindly in a panic.",
      "9_dead": "The overgrown rodent lies still in a pool of dark blood, its rancid stench beginning to fade."
    }
  },
  {
    name: 'Viper',
    symbol: 'v',
    color: '#2e8b57',
    base_hp: 6,
    xp_reward: 200,
    damage_dice: '1d2-2',
    initiative_bonus: 3,
    armor_class: 14,
    attack_bonus: 5,
    challenge_rating: 0.5,
    solo_level: 1,
    spawn_weight: 12,
    habitat: '["F", "J", "S"]',
    movement_type: 'WALK',
    special_abilities: '["poison", "scent", "low_light_vision"]',
    image_slug: 'viper',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Viper',
    creature_type: 'Animal',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'FOREST', is_primary: 1 },
      { name: 'JUNGLE', is_primary: 0 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A dry, continuous rustling slithers through dead leaves accompanied by a warning hiss barely louder than the wind.",
      "2_ranger_distant": "An undulating trail through the detritus reveals a venomous serpent lying coiled in wait beside the path.",
      "3_close": "A thick-bodied serpent with iridescent green-black scales and a wide triangular head, testing the air with a flickering black tongue.",
      "4_ranger_close": "It coils tightly to strike up to half its length; step just out of range before cleaving its neck.",
      "5_health_100": "The serpent coils like a steel spring, hood flaring slightly as venom glistens upon needle-like fangs.",
      "6_health_75": "A cleave shears along its scales; the snake thrashes violently, recoiling into a tighter striking posture.",
      "7_health_50": "Severely wounded and bleeding onto the loam, its strikes become wild and erratic.",
      "8_health_25": "Barely able to raise its head from the dirt, the dying reptile hisses faintly with clouded eyes.",
      "9_dead": "The serpent stretches out limp and lifeless across the leaves, severed cleanly."
    }
  },
  {
    name: 'Giant Centipede',
    symbol: 'c',
    color: '#d2691e',
    base_hp: 4,
    xp_reward: 200,
    damage_dice: '1d6-1',
    initiative_bonus: 2,
    armor_class: 14,
    attack_bonus: 2,
    challenge_rating: 0.5,
    solo_level: 1,
    spawn_weight: 14,
    habitat: '["U", "F", "H"]',
    movement_type: 'CLIMB',
    special_abilities: '["poison", "darkvision"]',
    image_slug: 'giant_centipede',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Centipede',
    creature_type: 'Vermin',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'FOREST', is_primary: 0 },
      { name: 'HILLS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A rhythmic, unsettling clatter of scores of chitinous legs tapping across cracked masonry echoes from the darkness.",
      "2_ranger_distant": "Acidic trails and shed segments of brown carapace mark the hunting path of an overgrown subterranean crawler.",
      "3_close": "A six-foot-long segmented terror with rust-colored chitin plates and flexing venomous pincers framing a ravenous maw.",
      "4_ranger_close": "Its belly plates are thinner than its armored dorsal ridge; wait for it to rear up before delivering a fatal blow.",
      "5_health_100": "The segmented horror undulates with eerie speed, snapping hollow mandibles coated in paralytic venom.",
      "6_health_75": "A row of shattered legs drops to the stone, causing the beast to wobble and writhe in fury.",
      "7_health_50": "Its carapace is cracked wide open, oozing green hemolymph as it thrashes blindly.",
      "8_health_25": "Twitching feebly on its back, the crippled crawler snaps its jaws without strength.",
      "9_dead": "The massive segmented carcass curls into a brittle spiral, completely motionless."
    }
  },
  {
    name: 'Iron Cobra',
    symbol: 'C',
    color: '#708090',
    base_hp: 15,
    xp_reward: 600,
    damage_dice: '1d6+1',
    initiative_bonus: 3,
    armor_class: 17,
    attack_bonus: 3,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 8,
    habitat: '["U"]',
    movement_type: 'WALK',
    special_abilities: '["poison", "construct_traits", "damage_reduction"]',
    image_slug: 'iron_cobra',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Iron%20Cobra',
    creature_type: 'Construct',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 }
    ],
    descriptions: {
      "1_distant": "A cold, metallic scraping rhythmically glides over stone; no breathing or heartbeat accompanies the metallic sliding.",
      "2_ranger_distant": "Polished scratches upon ancient flagstones indicate an unliving clockwork construct patrolling on eternal guard.",
      "3_close": "An articulated automaton crafted from dark interlocking iron plates, shaped like an iron snake with glowing ruby optical lenses.",
      "4_ranger_close": "Constructed without flesh or organs; blunt concussive force or heavy blade strikes to its joints will disable its mechanism.",
      "5_health_100": "The iron serpent rears up smoothly on oiled gears, cold steel fangs poised to inject alchemical toxin.",
      "6_health_75": "Sparks shower from dented iron segments as internal gears grind and screech under the impact.",
      "7_health_50": "Fractured steel plating exposes humming alchemical conduits; its mechanical strikes lose precision.",
      "8_health_25": "Its optical gems flicker and die as ruptured clockwork springs burst from its dented frame.",
      "9_dead": "The metal construct collapses into a tangle of inert gears, springs, and dented iron bands."
    }
  },
  {
    name: 'Skeletal Champion',
    symbol: 'S',
    color: '#e6e6fa',
    base_hp: 17,
    xp_reward: 600,
    damage_dice: '1d8+3',
    initiative_bonus: 5,
    armor_class: 21,
    attack_bonus: 7,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 8,
    habitat: '["U", "M"]',
    movement_type: 'WALK',
    special_abilities: '["undead_traits", "weapon_mastery", "damage_reduction"]',
    image_slug: 'skeletal_champion',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Skeletal%20Champion',
    creature_type: 'Undead',
    creature_subtype: null,
    treasure_type: 'Standard',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'MOUNTAINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "The disciplined, heavy clank of blackened mail and the measured tread of an experienced warrior echo from the catacombs.",
      "2_ranger_distant": "Unlike mindless animated bones, this shadow marches with the deliberate posture of a seasoned battlefield commander.",
      "3_close": "A grim undead warrior wrapped in rusted breastplate, clutching a notched longsword and steel shield with hateful intelligence in its hollow sockets.",
      "4_ranger_close": "It retains martial reflexes from life and parries with skill; blunt weapon impact will shatter its ancient marrow.",
      "5_health_100": "The skeletal warrior assumes a flawless high guard, eyes burning with twin points of malevolent crimson sorcery.",
      "6_health_75": "A blow cracks its breastplate, but the undead knight retaliates instantly with cold, calculating precision.",
      "7_health_50": "Splintered ribs and shattered shoulder bones shake, yet its blade continues to thrust with tireless hatred.",
      "8_health_25": "Shield arm severed and skull fractured, the ancient warrior staggers but refuses to relent.",
      "9_dead": "The veteran skeleton shatters into inert bleached bone and rusted scrap, the crimson soul-fire extinguishing."
    }
  },
  {
    name: 'Blink Dog',
    symbol: 'd',
    color: '#d4af37',
    base_hp: 22,
    xp_reward: 600,
    damage_dice: '1d6+1',
    initiative_bonus: 7,
    armor_class: 14,
    attack_bonus: 4,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 9,
    habitat: '["P", "F"]',
    movement_type: 'WALK',
    special_abilities: '["blink", "teleport", "scent"]',
    image_slug: 'blink_dog',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Blink%20Dog',
    creature_type: 'Magical Beast',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'PLAINS', is_primary: 1 },
      { name: 'FOREST', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "Sudden sharp barking sounds echo across the grass, popping in and out of earshot from impossible angles in an instant.",
      "2_ranger_distant": "Distorted patches of flattened grass appear without connected tracks; a spatial phase predator is hunting nearby.",
      "3_close": "A sleek, intelligent hound with short golden-brown fur and large pointed ears, shifting erratically in and out of the material plane.",
      "4_ranger_close": "It vanishes and reappears behind targets before striking; prepare to pivot immediately as its spatial displacement cracks.",
      "5_health_100": "The supernatural hound stands at the ready, crackling with subtle blue dimensional static along its spine.",
      "6_health_75": "Blood marks its flank as it flickers out of sight, reappearing a few paces away with a sharp defensive yelp.",
      "7_health_50": "Its spatial jumping grows strained and laggy; wounds bleed freely onto the trampled grass.",
      "8_health_25": "Unable to sustain its phasing magic, the wounded hound limps heavily with flattened ears.",
      "9_dead": "The golden hound lies motionless upon the sod, the faint dimensional static humming to silence."
    }
  },
  {
    name: 'Duergar',
    symbol: 'd',
    color: '#4a5568',
    base_hp: 6,
    xp_reward: 135,
    damage_dice: '1d8+1',
    initiative_bonus: -1,
    armor_class: 18,
    attack_bonus: 3,
    challenge_rating: 0.33,
    solo_level: 1,
    spawn_weight: 15,
    habitat: '["U", "M"]',
    movement_type: 'WALK',
    special_abilities: '["enlarge_person", "invisibility", "darkvision"]',
    image_slug: 'duergar',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Duergar',
    creature_type: 'Humanoid',
    creature_subtype: 'duergar',
    treasure_type: 'NPC Gear',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'MOUNTAINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A low, guttural curse in dwarven cadence reverberates from the subterranean stone, followed by the clinking of chain links.",
      "2_ranger_distant": "Square-toed heavy bootprints and ash residue reveal a gray-skinned subterranean slaver scouting ahead.",
      "3_close": "A grim, stocky gray-skinned dwarf with stark white hair and callous eyes, gripping a steel warhammer and tower shield.",
      "4_ranger_close": "Deep subterranean dwarves are resistant to magic and poison; rely on superior reach and tactical footwork.",
      "5_health_100": "The grim gray dwarf stands immovable as granite, muttering curses as his knuckles whiten on his hammer shaft.",
      "6_health_75": "A blow dents his iron pauldrons; he spits dark blood and readies a punishing counterswing.",
      "7_health_50": "Grievously wounded across his chest, the stout warrior groans with stubborn defiance, refusing to surrender.",
      "8_health_25": "Falling to one knee, the gray dwarf glares with unbridled malice, weapon trembling in numb hands.",
      "9_dead": "The stout gray-skinned raider falls heavily against the bedrock, stone hammer slipping from limp fingers."
    }
  },
  {
    name: 'Drow',
    symbol: 'e',
    color: '#6b46c1',
    base_hp: 5,
    xp_reward: 135,
    damage_dice: '1d6',
    initiative_bonus: 2,
    armor_class: 15,
    attack_bonus: 2,
    challenge_rating: 0.33,
    solo_level: 1,
    spawn_weight: 15,
    habitat: '["U"]',
    movement_type: 'WALK',
    special_abilities: '["spell_resistance", "poison", "darkvision"]',
    image_slug: 'drow',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Drow',
    creature_type: 'Humanoid',
    creature_subtype: 'drow',
    treasure_type: 'NPC Gear',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 }
    ],
    descriptions: {
      "1_distant": "A whisper of silk moving against stone and the faint aroma of nightshade drift softly through the cavern corridor.",
      "2_ranger_distant": "Poisoned crossbow bolts resting in a hidden groove betray an ambush set by subterranean elven raiders.",
      "3_close": "A slender elven scout with obsidian-black skin, snow-white hair, and pale lilac eyes, leveling a poisoned hand crossbow and rapier.",
      "4_ranger_close": "They possess innate spell resistance and poison-tipped steel; parry swiftly and close distance inside their weapon reach.",
      "5_health_100": "The dark elf smiles with haughty cruelty, rapier blade poised like a striking viper.",
      "6_health_75": "A crimson line cuts across dark leather; the dark elf's smirk vanishes, replaced by cold calculating focus.",
      "7_health_50": "Bleeding and breathing hard, the subterranean elf retreats gracefully, searching for shadows to slip into.",
      "8_health_25": "Staggering against the wall with rapier lowered, the dying scout glares with aristocratic contempt.",
      "9_dead": "The obsidian-skinned elf collapses gracefully onto the stone, white hair stained with dark blood."
    }
  },
  {
    name: 'Orc',
    symbol: 'o',
    color: '#276749',
    base_hp: 6,
    xp_reward: 135,
    damage_dice: '2d4+4',
    initiative_bonus: 0,
    armor_class: 13,
    attack_bonus: 5,
    challenge_rating: 0.33,
    solo_level: 1,
    spawn_weight: 15,
    habitat: '["H", "M", "P"]',
    movement_type: 'WALK',
    special_abilities: '["ferocity", "darkvision", "weapon_familiarity"]',
    image_slug: 'orc',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Orc',
    creature_type: 'Humanoid',
    creature_subtype: 'orc',
    treasure_type: 'NPC Gear',
    terrains: [
      { name: 'HILLS', is_primary: 1 },
      { name: 'MOUNTAINS', is_primary: 0 },
      { name: 'PLAINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "Guttural war-shouts and the thunder of iron-shod boots over rocky soil echo from just beyond the ridge.",
      "2_ranger_distant": "Crushed brush and heavy cleaver chops into tree bark show brutal savage raiders advancing in numbers.",
      "3_close": "A hulking, gray-green brute with protruding boar-like tusks, piggish red eyes, and a massive jagged falchion.",
      "4_ranger_close": "They fight with feral ferocity even after sustaining mortal wounds; finish the strike cleanly without lowering guard.",
      "5_health_100": "The brutal marauder roars an ear-splitting battle cry, raising his heavy jagged blade with both hands.",
      "6_health_75": "A deep cut opens his torso, yet blood only fans his berserk frenzy as he swings harder.",
      "7_health_50": "Gravely wounded and frothing at the mouth, his feral rage keeps him charging through mortal agony.",
      "8_health_25": "Coughing dark blood through broken tusks, the savage fighter stumbles forward on sheer spite.",
      "9_dead": "The heavy brute crashes facedown into the dirt, his brutal weapon clattering over the stones."
    }
  },
  {
    name: 'Wight',
    symbol: 'W',
    color: '#4a5568',
    base_hp: 26,
    xp_reward: 800,
    damage_dice: '1d4+1',
    initiative_bonus: 1,
    armor_class: 15,
    attack_bonus: 4,
    challenge_rating: 3.0,
    solo_level: 3,
    spawn_weight: 7,
    habitat: '["U", "S"]',
    movement_type: 'WALK',
    special_abilities: '["energy_drain", "create_spawn", "undead_traits"]',
    image_slug: 'wight',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wight',
    creature_type: 'Undead',
    creature_subtype: null,
    treasure_type: 'Incidental',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A deathly frost chills the surrounding air, accompanied by the desiccated whisper of ancient burial shrouds dragging across stone.",
      "2_ranger_distant": "Withered vegetation and a lingering tomb-scent point to a barrow-spawn that drains vitality from the living.",
      "3_close": "A mummified corpse with taut leathery skin stretched over withered sinew, glowing with malevolent hateful lights in sunken eye sockets.",
      "4_ranger_close": "Its touch leeches the soul itself; avoid direct contact with its clawed hands and strike with sacred force.",
      "5_health_100": "The barrow-dweller hisses with unholy hunger, reaching forward with long, blackened necrotic talons.",
      "6_health_75": "A weapon blow fractures its dried ribs, releasing a puff of ancient tomb dust and foul vapors.",
      "7_health_50": "Its leathery flesh hangs in tatters, yet the unliving abomination lunges forward undeterred.",
      "8_health_25": "With its limbs cracked and eye-fires dimming, the cursed creature claws frantically in desperation.",
      "9_dead": "The necrotic soul collapses into dust and withered husk, its dark curse returning to the earth."
    }
  },
  {
    name: 'Harpy',
    symbol: 'H',
    color: '#c53030',
    base_hp: 38,
    xp_reward: 1200,
    damage_dice: '1d6+1',
    initiative_bonus: 2,
    armor_class: 16,
    attack_bonus: 8,
    challenge_rating: 4.0,
    solo_level: 4,
    spawn_weight: 6,
    habitat: '["M", "C", "H"]',
    movement_type: 'FLY',
    special_abilities: '["captivating_song", "flight"]',
    image_slug: 'harpy',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Harpy',
    creature_type: 'Monstrous Humanoid',
    creature_subtype: null,
    treasure_type: 'Standard',
    terrains: [
      { name: 'MOUNTAINS', is_primary: 1 },
      { name: 'COAST', is_primary: 0 },
      { name: 'HILLS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "An eerie, haunting melody wafts through the mountain crags, seductive and unnerving against the howling wind.",
      "2_ranger_distant": "Bleached humanoid bones scattered beneath high rocky perches reveal the nest of a winged mountain predator.",
      "3_close": "A hideous creature with the torso and face of a feral crone, the filthy feathered wings of a vulture, and deadly curved talons.",
      "4_ranger_close": "Its voice enchants unwary travelers; steel your resolve against its call and bring it down while it circles airborne.",
      "5_health_100": "The winged horror shrieks a discordant note, banking sharply overhead with talons flexed for an aerial rake.",
      "6_health_75": "Arrow wounds and cut feathers scatter in the breeze; the crone screeches in pain and climbs higher.",
      "7_health_50": "Bleeding from a sheared wing, its flight wobbles noticeably as it attempts a desperate diving claw swipe.",
      "8_health_25": "Grounded and coughing blood, the repulsive bird-woman snaps its beak and talons wildly from the rocks.",
      "9_dead": "The crone lies broken upon the crags, matted feathers soaked in black blood."
    }
  },
  {
    name: 'Doppelganger',
    symbol: 'D',
    color: '#a0aec0',
    base_hp: 26,
    xp_reward: 800,
    damage_dice: '1d8+1',
    initiative_bonus: 3,
    armor_class: 16,
    attack_bonus: 6,
    challenge_rating: 3.0,
    solo_level: 3,
    spawn_weight: 7,
    habitat: '["U", "T"]',
    movement_type: 'WALK',
    special_abilities: '["change_shape", "detect_thoughts", "mimicry"]',
    image_slug: 'doppelganger',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Doppelganger',
    creature_type: 'Monstrous Humanoid',
    creature_subtype: 'shapechanger',
    treasure_type: 'Double',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'CITY', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A sudden footstep falters ahead; a lone silhouette shifts unnaturally against the dim masonry, blurring at the edges.",
      "2_ranger_distant": "Tracks on the flagstones abruptly shift gait, stride length, and weight distribution; a shapeshifter is watching.",
      "3_close": "A hairless, gray-skinned humanoid with melting, featureless facial contours and yellow cat-like eyes, shifting between forms.",
      "4_ranger_close": "Its rubbery hide absorbs blows easily, but steady, relentless assault disrupts its concentration and form.",
      "5_health_100": "The shapechanger assumes an aggressive stance, its gray fists hardening into dense, club-like bone.",
      "6_health_75": "A wound opens gray fluid beneath its flesh, momentarily revealing chaotic shifting tissue.",
      "7_health_50": "Pushed to its limits, its features melt frantically into grimaces of agony as it reels backward.",
      "8_health_25": "Collapsing against the stone, its disguise shatters completely into a formless gray puddle of tissue.",
      "9_dead": "The creature lies dead in its true form, an unblemished gray corpse without identity."
    }
  },
  {
    name: 'Griffon',
    symbol: 'G',
    color: '#b7791f',
    base_hp: 42,
    xp_reward: 1200,
    damage_dice: '1d6+3',
    initiative_bonus: 2,
    armor_class: 17,
    attack_bonus: 8,
    challenge_rating: 4.0,
    solo_level: 4,
    spawn_weight: 6,
    habitat: '["H", "M"]',
    movement_type: 'FLY',
    special_abilities: '["pounce", "scent", "flight"]',
    image_slug: 'griffon',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Griffon',
    creature_type: 'Magical Beast',
    creature_subtype: null,
    treasure_type: 'Incidental',
    terrains: [
      { name: 'HILLS', is_primary: 1 },
      { name: 'MOUNTAINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A massive shadow sweeps across the rocky hilltops as a piercing, raptor-like screech echoes from above.",
      "2_ranger_distant": "Large four-toed talon marks beside lion paw prints on high overlooks reveal a noble apex aerial predator.",
      "3_close": "A majestic beast combining the forequarters, wings, and head of a giant eagle with the hindquarters and tawny tail of a lion.",
      "4_ranger_close": "It uses aerial momentum to pounce and tear with multiple claws; ground it with missile fire before engaging up close.",
      "5_health_100": "The winged predator screeches with royal ferocity, snapping its razor beak and spreading eight-foot wings.",
      "6_health_75": "Golden feathers and lion fur fly as a solid blow lands; the beast thrashes its tail in mounting fury.",
      "7_health_50": "Bleeding from torn flanks, the great chimera roars hoarsely and flaps its wings to keep distance.",
      "8_health_25": "Its regal posture broken, the dying beast pants heavily on trembling foreclaws, beak dripping blood.",
      "9_dead": "The magnificent beast crashes onto the turf, regal plumage stained crimson in final defeat."
    }
  },
  {
    name: 'Giant Scorpion',
    symbol: 's',
    color: '#744210',
    base_hp: 37,
    xp_reward: 800,
    damage_dice: '1d6+3',
    initiative_bonus: 0,
    armor_class: 16,
    attack_bonus: 6,
    challenge_rating: 3.0,
    solo_level: 3,
    spawn_weight: 7,
    habitat: '["D", "P", "U"]',
    movement_type: 'WALK',
    special_abilities: '["constrict", "grab", "poison"]',
    image_slug: 'giant_scorpion',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Scorpion',
    creature_type: 'Vermin',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'DESERT', is_primary: 1 },
      { name: 'PLAINS', is_primary: 0 },
      { name: 'UNDERGROUND_RUINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "The dry scrape of heavy claws against stone and the rhythmic tapping of armored chitin break the silence.",
      "2_ranger_distant": "Deep twin trenches in the sand where heavy pincers dragged prey indicate an armored arachnid lurks nearby.",
      "3_close": "A nine-foot armored monstrosity covered in dull black chitin, wielding two crushing pincers and an arched venomous stinger.",
      "4_ranger_close": "Do not allow its pincers to close; sever its tail joint to neutralize its lethal venom.",
      "5_health_100": "The armored arachnid raises twin crushing claws, curved tail arched high with venom beading upon the stinger.",
      "6_health_75": "A cleave chips its dense carapace, causing the beast to snap its massive pincers in violent reflex.",
      "7_health_50": "Thick yellow ichor leaks from fractured shell plates as its strikes grow sluggish.",
      "8_health_25": "With its stinger trailing limp in the dirt, the battered arachnid twitches frantically on failing legs.",
      "9_dead": "The massive scorpion collapses onto the sand, heavy claws curling inward in death."
    }
  },
  {
    name: 'Cloaker',
    symbol: 'C',
    color: '#1a202c',
    base_hp: 51,
    xp_reward: 1600,
    damage_dice: '1d6+5',
    initiative_bonus: 8,
    armor_class: 19,
    attack_bonus: 8,
    challenge_rating: 5.0,
    solo_level: 5,
    spawn_weight: 5,
    habitat: '["U"]',
    movement_type: 'FLY',
    special_abilities: '["infrasound", "engulf", "shadow_shift"]',
    image_slug: 'cloaker',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Cloaker',
    creature_type: 'Aberration',
    creature_subtype: null,
    treasure_type: 'Standard',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 }
    ],
    descriptions: {
      "1_distant": "A low, nauseating drone vibrates the marrow of your bones as shadows detach softly from the subterranean vault ceiling.",
      "2_ranger_distant": "A dark drape hanging motionless against the ceiling exhibits unnatural muscle tremors; an engulfing aberration awaits.",
      "3_close": "A bizarre flying manta-like aberration resembling a tattered black cloak, lined with needle-teeth, clawed clasps, and a whip-tail.",
      "4_ranger_close": "Its sonic moan disorients the senses; keep moving and strike at its central nerve cluster before it engulfs you.",
      "5_health_100": "The shadowy cloak flaps silently through the darkness, unfurling rows of jagged ivory teeth.",
      "6_health_75": "Torn leathery hide flaps erratically as the creature emits a disorienting, high-pitched screech.",
      "7_health_50": "Severely slashed across its underside, dark alien bile spills as its tail lashes with desperation.",
      "8_health_25": "Grounded and spasming, the aberrant ray flaps its tattered wings in a pathetic attempt to lift off.",
      "9_dead": "The dark leathery membrane lies spread flat and inert across the stone, dead as a discarded burial shroud."
    }
  },
  {
    name: 'Phase Spider',
    symbol: 'S',
    color: '#4c51bf',
    base_hp: 51,
    xp_reward: 1600,
    damage_dice: '2d6+7',
    initiative_bonus: 7,
    armor_class: 17,
    attack_bonus: 10,
    challenge_rating: 5.0,
    solo_level: 5,
    spawn_weight: 5,
    habitat: '["U", "X"]',
    movement_type: 'CLIMB',
    special_abilities: '["ethereal_jaunt", "poison", "climb"]',
    image_slug: 'phase_spider',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Phase%20Spider',
    creature_type: 'Magical Beast',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'EXTRAPLANAR', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "Faint blue shimmering light dances in empty air, accompanied by the ethereal rustle of spectral spider silk.",
      "2_ranger_distant": "Ghostly webs that fade in and out of the material plane indicate an ethereal arachnid stalking from between dimensions.",
      "3_close": "An eight-foot spider with a grotesque human-like face, pale blue-white carapace, and fangs dripping virulent spatial poison.",
      "4_ranger_close": "It steps into the ethereal plane between lunges; hold your attack until it materializes to sink its fangs.",
      "5_health_100": "The dimensional arachnid phases into solid reality, mandibles dripping with glistening venom.",
      "6_health_75": "A solid blow shears its carapace; it flickers into translucency for an instant before snapping back.",
      "7_health_50": "Ichor oozes from damaged joints as its planar shifting flickers uncontrollably.",
      "8_health_25": "Pinned to physical reality by catastrophic trauma, the spider curls its eight legs in agony.",
      "9_dead": "The pale blue horror lies lifeless upon the floor, completely anchored to the mortal plane."
    }
  },
  {
    name: 'Wraith',
    symbol: 'W',
    color: '#2d3748',
    base_hp: 47,
    xp_reward: 1600,
    damage_dice: '1d6',
    initiative_bonus: 7,
    armor_class: 18,
    attack_bonus: 6,
    challenge_rating: 5.0,
    solo_level: 5,
    spawn_weight: 5,
    habitat: '["U", "S"]',
    movement_type: 'FLY',
    special_abilities: '["constitution_drain", "incorporeal", "undead_traits", "sunlight_powerlessness"]',
    image_slug: 'wraith',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wraith',
    creature_type: 'Undead',
    creature_subtype: 'incorporeal',
    treasure_type: 'Incidental',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "An unnatural draft chills the air to freezing, extinguishing nearby torch flames into thin wisps of smoke.",
      "2_ranger_distant": "Frost crystallizes across solid stone while faint wailing echoes from the walls; an incorporeal specter stalks here.",
      "3_close": "A terrifying apparition woven of pure shadowy malice, with glowing red pinpoints of hatred burning within its cowl.",
      "4_ranger_close": "Physical armor cannot bar its spectral touch, and it leeches vitality directly from the soul; strike with blessed steel.",
      "5_health_100": "The incorporeal specter drifts forward effortlessly, extending shadowy claws that hunger for the warmth of the living.",
      "6_health_75": "A clean cut disrupts its smoky form, eliciting a chilling, ear-piercing scream of spectral torment.",
      "7_health_50": "Its shadowy outline wavers and frays like burned silk as spiritual agony consumes it.",
      "8_health_25": "Fading into thin gray vapor, the phantom's crimson eyes flare weakly in final defiance.",
      "9_dead": "The shadow entity dissolves into nothingness, leaving only the freezing chill of the grave behind."
    }
  },
  {
    name: 'Gibbering Mouther',
    symbol: 'M',
    color: '#9b2c2c',
    base_hp: 45,
    xp_reward: 1600,
    damage_dice: '1d4',
    initiative_bonus: 3,
    armor_class: 19,
    attack_bonus: 7,
    challenge_rating: 5.0,
    solo_level: 5,
    spawn_weight: 5,
    habitat: '["U", "S"]',
    movement_type: 'WALK',
    special_abilities: '["gibbering", "spittle", "engulf", "ground_manipulation"]',
    image_slug: 'gibbering_mouther',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Gibbering%20Mouther',
    creature_type: 'Aberration',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A chaotic, maddening chorus of babbling, weeping, and laughing voices echoes off wet cavern walls.",
      "2_ranger_distant": "Slime-slicked ground turning soft as quicksand and overlapping mad murmurs reveal an amorphous eldritch horror.",
      "3_close": "An amorphous mound of bubbling, weeping flesh, dotted with dozens of blinking eyes and chattering fanged mouths.",
      "4_ranger_close": "Its incessant babble confuses the mind; focus on your weapon rhythm and carve through its spongy mass.",
      "5_health_100": "Dozens of mouths babble in unholy languages simultaneously as the mass of flesh rolls forward hungrily.",
      "6_health_75": "Scores of eyes burst under blade impact, spraying acidic slime while the remaining mouths scream in unison.",
      "7_health_50": "Deep gashes divide the flesh mass; it struggles to coordinate its dozens of gnashing maws.",
      "8_health_25": "Collapsing into a sluggish puddle of twitching lips and half-shut eyes, its babble turns to faint whimpering.",
      "9_dead": "The amorphous blob melts into foul, bubbling sludge, completely quiet at last."
    }
  },
  {
    name: 'Peryton',
    symbol: 'P',
    color: '#702459',
    base_hp: 42,
    xp_reward: 1200,
    damage_dice: '1d6+3',
    initiative_bonus: 7,
    armor_class: 17,
    attack_bonus: 7,
    challenge_rating: 4.0,
    solo_level: 4,
    spawn_weight: 6,
    habitat: '["M", "F"]',
    movement_type: 'FLY',
    special_abilities: '["shadow_manipulation", "gore", "damage_reduction"]',
    image_slug: 'peryton',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Peryton',
    creature_type: 'Magical Beast',
    creature_subtype: null,
    treasure_type: 'Standard',
    terrains: [
      { name: 'MOUNTAINS', is_primary: 1 },
      { name: 'FOREST', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A winged shadow glides over the slopes, yet curiously the shadow cast upon the rocks resembles that of a horned human.",
      "2_ranger_distant": "Decapitated deer and an ominous human-shaped silhouette cast upon the crags warn of a cursed winged carnivore.",
      "3_close": "A stag-headed flying predator with dark purple eagle wings, sharp obsidian horns, and the cruel talons of an oversized bird of prey.",
      "4_ranger_close": "It dives from above aiming its heavy antlers at the chest; sidestep its charge and slice its wing tendons.",
      "5_health_100": "The horned avian predator circles gracefully, horns lowered for a devastating aerial impalement.",
      "6_health_75": "Slashed feathers and splintered antler tips evoke an angry, screeching dive from the winged stag.",
      "7_health_50": "Struggling to climb against the mountain wind, blood flows over its purple plumage.",
      "8_health_25": "Grounded and coughing crimson foam, the beast lashes out blindly with cracked antlers.",
      "9_dead": "The dark winged predator lies still, its sinister shadow fading away with its final breath."
    }
  },
  {
    name: 'Giant Stag Beetle',
    symbol: 'B',
    color: '#234e52',
    base_hp: 45,
    xp_reward: 1200,
    damage_dice: '2d8+6',
    initiative_bonus: -1,
    armor_class: 19,
    attack_bonus: 8,
    challenge_rating: 4.0,
    solo_level: 4,
    spawn_weight: 6,
    habitat: '["F", "J"]',
    movement_type: 'WALK',
    special_abilities: '["trample", "darkvision"]',
    image_slug: 'giant_stag_beetle',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Stag%20Beetle',
    creature_type: 'Vermin',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'FOREST', is_primary: 1 },
      { name: 'JUNGLE', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "Branches splinter and the earth trembles rhythmically as a massive, heavy armored creature bulldozes through the underbrush.",
      "2_ranger_distant": "Gouged tree trunks and flattened saplings point to a territorial behemoth beetle foraging aggressively.",
      "3_close": "A ten-foot beetle armored in thick iridescent blue-black carapace, brandishing colossal branching mandibles capable of snapping logs.",
      "4_ranger_close": "Its dorsal shell is nearly impenetrable; aim for the softer connective joints beneath its massive horn.",
      "5_health_100": "The titanic insect clatters forward like a living siege engine, clicking its immense mandibles with bone-crushing force.",
      "6_health_75": "A heavy weapon blow fractures its outer shell, but the behemoth simply lowers its horns and charges harder.",
      "7_health_50": "Milky fluid leaks freely from crushed carapace segments as its heavy charges lose momentum.",
      "8_health_25": "Staggering on crushed legs, the immense beetle tilts sideways, mandibles dragging through the soil.",
      "9_dead": "The giant beetle rolls onto its side with a shuddering groan, armored mandibles resting inert upon the moss."
    }
  },
  {
    name: 'Vegepygmy',
    symbol: 'v',
    color: '#2f855a',
    base_hp: 7,
    xp_reward: 200,
    damage_dice: '1d6+1',
    initiative_bonus: 2,
    armor_class: 16,
    attack_bonus: 1,
    challenge_rating: 0.5,
    solo_level: 1,
    spawn_weight: 12,
    habitat: '["S", "U"]',
    movement_type: 'WALK',
    special_abilities: '["plant_traits", "damage_reduction", "low_light_vision"]',
    image_slug: 'vegepygmy',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Vegepygmy',
    creature_type: 'Plant',
    creature_subtype: null,
    treasure_type: 'Incidental',
    terrains: [
      { name: 'SWAMP', is_primary: 1 },
      { name: 'UNDERGROUND_RUINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A dry, rhythmic clicking of wood and rustling of fungal caps emerges from the damp shadows.",
      "2_ranger_distant": "Spores and fibrous moss trails mark the territory of primitive mold-born plant humanoids.",
      "3_close": "A diminutive, fibrous plant humanoid made of dense fungus and woody vines, gripping a primitive stone-tipped spear.",
      "4_ranger_close": "Its fibrous body resists piercing and blunt attacks; slashing edges cut easily through its vine-like sinews.",
      "5_health_100": "The small mold-creature clicks its wooden mandibles, thrusting its crude spear with surprising vigor.",
      "6_health_75": "Severed vines spill sap instead of blood as the creature emits a hiss of irritating spores.",
      "7_health_50": "Punctured and leaking greenish sap, the plant creature stumbles backward into the moss.",
      "8_health_25": "Its fungal torso unraveling, the creature feebly swings its spear with failing strength.",
      "9_dead": "The mold-born creature falls into a heap of withered stalks and inert, harmless lichen."
    }
  },
  {
    name: 'Ghast',
    symbol: 'G',
    color: '#319795',
    base_hp: 17,
    xp_reward: 600,
    damage_dice: '1d6+3',
    initiative_bonus: 3,
    armor_class: 16,
    attack_bonus: 5,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 8,
    habitat: '["U", "S"]',
    movement_type: 'WALK',
    special_abilities: '["stench", "paralysis", "undead_traits"]',
    image_slug: 'ghast',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Ghast',
    creature_type: 'Undead',
    creature_subtype: null,
    treasure_type: 'Standard',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "An overwhelming, suffocating stench of decayed flesh heralds the presence of an insatiable graveyard scavenger.",
      "2_ranger_distant": "Unearthed graves and clawed tracks slick with foul rot reveal an elite carrion-feeder nearby.",
      "3_close": "A feral undead abomination with mottled gray skin, elongated teeth, and claws dripping paralytic filth.",
      "4_ranger_close": "Its unbearable stench sickens the weak, and its claws paralyze; keep distance and strike with divine fury.",
      "5_health_100": "The ravenous undead leaps forward with animalistic speed, jaws slavering with hunger.",
      "6_health_75": "Blade strikes carve into its gray meat; it roars with carrion breath and attacks with renewed violence.",
      "7_health_50": "Grievously wounded and leaking bile, the beast snarls through shattered fangs.",
      "8_health_25": "Crawling along the flagstones with broken limbs, the creature snaps its teeth in futile hunger.",
      "9_dead": "The foul abomination collapses in a heap of rotten flesh, its sickening stench gradually dissipating."
    }
  },
  {
    name: 'Giant Bat',
    symbol: 'b',
    color: '#4a5568',
    base_hp: 22,
    xp_reward: 600,
    damage_dice: '1d8+3',
    initiative_bonus: 2,
    armor_class: 15,
    attack_bonus: 5,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 9,
    habitat: '["U", "F"]',
    movement_type: 'FLY',
    special_abilities: '["blindsense", "flight"]',
    image_slug: 'giant_bat',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Bat,%20Dire',
    creature_type: 'Animal',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'FOREST', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "High-frequency clicks and the heavy, leathery buffet of giant wings disturb the upper cavern air.",
      "2_ranger_distant": "Guano mounds and claw marks on high stalactites indicate an aggressive giant cave flyer roosting nearby.",
      "3_close": "A massive flying mammal with a five-foot furry body, a ten-foot leathery wingspan, and razor-sharp fangs.",
      "4_ranger_close": "It navigates by sound rather than sight; loud percussive strikes disorient its flight.",
      "5_health_100": "The giant flyer dives from the cavern roof, leathery wings spreading wide as fangs bare in a screech.",
      "6_health_75": "A torn wing membrane disrupts its swoop, forcing it to bank sharply to avoid crashing.",
      "7_health_50": "Bleeding and unable to maintain sustained flight, the creature flutters near the ground with furious bites.",
      "8_health_25": "Crawling on its wing-claws with broken bones, the injured beast shrieks in pain.",
      "9_dead": "The massive winged mammal falls silent, tangled in its own limp, shredded wings."
    }
  },
  {
    name: 'Morlock',
    symbol: 'm',
    color: '#e2e8f0',
    base_hp: 22,
    xp_reward: 600,
    damage_dice: '1d4+2',
    initiative_bonus: 8,
    armor_class: 15,
    attack_bonus: 5,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 8,
    habitat: '["U"]',
    movement_type: 'CLIMB',
    special_abilities: '["sneak_attack", "darkvision", "light_blindness", "climb"]',
    image_slug: 'morlock',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Morlock',
    creature_type: 'Monstrous Humanoid',
    creature_subtype: null,
    treasure_type: 'Standard',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 }
    ],
    descriptions: {
      "1_distant": "A feral chittering and the agile scraping of bare hands and feet scaling sheer cavern walls echo above.",
      "2_ranger_distant": "Oily pale handprints and bones gnawed by humanoid teeth indicate degenerate subterranean cave stalkers.",
      "3_close": "A degenerate, chalk-white humanoid with spindly limbs, enormous milky eyes, and a vicious serrated bone club.",
      "4_ranger_close": "Their eyes cannot withstand bright illumination; hold the high ground and strike when they leap from the walls.",
      "5_health_100": "The pale troglodytic creature scampers across the wall with unnatural speed, teeth chattering aggressively.",
      "6_health_75": "Blood spatters its chalk-white hide; the feral creature shrieks and leaps to a higher ledge.",
      "7_health_50": "Severely battered, the degenerate creature snarls and swings its primitive club with desperate fury.",
      "8_health_25": "Huddled against the stone with shattered limbs, the pale stalker cowers with terrified, milky eyes.",
      "9_dead": "The degenerate white humanoid lies limp upon the cavern floor, motionless in the dark."
    }
  },
  {
    name: 'Violet Fungus',
    symbol: 'F',
    color: '#805ad5',
    base_hp: 30,
    xp_reward: 800,
    damage_dice: '1d4+1',
    initiative_bonus: -2,
    armor_class: 15,
    attack_bonus: 4,
    challenge_rating: 3.0,
    solo_level: 3,
    spawn_weight: 7,
    habitat: '["U", "S"]',
    movement_type: 'WALK',
    special_abilities: '["rot", "tentacles", "plant_traits"]',
    image_slug: 'violet_fungus',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Violet%20Fungus',
    creature_type: 'Plant',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'SWAMP', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A sickly sweet odor of rotting fungus fills the damp cavern, accompanied by the wet sliding of slimy tendrils.",
      "2_ranger_distant": "Necrotic black mold covering old bones indicates a predatory rotting mushroom lurking ahead.",
      "3_close": "A four-foot tall purplish mushroom cap sprouting four whip-like, thorny tentacles that drip flesh-dissolving acid.",
      "4_ranger_close": "Its tentacles cause rapid flesh necrosis on contact; keep clear of its reach and sever its stalk with heavy cuts.",
      "5_health_100": "The violet mushroom whips its four thorny tentacles through the air, hissing with corrosive venom.",
      "6_health_75": "One of its flailing tendrils is severed cleanly, spraying acidic purple spores across the flagstones.",
      "7_health_50": "Its main fungal cap is sliced open, leaking noxious rotting bile as its flailing grows chaotic.",
      "8_health_25": "With three tentacles severed and its stalk collapsing, the dying fungus emits a faint sickly hiss.",
      "9_dead": "The purple mushroom collapses into a pile of rotten, harmless fungal pulp."
    }
  },
  {
    name: 'Grick',
    symbol: 'g',
    color: '#2c7a7b',
    base_hp: 27,
    xp_reward: 600,
    damage_dice: '1d4+1',
    initiative_bonus: 2,
    armor_class: 16,
    attack_bonus: 4,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 8,
    habitat: '["U", "H"]',
    movement_type: 'CLIMB',
    special_abilities: '["damage_reduction", "scent", "climb"]',
    image_slug: 'grick',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Grick',
    creature_type: 'Aberration',
    creature_subtype: null,
    treasure_type: 'Incidental',
    terrains: [
      { name: 'UNDERGROUND_RUINS', is_primary: 1 },
      { name: 'HILLS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A wet, slithering sound accompanied by the clicking of a sharp beak emerges from cracks in the rocky ceiling.",
      "2_ranger_distant": "Dislodged pebbles and a slick slime trail reveal an ambush predator blended seamlessly into the stone.",
      "3_close": "A worm-like horror with rubbery slate-gray hide, a snapping parrot-like beak, and four barbed tentacles circling its mouth.",
      "4_ranger_close": "Its rubbery hide resists non-magical strikes; focus strong thrusts directly into its beaked maw.",
      "5_health_100": "The rubbery worm coils like a spring, tentacles writhing and beak snapping hungrily.",
      "6_health_75": "A deep cut slices through its tentacle cluster, causing the beast to hiss in pain and lash out blindly.",
      "7_health_50": "Leaking dark alien fluid from multiple wounds, the worm struggles to keep its coils steady.",
      "8_health_25": "Twitching feebly on the cavern floor, the wounded horror snaps its beak with fading energy.",
      "9_dead": "The rubbery monstrosity lies lifeless and limp, its barbed tentacles uncurling across the rock."
    }
  },
  {
    name: 'Krenshar',
    symbol: 'k',
    color: '#dd6b20',
    base_hp: 13,
    xp_reward: 400,
    damage_dice: '1d6',
    initiative_bonus: 2,
    armor_class: 15,
    attack_bonus: 3,
    challenge_rating: 1.0,
    solo_level: 1,
    spawn_weight: 10,
    habitat: '["F", "P"]',
    movement_type: 'WALK',
    special_abilities: '["scare", "scent"]',
    image_slug: 'krenshar',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Krenshar',
    creature_type: 'Magical Beast',
    creature_subtype: null,
    treasure_type: 'None',
    terrains: [
      { name: 'FOREST', is_primary: 1 },
      { name: 'PLAINS', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A low, feline growl echoes through the trees, suddenly escalating into an unnatural, blood-chilling screech.",
      "2_ranger_distant": "Deep feline claw marks high on tree trunks indicate a bizarre predator known for terrifying psychological displays.",
      "3_close": "A hyena-like feline beast that can retract the skin of its face to reveal bare muscle, fangs, and glistening skull.",
      "4_ranger_close": "Do not look into its terrifying peeled skull visage; rely on disciplined strikes and ignore the hideous display.",
      "5_health_100": "The predator peels back the flesh of its head in a terrifying grimace, snarling with exposed bone and teeth.",
      "6_health_75": "A solid blow cuts across its tawny flank; the creature recoils with a sharp yowl of surprised pain.",
      "7_health_50": "Bleeding freely and its terrifying display broken, the feline beast circles warily.",
      "8_health_25": "Limping heavily with its head bowed, the wounded predator whines with failing breath.",
      "9_dead": "The tawny beast collapses onto the forest floor, its facial skin settling peacefully over its skull in death."
    }
  },
  {
    name: 'Bunyip',
    symbol: 'B',
    color: '#2b6cb0',
    base_hp: 30,
    xp_reward: 800,
    damage_dice: '1d8+4',
    initiative_bonus: 3,
    armor_class: 15,
    attack_bonus: 7,
    challenge_rating: 3.0,
    solo_level: 3,
    spawn_weight: 7,
    habitat: '["R", "S", "C"]',
    movement_type: 'SWIM',
    special_abilities: '["roar", "blood_frenzy", "swim"]',
    image_slug: 'bunyip',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Bunyip',
    creature_type: 'Magical Beast',
    creature_subtype: 'aquatic',
    treasure_type: 'None',
    terrains: [
      { name: 'RIVER_LAKE', is_primary: 1 },
      { name: 'SWAMP', is_primary: 0 },
      { name: 'COAST', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "A deep, resonant bellow reverberates across the dark waters, followed by heavy splashes breaking the calm surface.",
      "2_ranger_distant": "Disturbed reeds and floating bloody fish heads indicate an aggressive aquatic beast patrolling the shallows.",
      "3_close": "A fearsome aquatic chimera combining the body of a huge seal with the head and ferocious jaws of a great shark.",
      "4_ranger_close": "Its terrifying roar panics nearby prey and it enters a frenzy at the scent of blood; avoid fighting in deep water.",
      "5_health_100": "The amphibious monster surfaces with a deafening roar, razor-sharp shark teeth glistening in the water.",
      "6_health_75": "A strike slices into its blubbery hide; the creature thrashes the water to foam in mounting fury.",
      "7_health_50": "Dark blood plumes around the beast in the water as its powerful lunges grow clumsy.",
      "8_health_25": "Gasping on the riverbank with shredded fins, the dying aquatic predator snaps feebly at the air.",
      "9_dead": "The shark-headed beast rolls belly-up upon the water, floating motionless among the reeds."
    }
  },
  {
    name: 'Sahuagin',
    symbol: 'S',
    color: '#007791',
    base_hp: 15,
    xp_reward: 600,
    damage_dice: '1d8+3',
    initiative_bonus: 1,
    armor_class: 16,
    attack_bonus: 4,
    challenge_rating: 2.0,
    solo_level: 2,
    spawn_weight: 8,
    habitat: '["C", "O", "R"]',
    movement_type: 'SWIM',
    special_abilities: '["blood_frenzy", "aquatic", "darkvision"]',
    image_slug: 'sahuagin',
    source_url: 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Sahuagin',
    creature_type: 'Monstrous Humanoid',
    creature_subtype: 'aquatic',
    treasure_type: 'Standard',
    terrains: [
      { name: 'COAST', is_primary: 1 },
      { name: 'OCEAN', is_primary: 0 },
      { name: 'RIVER_LAKE', is_primary: 0 }
    ],
    descriptions: {
      "1_distant": "The wet slap of webbed feet upon coastal rock and the click of trident shafts echo from the crashing surf.",
      "2_ranger_distant": "Webbed claw prints and discarded sea-shells sharpened into weapons betray coastal raiders scouting the shoreline.",
      "3_close": "A predatory fish-like humanoid with green-scaled hide, webbed clawed hands, shark-like jaws, and a heavy coral trident.",
      "4_ranger_close": "Blood in the water sends them into an uncontrollable frenzy; maintain discipline and parry their trident thrusts.",
      "5_health_100": "The sea-devil hisses through rows of triangular teeth, spinning its heavy trident in a lethal guard.",
      "6_health_75": "Shattered green scales bleed dark crimson into the foam; the raider lets out an enraged aquatic screech.",
      "7_health_50": "Grievously injured, the coastal hunter stumbles backward into the surf, gasping through flared gills.",
      "8_health_25": "Collapsing onto the tidal rocks with broken fins, the sea-raider glares with fading predatory hatred.",
      "9_dead": "The green-scaled sea-devil lies still upon the shoreline, the incoming tide washing over its lifeless fins."
    }
  }
];

// Generate SQL
let sql = `-- 006_seed_pathfinder_30_additional.sql: 30 Additional Authentic Pathfinder 1e monsters
-- Expanding Darkgrid monster catalog from 38 to 68 total monsters.
-- Sourced from Archives of Nethys (aonprd.com).

`;

for (const m of NEW_MONSTERS) {
  const descJson = JSON.stringify(m.descriptions).replace(/'/g, "''");
  const subTypeVal = m.creature_subtype ? `'${m.creature_subtype}'` : 'NULL';
  const treasureVal = `'${m.treasure_type}'`;

  sql += `-- Monster: ${m.name} (CR ${m.challenge_rating}, ${m.creature_type})\n`;
  sql += `INSERT INTO monsters (\n`;
  sql += `    name, symbol, color, base_hp, xp_reward, damage_dice,\n`;
  sql += `    initiative_bonus, armor_class, attack_bonus, challenge_rating,\n`;
  sql += `    solo_level, spawn_weight, habitat, movement_type,\n`;
  sql += `    special_abilities, image_path, descriptions, source_url,\n`;
  sql += `    creature_type, creature_subtype, treasure_type\n`;
  sql += `) VALUES (\n`;
  sql += `    '${m.name}', '${m.symbol}', '${m.color}', ${m.base_hp}, ${m.xp_reward}, '${m.damage_dice}',\n`;
  sql += `    ${m.initiative_bonus}, ${m.armor_class}, ${m.attack_bonus}, ${m.challenge_rating},\n`;
  sql += `    ${m.solo_level}, ${m.spawn_weight}, '${m.habitat}', '${m.movement_type}',\n`;
  sql += `    '${m.special_abilities}', 'images/monsters/${m.image_slug}.png', '${descJson}', '${m.source_url}',\n`;
  sql += `    '${m.creature_type}', ${subTypeVal}, ${treasureVal}\n`;
  sql += `)\n`;
  sql += `ON CONFLICT(name) DO UPDATE SET\n`;
  sql += `    base_hp = excluded.base_hp,\n`;
  sql += `    armor_class = excluded.armor_class,\n`;
  sql += `    attack_bonus = excluded.attack_bonus,\n`;
  sql += `    damage_dice = excluded.damage_dice,\n`;
  sql += `    xp_reward = excluded.xp_reward,\n`;
  sql += `    solo_level = excluded.solo_level,\n`;
  sql += `    challenge_rating = excluded.challenge_rating,\n`;
  sql += `    movement_type = excluded.movement_type,\n`;
  sql += `    source_url = excluded.source_url,\n`;
  sql += `    image_path = excluded.image_path,\n`;
  sql += `    descriptions = excluded.descriptions,\n`;
  sql += `    creature_type = excluded.creature_type,\n`;
  sql += `    creature_subtype = excluded.creature_subtype,\n`;
  sql += `    treasure_type = excluded.treasure_type;\n\n`;

  for (const t of m.terrains) {
    sql += `INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)\n`;
    sql += `SELECT id, '${t.name}', ${t.is_primary} FROM monsters WHERE name = '${m.name}';\n`;
  }
  sql += `\n`;
}

const outputPath = path.join(__dirname, '../db/seeds/006_seed_pathfinder_30_additional.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated ${outputPath} with ${NEW_MONSTERS.length} monsters.`);

// Copy base PNG for any missing monster images
const basePngPath = path.join(__dirname, '../images/monsters/feral_wolf.png');
const baseBuf = fs.readFileSync(basePngPath);

const targetDirs = [
  path.join(__dirname, '../images/monsters'),
  path.join(__dirname, '../public/images/monsters')
];

let createdImages = 0;
for (const m of NEW_MONSTERS) {
  const fileName = `${m.image_slug}.png`;
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, fileName);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, baseBuf);
      createdImages++;
    }
  }
}
console.log(`Ensured all images exist. New images written: ${createdImages}`);

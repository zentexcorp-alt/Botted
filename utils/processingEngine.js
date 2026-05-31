const PLANTS = {
  oil_refinery: {
    name: '🏭 Oil Refinery',
    cost: 2000000,
    inputs: ['OIL'],
    outputs: { OIL: { symbol: 'RFUEL', name: 'Refined Fuel', ratio: 0.8 } },
    timePerHundred: 30 * 60 * 1000,
    maxCapacity: 500,
    durabilityLoss: 2,
    repairCost: 50000,
    outputMultiplier: 2.5,
    upgrades: {
      speed: { name: '⚡ Speed Upgrade', cost: 500000, effect: '20% faster processing' },
      capacity: { name: '📦 Capacity Upgrade', cost: 750000, effect: 'Double batch size' },
      durability: { name: '🔧 Durability Upgrade', cost: 600000, effect: '1% durability loss per batch' },
    },
  },
  gas_plant: {
    name: '🔴 Gas Processing Plant',
    cost: 1500000,
    inputs: ['GAS'],
    outputs: { GAS: { symbol: 'LGAS', name: 'Liquefied Gas', ratio: 0.9 } },
    timePerHundred: 20 * 60 * 1000,
    maxCapacity: 500,
    durabilityLoss: 1.5,
    repairCost: 40000,
    outputMultiplier: 2,
    upgrades: {},
  },
  smelter: {
    name: '🛸 Smelter',
    cost: 3000000,
    inputs: ['XAU', 'XAG'],
    outputs: {
      XAU: { symbol: 'XAUB', name: 'Gold Bar', ratio: 0.8 },
      XAG: { symbol: 'XAGB', name: 'Silver Bar', ratio: 0.8 },
    },
    timePerHundred: 60 * 60 * 1000,
    maxCapacity: 100,
    durabilityLoss: 3,
    repairCost: 100000,
    outputMultiplier: 3,
    upgrades: {
      hotterFurnace: { name: '🔥 Hotter Furnace', cost: 800000, effect: '30% better conversion rate' },
      reinforcedLining: { name: '🛡️ Reinforced Lining', cost: 600000, effect: '50% less durability loss' },
    },
  },
  crop_processor: {
    name: '🌾 Crop Processor',
    cost: 500000,
    inputs: ['CORN', 'WEAT', 'COFF'],
    outputs: {
      CORN: { symbol: 'ETHN', name: 'Ethanol', ratio: 1 },
      WEAT: { symbol: 'FLUR', name: 'Flour', ratio: 1 },
      COFF: { symbol: 'RCFF', name: 'Roasted Coffee', ratio: 1 },
    },
    timePerHundred: 45 * 60 * 1000,
    maxCapacity: 1000,
    durabilityLoss: 1,
    repairCost: 20000,
    outputMultiplier: { CORN: 2.5, WEAT: 2, COFF: 3 },
    upgrades: {},
  },
  steel_mill: {
    name: '🔨 Steel Mill',
    cost: 5000000,
    inputs: ['COPR', 'STLL'],
    outputs: {
      COPR_STLL: { symbol: 'ASTL', name: 'Alloy Steel', ratio: 0.8 },
    },
    timePerHundred: 2 * 60 * 60 * 1000,
    maxCapacity: 50,
    durabilityLoss: 4,
    repairCost: 200000,
    outputMultiplier: 4,
    upgrades: {},
    requiresBoth: true,
    inputRatio: { COPR: 5, STLL: 10, output: 8 },
  },
};

const PRODUCTION_UPGRADES = {
  oil_field: {
    storage_tank: {
      name: '📦 Storage Tank',
      description: '+500 barrel capacity before capping',
      cost: 50000,
      materialCost: null,
      effect: 'storage',
      effectValue: 500,
    },
    pump_upgrade: {
      name: '⚡ Pump Upgrade',
      description: '+50% output per hour',
      cost: 100000,
      materialCost: { STLL: 50 },
      effect: 'output',
      effectValue: 1.5,
    },
    auto_maintenance: {
      name: '🔧 Auto Maintenance',
      description: 'Reduces maintenance frequency',
      cost: 75000,
      materialCost: { COPR: 20 },
      effect: 'maintenance',
      effectValue: 0.5,
    },
    safety_system: {
      name: '🛡️ Safety System',
      description: 'Prevents breakdowns',
      cost: 120000,
      materialCost: null,
      effect: 'safety',
      effectValue: 1,
    },
  },
  gas_field: {
    pressure_boost: {
      name: '🌡️ Pressure Boost',
      description: '+40% output per hour',
      cost: 40000,
      materialCost: { STLL: 30 },
      effect: 'output',
      effectValue: 1.4,
    },
    pipeline_expansion: {
      name: '📦 Pipeline Expansion',
      description: 'Auto sends production to warehouse',
      cost: 60000,
      materialCost: null,
      effect: 'auto_collect',
      effectValue: 1,
    },
    leak_prevention: {
      name: '🔧 Leak Prevention',
      description: '50% less maintenance needed',
      cost: 50000,
      materialCost: { COPR: 10 },
      effect: 'maintenance',
      effectValue: 0.5,
    },
  },
  gold_mine: {
    explosive_charges: {
      name: '💥 Explosive Charges',
      description: '+80% output for 24h (one time use)',
      cost: 30000,
      materialCost: null,
      effect: 'temp_boost',
      effectValue: 1.8,
      oneTime: true,
    },
    heavy_machinery: {
      name: '🚜 Heavy Machinery',
      description: '+60% output permanent',
      cost: 200000,
      materialCost: { STLL: 50, COPR: 30 },
      effect: 'output',
      effectValue: 1.6,
    },
    ore_scanner: {
      name: '🔍 Ore Scanner',
      description: '+20% chance of rare gold vein',
      cost: 150000,
      materialCost: null,
      effect: 'rare_chance',
      effectValue: 0.2,
    },
    water_pump: {
      name: '💧 Water Pump',
      description: 'Prevents flooding, maintains durability',
      cost: 80000,
      materialCost: null,
      effect: 'durability',
      effectValue: 0.5,
    },
  },
  silver_mine: {
    explosive_charges: {
      name: '💥 Explosive Charges',
      description: '+80% output for 24h (one time use)',
      cost: 15000,
      materialCost: null,
      effect: 'temp_boost',
      effectValue: 1.8,
      oneTime: true,
    },
    heavy_machinery: {
      name: '🚜 Heavy Machinery',
      description: '+60% output permanent',
      cost: 80000,
      materialCost: { STLL: 30, COPR: 20 },
      effect: 'output',
      effectValue: 1.6,
    },
    ore_scanner: {
      name: '🔍 Ore Scanner',
      description: '+20% chance of rare silver vein',
      cost: 60000,
      materialCost: null,
      effect: 'rare_chance',
      effectValue: 0.2,
    },
  },
  crop_farm: {
    irrigation: {
      name: '💧 Irrigation System',
      description: '+30% yield',
      cost: 15000,
      materialCost: null,
      effect: 'output',
      effectValue: 1.3,
    },
    fertilizer_system: {
      name: '🌿 Fertilizer System',
      description: '+50% yield (uses COPR per collect)',
      cost: 25000,
      materialCost: { COPR: 20 },
      effect: 'output',
      effectValue: 1.5,
    },
    harvester_bot: {
      name: '🤖 Harvester Bot',
      description: 'Auto collects every 2 hours',
      cost: 100000,
      materialCost: null,
      effect: 'auto_collect',
      effectValue: 1,
    },
    gmo_seeds: {
      name: '🧬 GMO Seeds',
      description: '+100% yield, higher maintenance',
      cost: 200000,
      materialCost: null,
      effect: 'output',
      effectValue: 2,
    },
  },
};

function getDurabilityEfficiency(durability) {
  if (durability >= 80) return 1.0;
  if (durability >= 60) return 0.85;
  if (durability >= 40) return 0.70;
  if (durability >= 20) return 0.50;
  if (durability >= 1) return 0.25;
  return 0;
}

function getPlant(plantType) {
  return PLANTS[plantType] || null;
}

function getAllPlants() {
  return PLANTS;
}

function getProductionUpgrades(assetType) {
  return PRODUCTION_UPGRADES[assetType] || {};
}

function calcProcessingTime(plant, quantity, hasSpeedUpgrade) {
  let timePerHundred = plant.timePerHundred;
  if (hasSpeedUpgrade) timePerHundred *= 0.8;
  return Math.ceil(quantity / 100) * timePerHundred;
}

function calcProcessingOutput(plant, inputSymbol, quantity, hasHotterFurnace) {
  const outputInfo = plant.outputs[inputSymbol];
  if (!outputInfo) return null;

  let ratio = outputInfo.ratio;
  if (hasHotterFurnace) ratio *= 1.3;

  const outputQty = parseFloat((quantity * ratio).toFixed(4));
  return { symbol: outputInfo.symbol, name: outputInfo.name, quantity: outputQty };
}

module.exports = {
  PLANTS, PRODUCTION_UPGRADES,
  getDurabilityEfficiency, getPlant, getAllPlants,
  getProductionUpgrades, calcProcessingTime, calcProcessingOutput,
};
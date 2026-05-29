const Production = require('../models/Production');
const Warehouse = require('../models/Warehouse');

const PRODUCTION_TYPES = {
  oil_field: {
    name: '🛢️ Oil Field',
    symbol: 'OIL',
    unit: 'barrels',
    tiers: [
      { name: 'Small Field', cost: 50000, outputPerHour: 5, maintenanceCost: 500 },
      { name: 'Medium Field', cost: 200000, outputPerHour: 20, maintenanceCost: 2000 },
      { name: 'Large Field', cost: 750000, outputPerHour: 75, maintenanceCost: 7500 },
      { name: 'Offshore Platform', cost: 3000000, outputPerHour: 300, maintenanceCost: 30000 },
    ],
    upgradeCostMult: 0.4,
  },
  gas_field: {
    name: '⛽ Gas Field',
    symbol: 'GAS',
    unit: 'units',
    tiers: [
      { name: 'Small Field', cost: 40000, outputPerHour: 8, maintenanceCost: 400 },
      { name: 'Medium Field', cost: 150000, outputPerHour: 30, maintenanceCost: 1500 },
      { name: 'Large Field', cost: 600000, outputPerHour: 100, maintenanceCost: 6000 },
      { name: 'Deep Well', cost: 2500000, outputPerHour: 400, maintenanceCost: 25000 },
    ],
    upgradeCostMult: 0.4,
  },
  gold_mine: {
    name: '🥇 Gold Mine',
    symbol: 'XAU',
    unit: 'oz',
    tiers: [
      { name: 'Surface Mine', cost: 100000, outputPerHour: 2, maintenanceCost: 1000 },
      { name: 'Underground Mine', cost: 400000, outputPerHour: 8, maintenanceCost: 4000 },
      { name: 'Deep Mine', cost: 1500000, outputPerHour: 25, maintenanceCost: 15000 },
      { name: 'Mega Mine', cost: 5000000, outputPerHour: 80, maintenanceCost: 50000 },
    ],
    upgradeCostMult: 0.5,
  },
  silver_mine: {
    name: '🥈 Silver Mine',
    symbol: 'XAG',
    unit: 'oz',
    tiers: [
      { name: 'Surface Mine', cost: 30000, outputPerHour: 10, maintenanceCost: 300 },
      { name: 'Underground Mine', cost: 120000, outputPerHour: 40, maintenanceCost: 1200 },
      { name: 'Deep Mine', cost: 450000, outputPerHour: 120, maintenanceCost: 4500 },
      { name: 'Mega Mine', cost: 1500000, outputPerHour: 400, maintenanceCost: 15000 },
    ],
    upgradeCostMult: 0.5,
  },
  crop_farm: {
    name: '🌾 Crop Farm',
    symbol: null, // depends on crop type
    unit: 'bushels',
    tiers: [
      { name: 'Small Farm', cost: 10000, outputPerHour: 20, maintenanceCost: 100 },
      { name: 'Medium Farm', cost: 40000, outputPerHour: 80, maintenanceCost: 400 },
      { name: 'Large Farm', cost: 150000, outputPerHour: 250, maintenanceCost: 1500 },
      { name: 'Industrial Farm', cost: 500000, outputPerHour: 800, maintenanceCost: 5000 },
    ],
    upgradeCostMult: 0.3,
  },
};

const CROP_TYPES = ['CORN', 'WEAT', 'COFF'];

async function getOrCreateWarehouse(userId) {
  let wh = await Warehouse.findOne({ userId });
  if (!wh) wh = await Warehouse.create({ userId, items: [] });
  return wh;
}

function addToWarehouse(warehouse, symbol, quantity) {
  const existing = warehouse.items.find((i) => i.symbol === symbol);
  if (existing) {
    existing.quantity += quantity;
    existing.lastUpdated = new Date();
  } else {
    warehouse.items.push({ symbol, quantity });
  }
  warehouse.usedCapacity = warehouse.items.reduce((a, i) => a + i.quantity, 0);
}

function getProductionType(type) {
  return PRODUCTION_TYPES[type] || null;
}

function getAllProductionTypes() {
  return PRODUCTION_TYPES;
}

module.exports = {
  PRODUCTION_TYPES,
  CROP_TYPES,
  getOrCreateWarehouse,
  addToWarehouse,
  getProductionType,
  getAllProductionTypes,
};
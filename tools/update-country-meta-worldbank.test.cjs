const assert = require('assert');
const {
  mergeCountryMeta,
  roundGdpUsdToTrillion
} = require('./update-country-meta-worldbank.cjs');

function testWorldBankValuesWin() {
  const local = {
    USA: { NAME_EN: 'United States', POPULATION: 1, GDP_USD_TRILLION: 1 }
  };
  const result = mergeCountryMeta({
    localData: local,
    worldBankGdp: { USA: { year: 2024, value: 28750956130731.2 } },
    worldBankPop: { USA: { year: 2024, value: 340110988 } },
    geoFallback: {}
  });

  assert.strictEqual(result.data.USA.POPULATION, 340110988);
  assert.strictEqual(result.data.USA.GDP_USD_TRILLION, 28.75);
  assert.strictEqual(result.report.rows[0].populationSource, 'worldbank');
  assert.strictEqual(result.report.rows[0].gdpSource, 'worldbank');
}

function testGeoFallbackFillsMissingWorldBankGdp() {
  const local = {
    PRK: { NAME_EN: 'North Korea', POPULATION: 25778816, GDP_USD_TRILLION: 0.02 }
  };
  const result = mergeCountryMeta({
    localData: local,
    worldBankGdp: {},
    worldBankPop: { PRK: { year: 2024, value: 26498823 } },
    geoFallback: { PRK: { population: 25666161, populationYear: 2019, gdpUsd: 40000000000, gdpYear: 2016 } }
  });

  assert.strictEqual(result.data.PRK.POPULATION, 26498823);
  assert.strictEqual(result.data.PRK.GDP_USD_TRILLION, 0.04);
  assert.strictEqual(result.report.rows[0].populationSource, 'worldbank');
  assert.strictEqual(result.report.rows[0].gdpSource, 'geojson');
}

function testMissingSourcesPreserveLocalValues() {
  const local = {
    XXX: { NAME_EN: 'Unknown', POPULATION: 123, GDP_USD_TRILLION: 0.456 }
  };
  const result = mergeCountryMeta({
    localData: local,
    worldBankGdp: {},
    worldBankPop: {},
    geoFallback: {}
  });

  assert.strictEqual(result.data.XXX.POPULATION, 123);
  assert.strictEqual(result.data.XXX.GDP_USD_TRILLION, 0.456);
  assert.strictEqual(result.report.rows[0].populationSource, 'unchanged');
  assert.strictEqual(result.report.rows[0].gdpSource, 'unchanged');
}

function testGdpRoundingKeepsSmallEconomiesNonZero() {
  assert.strictEqual(roundGdpUsdToTrillion(282000000), 0.0003);
  assert.strictEqual(roundGdpUsdToTrillion(11997800760.2242), 0.012);
  assert.strictEqual(roundGdpUsdToTrillion(28750956130731.2), 28.75);
}

testWorldBankValuesWin();
testGeoFallbackFillsMissingWorldBankGdp();
testMissingSourcesPreserveLocalValues();
testGdpRoundingKeepsSmallEconomiesNonZero();
console.log('update-country-meta-worldbank tests passed');

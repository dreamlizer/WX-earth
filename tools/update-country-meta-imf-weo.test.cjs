const assert = require('assert');
const {
  mergeCountryMeta,
  parseImfWeoCsv,
  roundGdpUsdToTrillion
} = require('./update-country-meta-imf-weo.cjs');

const sampleCsv = `STRUCTURE[;],STRUCTURE_ID,ACTION,COUNTRY,INDICATOR,FREQUENCY,TIME_PERIOD,OBS_VALUE,SCALE,COUNTRY_UPDATE_DATE
dataflow,IMF.RES:WEO(9.0.0),R,CHN,LP,A,2024,1408280000,6,9/25/2025
dataflow,IMF.RES:WEO(9.0.0),R,CHN,LP,A,2025,1405079906,6,9/25/2025
dataflow,IMF.RES:WEO(9.0.0),R,CHN,NGDPD,A,2024,18945112489000,9,9/25/2025
dataflow,IMF.RES:WEO(9.0.0),R,CHN,NGDPD,A,2025,19626247040000,9,9/25/2025
dataflow,IMF.RES:WEO(9.0.0),R,USA,LP,A,2025,341890000,6,9/30/2025
dataflow,IMF.RES:WEO(9.0.0),R,USA,NGDPD,A,2025,30767075000000,9,9/30/2025
dataflow,IMF.RES:WEO(9.0.0),R,KOS,LP,A,2025,1575553,6,9/30/2025
dataflow,IMF.RES:WEO(9.0.0),R,KOS,NGDPD,A,2025,12449307000,9,9/30/2025`;

function testParseImfWeoCsvKeepsRequestedYear() {
  const parsed = parseImfWeoCsv(sampleCsv, { targetYear: 2025 });

  assert.strictEqual(parsed.population.CHN.year, 2025);
  assert.strictEqual(parsed.population.CHN.value, 1405079906);
  assert.strictEqual(parsed.gdp.CHN.year, 2025);
  assert.strictEqual(parsed.gdp.CHN.value, 19626247040000);
  assert.strictEqual(parsed.gdp.USA.value, 30767075000000);
}

function testParseImfAliasesToLocalCodes() {
  const parsed = parseImfWeoCsv(sampleCsv, {
    targetYear: 2025,
    localCodeByImfCode: { KOS: 'XKX' }
  });

  assert.strictEqual(parsed.population.XKX.value, 1575553);
  assert.strictEqual(parsed.gdp.XKX.value, 12449307000);
}

function testImfValuesWinWhenAvailable() {
  const parsed = parseImfWeoCsv(sampleCsv, { targetYear: 2025 });
  const result = mergeCountryMeta({
    localData: {
      CHN: { NAME_EN: 'China', POPULATION: 1408975000, GDP_USD_TRILLION: 18.74 },
      USA: { NAME_EN: 'United States', POPULATION: 340110988, GDP_USD_TRILLION: 28.75 }
    },
    imfGdp: parsed.gdp,
    imfPop: parsed.population
  });

  assert.strictEqual(result.data.CHN.POPULATION, 1405079906);
  assert.strictEqual(result.data.CHN.GDP_USD_TRILLION, 19.63);
  assert.strictEqual(result.data.USA.POPULATION, 341890000);
  assert.strictEqual(result.data.USA.GDP_USD_TRILLION, 30.77);
  assert.strictEqual(result.report.rows[0].populationSource, 'imf-weo');
  assert.strictEqual(result.report.rows[0].gdpSource, 'imf-weo');
}

function testMissingImfValuesPreserveLocalValues() {
  const result = mergeCountryMeta({
    localData: {
      ATA: { NAME_EN: 'Antarctica', POPULATION: 4490, GDP_USD_TRILLION: 0.0009 }
    },
    imfGdp: {},
    imfPop: {}
  });

  assert.strictEqual(result.data.ATA.POPULATION, 4490);
  assert.strictEqual(result.data.ATA.GDP_USD_TRILLION, 0.0009);
  assert.strictEqual(result.report.rows[0].populationSource, 'unchanged');
  assert.strictEqual(result.report.rows[0].gdpSource, 'unchanged');
}

function testGdpRounding() {
  assert.strictEqual(roundGdpUsdToTrillion(19626247040000), 19.63);
  assert.strictEqual(roundGdpUsdToTrillion(3916311913000), 3.92);
  assert.strictEqual(roundGdpUsdToTrillion(282000000), 0.0003);
}

testParseImfWeoCsvKeepsRequestedYear();
testParseImfAliasesToLocalCodes();
testImfValuesWinWhenAvailable();
testMissingImfValuesPreserveLocalValues();
testGdpRounding();
console.log('update-country-meta-imf-weo tests passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTzOverrides() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'tz-overrides.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/export\s+function\s+getCountryOverride/, 'function getCountryOverride');
  source += '\nmodule.exports = { getCountryOverride };';

  const sandbox = {
    module: { exports: {} },
    exports: {},
    RegExp,
    String,
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function loadCountryInfoManager(getCountryOverride) {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'country-info-manager.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+class\s+CountryInfoManager/, 'class CountryInfoManager');
  source += '\nmodule.exports = { CountryInfoManager };';

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    setTimeout: (fn) => fn(),
    clearTimeout,
    buildCountryTitleSuffix: (lang, offset) => (lang === 'zh' ? `（${offset}）` : ` (${offset})`),
    getCountryOverride,
    countryMeta: {
      CHN: {
        NAME_EN: 'China',
        NAME_ZH: '中国',
        AREA_KM2: 9596961,
        POPULATION: 1408975000,
        GDP_USD_TRILLION: 18.74,
        CAPITAL_EN: 'Beijing',
        CAPITAL_ZH: '北京',
      },
    },
    setForcedLabel: () => {},
    setForcedCityCountries: () => {},
    clearForcedCityCountries: () => {},
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

async function testChinaPanelUsesCountryTimezoneOverride() {
  const { getCountryOverride } = loadTzOverrides();
  assert.strictEqual(
    getCountryOverride({ props: { ISO_A3: 'CHN' } }),
    'Asia/Shanghai',
    'country override should recognize China by ISO_A3'
  );

  const { CountryInfoManager } = loadCountryInfoManager(getCountryOverride);
  const page = {
    selectedTimezone: 'Asia/Bangkok',
    __lastForcedId: null,
    __keepCityForcedUntil: 0,
    data: {
      lang: 'zh',
      zenMode: false,
      countryPanelOpen: false,
      countryPanelFading: false,
      countryInfo: null,
    },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
    cancelPanelCloseTimer: () => {},
    onCloseCountryPanel: () => {},
    tzlookup: () => 'Asia/Bangkok',
    computeGmtOffsetStr(tzName) {
      return {
        'Asia/Shanghai': 'GMT+8',
        'Asia/Bangkok': 'GMT+7',
      }[tzName] || '';
    },
    formatTime: (_date, tzName) => tzName || '',
  };

  const manager = new CountryInfoManager(page);
  await manager.onCountryPicked({
    props: { ISO_A3: 'CHN' },
    bbox: [73.49, 18.16, 134.77, 53.56],
  });

  assert.strictEqual(page.data.countryInfo.tzName, 'Asia/Shanghai');
  assert.strictEqual(page.data.countryInfo.tzOffsetStr, 'GMT+8');
  assert.strictEqual(page.data.countryInfo.titleTzSuffix, '（GMT+8）');
}

function testCountryTimezoneCoverage() {
  const { getCountryOverride } = loadTzOverrides();
  const countryData = require(path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'country_data.json'));
  const multiTimezoneCountries = new Set([
    'ATA',
    'AUS',
    'BRA',
    'CAN',
    'CHL',
    'COD',
    'ECU',
    'ESP',
    'GRL',
    'IDN',
    'MEX',
    'MNG',
    'NZL',
    'PNG',
    'PRT',
    'RUS',
    'UKR',
    'USA',
  ]);

  const unmapped = Object.entries(countryData)
    .filter(([code, meta]) => !getCountryOverride({ props: { ISO_A3: code, ...meta } }))
    .map(([code]) => code)
    .sort();

  assert.deepStrictEqual(unmapped, [...multiTimezoneCountries].sort());
}

testChinaPanelUsesCountryTimezoneOverride()
  .then(() => testCountryTimezoneCoverage())
  .then(() => console.log('country-info-manager timezone tests passed'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

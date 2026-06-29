const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COUNTRY_JS = path.join(ROOT, 'miniprogram', 'pages', 'gl', 'country_data.js');
const COUNTRY_JSON = path.join(ROOT, 'miniprogram', 'pages', 'gl', 'country_data.json');
const ASSET_COUNTRY_JSON = path.join(ROOT, 'miniprogram', 'assets', 'data', 'country_data.json');
const COUNTY_META_JSON = path.join(ROOT, 'miniprogram', 'assets', 'data', 'County_meta.json');
const GEOJSON = path.join(ROOT, 'miniprogram', 'assets', 'data', 'countries.geojson');

const WB_GDP = 'NY.GDP.MKTP.CD';
const WB_POP = 'SP.POP.TOTL';
const WB_DATE_RANGE = '1960:2025';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readCountryJs(filePath = COUNTRY_JS) {
  const src = fs.readFileSync(filePath, 'utf8');
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error(`Cannot parse country data JS: ${filePath}`);
  }
  return JSON.parse(src.slice(start, end + 1));
}

function writeCountryJs(filePath, data) {
  fs.writeFileSync(filePath, `export default ${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchWorldBankIndicator(indicator) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=25000&date=${WB_DATE_RANGE}`;
  const payload = await requestJson(url);
  const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
  const latest = {};

  for (const row of rows) {
    const code = String(row?.countryiso3code || '').toUpperCase();
    if (!code || row?.value == null) continue;
    const year = Number(row.date);
    if (!Number.isFinite(year)) continue;
    if (!latest[code] || year > latest[code].year) {
      latest[code] = {
        year,
        value: Number(row.value),
        country: row?.country?.value || ''
      };
    }
  }

  return latest;
}

function validNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== -99;
}

function buildGeoFallback(geojson) {
  const fallback = {};
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  for (const feature of features) {
    const props = feature?.properties || {};
    const codes = [
      props.ISO_A3,
      props.ADM0_A3,
      props.ADM0_A3_US,
      props.ADM0_A3_GB,
      props.BRK_A3
    ].map((x) => String(x || '').toUpperCase()).filter((x) => x && x !== '-99');

    const item = {};
    if (validNumber(props.POP_EST)) {
      item.population = Math.round(Number(props.POP_EST));
      item.populationYear = validNumber(props.POP_YEAR) ? Number(props.POP_YEAR) : null;
    }
    if (validNumber(props.GDP_MD)) {
      item.gdpUsd = Number(props.GDP_MD) * 1000000;
      item.gdpYear = validNumber(props.GDP_YEAR) ? Number(props.GDP_YEAR) : null;
    }
    if (!Object.keys(item).length) continue;

    for (const code of codes) {
      if (!fallback[code]) fallback[code] = item;
    }
  }
  return fallback;
}

function roundGdpUsdToTrillion(usd) {
  const trillion = Number(usd) / 1000000000000;
  if (!Number.isFinite(trillion)) return null;
  if (trillion >= 1) return Number(trillion.toFixed(2));
  if (trillion >= 0.01) return Number(trillion.toFixed(3));
  return Number(trillion.toFixed(4));
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function mergeCountryMeta({ localData, worldBankGdp, worldBankPop, geoFallback }) {
  const data = cloneData(localData);
  const rows = [];
  let worldBankBoth = 0;
  let worldBankPopulation = 0;
  let worldBankGdpCount = 0;
  let geoPopulation = 0;
  let geoGdp = 0;
  let unchangedPopulation = 0;
  let unchangedGdp = 0;

  for (const code of Object.keys(data).sort()) {
    const item = data[code] || {};
    const pop = worldBankPop[code];
    const gdp = worldBankGdp[code];
    const geo = geoFallback[code] || {};

    let populationSource = 'unchanged';
    let populationYear = null;
    let gdpSource = 'unchanged';
    let gdpYear = null;

    if (pop && Number.isFinite(Number(pop.value))) {
      item.POPULATION = Math.round(Number(pop.value));
      populationSource = 'worldbank';
      populationYear = pop.year;
      worldBankPopulation += 1;
    } else if (Number.isFinite(Number(geo.population))) {
      item.POPULATION = Math.round(Number(geo.population));
      populationSource = 'geojson';
      populationYear = geo.populationYear;
      geoPopulation += 1;
    } else {
      unchangedPopulation += 1;
    }

    if (gdp && Number.isFinite(Number(gdp.value))) {
      item.GDP_USD_TRILLION = roundGdpUsdToTrillion(Number(gdp.value));
      gdpSource = 'worldbank';
      gdpYear = gdp.year;
      worldBankGdpCount += 1;
    } else if (Number.isFinite(Number(geo.gdpUsd))) {
      item.GDP_USD_TRILLION = roundGdpUsdToTrillion(Number(geo.gdpUsd));
      gdpSource = 'geojson';
      gdpYear = geo.gdpYear;
      geoGdp += 1;
    } else {
      unchangedGdp += 1;
    }

    if (populationSource === 'worldbank' && gdpSource === 'worldbank') {
      worldBankBoth += 1;
    }

    rows.push({
      code,
      name: item.NAME_EN || item.NAME_ZH || '',
      population: item.POPULATION,
      populationSource,
      populationYear,
      gdp: item.GDP_USD_TRILLION,
      gdpSource,
      gdpYear
    });
  }

  return {
    data,
    report: {
      rows,
      summary: {
        total: rows.length,
        worldBankBoth,
        worldBankPopulation,
        worldBankGdp: worldBankGdpCount,
        geoPopulation,
        geoGdp,
        unchangedPopulation,
        unchangedGdp
      }
    }
  };
}

function applyMergedFields(targetData, mergedData) {
  const next = cloneData(targetData);
  for (const code of Object.keys(next)) {
    if (!mergedData[code]) continue;
    next[code].POPULATION = mergedData[code].POPULATION;
    next[code].GDP_USD_TRILLION = mergedData[code].GDP_USD_TRILLION;
  }
  return next;
}

function printReport(report) {
  const { summary, rows } = report;
  console.log('[country-meta] summary:', JSON.stringify(summary));

  const gdpNon2024 = rows.filter((r) => r.gdpSource === 'worldbank' && r.gdpYear !== 2024);
  const geoGdp = rows.filter((r) => r.gdpSource === 'geojson');
  const geoPopulation = rows.filter((r) => r.populationSource === 'geojson');
  const unchanged = rows.filter((r) => r.populationSource === 'unchanged' || r.gdpSource === 'unchanged');

  if (gdpNon2024.length) {
    console.log('[country-meta] World Bank GDP not 2024:', gdpNon2024.map((r) => `${r.code}:${r.gdpYear}`).join(', '));
  }
  if (geoGdp.length) {
    console.log('[country-meta] GDP from GeoJSON fallback:', geoGdp.map((r) => `${r.code}:${r.gdpYear}`).join(', '));
  }
  if (geoPopulation.length) {
    console.log('[country-meta] population from GeoJSON fallback:', geoPopulation.map((r) => `${r.code}:${r.populationYear}`).join(', '));
  }
  if (unchanged.length) {
    console.log('[country-meta] unchanged fields:', unchanged.map((r) => `${r.code}:pop=${r.populationSource},gdp=${r.gdpSource}`).join(', '));
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const local = readJson(COUNTRY_JSON);
  const geoFallback = buildGeoFallback(readJson(GEOJSON));
  const [worldBankGdp, worldBankPop] = await Promise.all([
    fetchWorldBankIndicator(WB_GDP),
    fetchWorldBankIndicator(WB_POP)
  ]);
  const { data: mergedData, report } = mergeCountryMeta({
    localData: local,
    worldBankGdp,
    worldBankPop,
    geoFallback
  });

  printReport(report);

  if (!write) {
    console.log('[country-meta] dry run only. Re-run with --write to update local files.');
    return;
  }

  writeJson(COUNTRY_JSON, mergedData);
  writeJson(ASSET_COUNTRY_JSON, applyMergedFields(readJson(ASSET_COUNTRY_JSON), mergedData));

  const countyMeta = readJson(COUNTY_META_JSON);
  writeJson(COUNTY_META_JSON, applyMergedFields(countyMeta, mergedData));

  const countryJs = readCountryJs(COUNTRY_JS);
  writeCountryJs(COUNTRY_JS, applyMergedFields(countryJs, mergedData));
  console.log('[country-meta] wrote local country metadata files.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[country-meta] failed:', err);
    process.exit(1);
  });
}

module.exports = {
  buildGeoFallback,
  mergeCountryMeta,
  roundGdpUsdToTrillion
};

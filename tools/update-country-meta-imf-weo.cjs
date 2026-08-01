const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COUNTRY_JS = path.join(ROOT, 'miniprogram', 'pages', 'gl', 'country_data.js');
const COUNTRY_JSON = path.join(ROOT, 'miniprogram', 'pages', 'gl', 'country_data.json');
const ASSET_COUNTRY_JSON = path.join(ROOT, 'miniprogram', 'assets', 'data', 'country_data.json');
const COUNTY_META_JSON = path.join(ROOT, 'miniprogram', 'assets', 'data', 'County_meta.json');

const TARGET_YEAR = 2025;
const IMF_WEO_DATAFLOW = 'https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO';
const IMF_CODE_BY_LOCAL_CODE = {
  PSE: 'WBG',
  XKX: 'KOS'
};
const LOCAL_CODE_BY_IMF_CODE = Object.fromEntries(
  Object.entries(IMF_CODE_BY_LOCAL_CODE).map(([localCode, imfCode]) => [imfCode, localCode])
);

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

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function roundGdpUsdToTrillion(usd) {
  const trillion = Number(usd) / 1000000000000;
  if (!Number.isFinite(trillion)) return null;
  if (trillion >= 1) return Number(trillion.toFixed(2));
  if (trillion >= 0.01) return Number(trillion.toFixed(3));
  return Number(trillion.toFixed(4));
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseImfWeoCsv(csv, { targetYear = TARGET_YEAR, localCodeByImfCode = {} } = {}) {
  const lines = String(csv || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { gdp: {}, population: {} };

  const headers = parseCsvLine(lines[0]);
  const ix = Object.fromEntries(headers.map((h, i) => [h, i]));
  const required = ['COUNTRY', 'INDICATOR', 'TIME_PERIOD', 'OBS_VALUE'];
  for (const field of required) {
    if (!(field in ix)) throw new Error(`IMF CSV missing ${field}`);
  }

  const gdp = {};
  const population = {};
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const imfCode = String(cols[ix.COUNTRY] || '').toUpperCase();
    const code = localCodeByImfCode[imfCode] || imfCode;
    const indicator = String(cols[ix.INDICATOR] || '').toUpperCase();
    const year = Number(cols[ix.TIME_PERIOD]);
    const value = Number(cols[ix.OBS_VALUE]);
    if (!code || year !== Number(targetYear) || !Number.isFinite(value)) continue;

    const row = {
      year,
      value,
      updateDate: ix.COUNTRY_UPDATE_DATE >= 0 ? (cols[ix.COUNTRY_UPDATE_DATE] || '') : ''
    };

    if (indicator === 'NGDPD') {
      gdp[code] = row;
    } else if (indicator === 'LP') {
      population[code] = row;
    }
  }
  return { gdp, population };
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'text/csv', 'User-Agent': 'wx-earth-data-updater/1.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}: ${body.slice(0, 200)}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchImfWeoForCountries(codes, { targetYear = TARGET_YEAR } = {}) {
  const gdp = {};
  const population = {};
  const cleanCodes = [...new Set(codes
    .map((x) => String(x || '').toUpperCase())
    .filter(Boolean)
    .map((code) => IMF_CODE_BY_LOCAL_CODE[code] || code)
  )].sort();

  for (const chunk of chunkArray(cleanCodes, 50)) {
    const countryKey = chunk.join('+');
    const url = `${IMF_WEO_DATAFLOW}/+/${countryKey}.NGDPD+LP.A`;
    const csv = await requestText(url);
    const parsed = parseImfWeoCsv(csv, { targetYear, localCodeByImfCode: LOCAL_CODE_BY_IMF_CODE });
    Object.assign(gdp, parsed.gdp);
    Object.assign(population, parsed.population);
  }

  return { gdp, population };
}

function mergeCountryMeta({ localData, imfGdp, imfPop }) {
  const data = cloneData(localData);
  const rows = [];
  let imfBoth = 0;
  let imfPopulation = 0;
  let imfGdpCount = 0;
  let unchangedPopulation = 0;
  let unchangedGdp = 0;

  for (const code of Object.keys(data).sort()) {
    const item = data[code] || {};
    const pop = imfPop[code];
    const gdp = imfGdp[code];

    let populationSource = 'unchanged';
    let populationYear = null;
    let gdpSource = 'unchanged';
    let gdpYear = null;

    if (pop && Number.isFinite(Number(pop.value))) {
      item.POPULATION = Math.round(Number(pop.value));
      populationSource = 'imf-weo';
      populationYear = pop.year;
      imfPopulation += 1;
    } else {
      unchangedPopulation += 1;
    }

    if (gdp && Number.isFinite(Number(gdp.value))) {
      item.GDP_USD_TRILLION = roundGdpUsdToTrillion(Number(gdp.value));
      gdpSource = 'imf-weo';
      gdpYear = gdp.year;
      imfGdpCount += 1;
    } else {
      unchangedGdp += 1;
    }

    if (populationSource === 'imf-weo' && gdpSource === 'imf-weo') {
      imfBoth += 1;
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
        imfBoth,
        imfPopulation,
        imfGdp: imfGdpCount,
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
  console.log('[country-meta-imf] summary:', JSON.stringify(summary));

  const unchanged = rows.filter((r) => r.populationSource === 'unchanged' || r.gdpSource === 'unchanged');
  if (unchanged.length) {
    console.log('[country-meta-imf] unchanged fields:', unchanged.map((r) => `${r.code}:pop=${r.populationSource},gdp=${r.gdpSource}`).join(', '));
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const local = readJson(COUNTRY_JSON);
  const targetYearArg = process.argv.find((arg) => /^--year=/.test(arg));
  const targetYear = targetYearArg ? Number(targetYearArg.split('=')[1]) : TARGET_YEAR;
  if (!Number.isFinite(targetYear)) throw new Error(`Invalid target year: ${targetYearArg}`);

  const codes = Object.keys(local).sort();
  const { gdp: imfGdp, population: imfPop } = await fetchImfWeoForCountries(codes, { targetYear });
  const { data: mergedData, report } = mergeCountryMeta({ localData: local, imfGdp, imfPop });

  printReport(report);

  if (!write) {
    console.log('[country-meta-imf] dry run only. Re-run with --write to update local files.');
    return;
  }

  writeJson(COUNTRY_JSON, mergedData);
  writeJson(ASSET_COUNTRY_JSON, applyMergedFields(readJson(ASSET_COUNTRY_JSON), mergedData));
  writeJson(COUNTY_META_JSON, applyMergedFields(readJson(COUNTY_META_JSON), mergedData));

  const countryJs = readCountryJs(COUNTRY_JS);
  writeCountryJs(COUNTRY_JS, applyMergedFields(countryJs, mergedData));
  console.log('[country-meta-imf] wrote local country metadata files.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[country-meta-imf] failed:', err);
    process.exit(1);
  });
}

module.exports = {
  fetchImfWeoForCountries,
  mergeCountryMeta,
  parseImfWeoCsv,
  roundGdpUsdToTrillion
};

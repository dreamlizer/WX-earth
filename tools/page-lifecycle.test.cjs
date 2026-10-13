const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPage() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'index.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  // Load the page's shared visual labels after stripping ES imports in this VM.
  const looks = fs.readFileSync(path.join(path.dirname(file), 'saturn-preview-looks.js'), 'utf8').replace(/export /g, '');
  source = looks + '\n' + source;

  let nextId = 1;
  const timers = new Map();
  let pageConfig = null;
  let teardownCalls = 0;
  let teardownOptions = null;
  const sandbox = {
    console,
    Set,
    Object,
    Number,
    Math,
    Page(config) {
      pageConfig = config;
    },
    getInitialData: () => ({}),
    setTimeout(fn) {
      const id = nextId++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    teardown(options) {
      teardownCalls += 1;
      teardownOptions = options;
    },
    wx: {
      offWindowResize() {}
    }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    pageConfig,
    pendingTimers: () => timers.size,
    teardownCalls: () => teardownCalls,
    teardownOptions: () => teardownOptions,
    flushTimers() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    }
  };
}

function testUnloadCancelsPageOwnedTimers() {
  const runtime = loadPage();
  const page = runtime.pageConfig;
  let setDataCalls = 0;
  page.setData = () => { setDataCalls += 1; };

  page.showMoonToast('登月启动', 1000);
  page.__schedulePageTask(() => { setDataCalls += 1; }, 100);
  assert.equal(runtime.pendingTimers(), 3);

  page.onUnload();
  runtime.flushTimers();

  assert.equal(runtime.pendingTimers(), 0);
  assert.equal(setDataCalls, 1, 'only the immediate toast update may run before unload');
  assert.equal(runtime.teardownCalls(), 1);
  assert.equal(runtime.teardownOptions()?.deferResourceDisposal, true);
}

testUnloadCancelsPageOwnedTimers();
console.log('page lifecycle tests passed');

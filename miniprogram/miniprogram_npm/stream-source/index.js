module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1760187596591, function(require, module, exports) {
module.exports = function(stream) {
  return new StreamSource(stream);
};

function StreamSource(stream) {
  var that = this;
  that._readable = promise(that);
  that._stream = stream.on("readable", read).on("end", end).on("close", end).on("error", error);

  function read() {
    var resolve = that._resolve;
    that._readable = promise(that);
    resolve(false);
  }

  function end() {
    var resolve = that._resolve;
    that._readable = Promise.resolve(true);
    that._resolve = that._reject = noop;
    resolve(true);
  }

  function error(error) {
    var reject = that._reject;
    that._readable = Promise.reject(error);
    that._resolve = that._reject = noop;
    reject(error);
  }
}

StreamSource.prototype.read = require("./read");
StreamSource.prototype.slice = require("./slice");
StreamSource.prototype.cancel = require("./cancel");

function noop() {}

function promise(source) {
  return new Promise(function(resolve, reject) {
    source._resolve = resolve;
    source._reject = reject;
  });
}

}, function(modId) {var map = {"./read":1760187596592,"./slice":1760187596593,"./cancel":1760187596594}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1760187596592, function(require, module, exports) {
module.exports = function() {
  var that = this;
  return new Promise(function read(resolve, reject) {
    var buffer = that._stream.read();
    if (buffer != null) return resolve({done: false, value: buffer});
    that._readable.then(function(done) { return done ? resolve({done: true, value: undefined}) : read(resolve, reject); }).catch(reject);
  });
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1760187596593, function(require, module, exports) {
module.exports = function(length) {
  if ((length |= 0) < 0) throw new Error("invalid length");
  var that = this;
  return new Promise(function slice(resolve, reject) {
    if (length === 0) return resolve(that._stream.destroyed ? null : new Buffer(0));
    var buffer = that._stream.read(length);
    if (buffer != null) return resolve(buffer);
    that._readable.then(function(done) { return done ? resolve(null) : slice(resolve, reject); }).catch(reject);
  });
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1760187596594, function(require, module, exports) {
module.exports = function() {
  var stream = this._stream;
  return new Promise(function(resolve) {
    if (stream.destroyed) return resolve();
    stream.once("close", resolve).destroy();
  });
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1760187596591);
})()
//miniprogram-npm-outsideDeps=[]
//# sourceMappingURL=index.js.map
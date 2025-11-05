// build-merge.js
// 只需运行一次，即可自动生成 all_in_one.js

const esbuild = require("esbuild");

// 自动化打包所有 JS 为一个文件
esbuild.buildSync({
  entryPoints: ["main.js"],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: "all_in_one.js",
  charset: "utf8",
  logLevel: "info",
});

console.log("✅ 打包成功：all_in_one.js 已生成！");

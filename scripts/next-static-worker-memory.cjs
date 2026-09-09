const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const nextBuildPath = path.normalize(
  path.resolve(process.cwd(), "node_modules/next/dist/build/index.js"),
);
const originalJavaScriptLoader = Module._extensions[".js"];

Module._extensions[".js"] = function loadJavaScript(module, filename) {
  if (path.normalize(filename) !== nextBuildPath) {
    return originalJavaScriptLoader(module, filename);
  }

  const source = fs.readFileSync(filename, "utf8");
  const marker = "isolatedMemory: true,";
  const occurrences = source.split(marker).length - 1;

  if (occurrences !== 1) {
    throw new Error(
      `Unexpected Next.js static worker memory contract: ${occurrences} markers`,
    );
  }

  module._compile(source.replace(marker, "isolatedMemory: false,"), filename);
};

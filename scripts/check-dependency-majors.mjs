import fs from "node:fs";

const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const allDeps = {
  ...rootPkg.dependencies,
  ...rootPkg.devDependencies,
};

// Expected major versions to prevent unexpected breaking major bumps
const EXPECTED_MAJORS = {
  "@biomejs/biome": "2",
  "web-tree-sitter": "0",
  "tree-sitter-cpp": "0",
  tsup: "8",
  vitest: "5", // or 3/4 depending on pinned target
  "fast-check": "4",
  zod: "3", // Kept on 3 for zod-to-json-schema stability
  "zod-to-json-schema": "3",
  "@changesets/cli": "3",
  react: "19",
  "react-dom": "19",
  "@monaco-editor/react": "4",
  "monaco-editor": "0",
  typescript: "5",
};

let hasFailure = false;

for (const [pkg, expectedMajor] of Object.entries(EXPECTED_MAJORS)) {
  const versionStr = allDeps[pkg];
  if (!versionStr) {
    console.error(`[FAIL] Expected dependency "${pkg}" not found in package.json`);
    hasFailure = true;
    continue;
  }
  const cleanVersion = versionStr.replace(/^[\^~]/, "");
  const actualMajor = cleanVersion.split(".")[0];
  if (actualMajor !== expectedMajor) {
    console.error(
      `[FAIL] Major version mismatch for "${pkg}": expected ${expectedMajor}.x, found ${actualMajor}.x (${versionStr})`
    );
    hasFailure = true;
  } else {
    console.log(`[PASS] ${pkg}@${versionStr} (major ${actualMajor})`);
  }
}

if (hasFailure) {
  process.exit(1);
}
console.log("All dependencies match expected major versions.");

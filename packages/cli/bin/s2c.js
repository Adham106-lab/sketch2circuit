#!/usr/bin/env node

/**
 * @license Apache-2.0
 * sketch2circuit (s2c) CLI executable entry point.
 */

import { runCli } from "../src/runner.js";

const args = process.argv.slice(2);

runCli(args)
  .then((res) => {
    if (res.output) {
      if (res.code !== 0 && res.code !== 1 && res.code !== 2) {
        process.stderr.write(`${res.output}\n`);
      } else {
        process.stdout.write(`${res.output}\n`);
      }
    }
    process.exit(res.code);
  })
  .catch((err) => {
    process.stderr.write(`Fatal error: ${err?.message || err}\n`);
    process.exit(3);
  });

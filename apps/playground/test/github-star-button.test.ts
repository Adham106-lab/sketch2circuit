import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../../../src/App.js";
import { GitHubStarButton } from "../../../src/components/GitHubStarButton.js";

describe("GitHub Star CTA Button & Analytics Integration", () => {
  it("renders the standalone GitHubStarButton with correct attributes and SVG icons", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(GitHubStarButton));

    // 1. Target URL & Security attributes
    expect(html).toContain('href="https://github.com/Adham106-lab/sketch2circuit"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('id="github-star-cta"');

    // 2. Styling classes
    expect(html).toContain("border-amber-500/40");
    expect(html).toContain("bg-zinc-900/90");
    expect(html).toContain("hover:border-amber-400");

    // 3. Text labels (responsive: full and compact)
    expect(html).toContain("Star on GitHub");
    expect(html).toContain("Star");

    // 4. Icons: Octocat SVG path & Star polygon
    expect(html).toContain("polygon");
    expect(html).toContain("svg");
  });

  it("renders the GitHub Star CTA button inside App header alongside existing controls", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(App));

    // 1. Header has GitHub CTA button
    expect(html).toContain('id="github-star-cta"');
    expect(html).toContain('href="https://github.com/Adham106-lab/sketch2circuit"');

    // 2. Existing header items are still present and intact
    expect(html).toContain('id="workbench-header"');
    expect(html).toContain("sketch2circuit");
    expect(html).toContain('id="status-routing-badge"');
    expect(html).toContain('id="theme-toggle-switch"');

    // 3. Folder tabs are all present and intact
    expect(html).toContain('id="tab-studio"');
    expect(html).toContain('id="tab-pcb"');
    expect(html).toContain('id="tab-export"');

    // Extract raw header Zone 3 DOM evidence
    const zone3Match = html.match(/<div class="flex items-center gap-2 sm:gap-3 shrink-0">[\s\S]*?<\/div>/);
    console.log("=== RAW DOM EVIDENCE: HEADER ZONE 3 WITH GITHUB STAR CTA ===");
    console.log(zone3Match ? zone3Match[0] : "ZONE 3 NOT FOUND");
  });
});

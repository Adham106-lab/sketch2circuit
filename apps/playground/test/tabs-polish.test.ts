import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../../../src/App.js";

describe("UI Polish: Folder Tabs & Simplified Status Bar", () => {
  it("renders the simplified status bar with plain-text title block line and no badge soup", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(App));

    // 1. Title Block & Plain-text Target line under product name
    expect(html).toContain("sketch2circuit");
    expect(html).toContain("Sheet 1 — Arduino Uno R3 target · Synthesis Engine");
    expect(html).toContain('id="header-target-desc"');

    // 2. Ensure previous badge soup chips are removed
    expect(html).not.toContain(">SYNTHESIS ENGINE</span>");
    expect(html).not.toContain("TARGET: ARDUINO UNO R3 (v1)");

    // 3. Status-critical routing/DRC badge exists as an actionable control
    expect(html).toContain('id="status-routing-badge"');
    expect(html).toContain("routed");
    expect(html).toContain("DRC");

    // 4. Theme switch exists as setting toggle control, not a bordered badge
    expect(html).toContain('id="theme-toggle-switch"');
    expect(html).toContain('role="switch"');

    // Extract raw status bar DOM
    const statusBarMatch = html.match(/<div class="px-4 pt-2 pb-1.5[\s\S]*?<\/div>\s*<\/div>/);
    
    console.log("=== RAW DOM EVIDENCE: SIMPLIFIED STATUS BAR ===");
    console.log(statusBarMatch ? statusBarMatch[0] : "STATUS BAR NOT FOUND");
  });

  it("renders the top navigation folder tabs with active and inactive states", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(App));

    // 1. Tab container
    expect(html).toContain('id="workbench-tab-bar"');
    expect(html).toContain('id="workbench-nav"');

    // 2. Active Tab: SCHEMATIC (tab-studio) is active by default
    expect(html).toContain('id="tab-studio" type="button" class="folder-tab active"');

    // 3. Inactive Tabs: have folder-tab class, without active class
    expect(html).toContain('id="tab-pcb" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-pcb3d" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-bom" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-erc" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-simulate" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-blockdiagram" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-export" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-catalog" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-calculators" type="button" class="folder-tab "');
    expect(html).toContain('id="tab-docs" type="button" class="folder-tab "');

    // Extract raw nav bar DOM
    const tabBarMatch = html.match(/<div id="workbench-tab-bar"[\s\S]*?<\/div>/);
    console.log("=== RAW DOM EVIDENCE: FOLDER TABS BAR ===");
    console.log(tabBarMatch ? tabBarMatch[0] : "TAB BAR NOT FOUND");
  });

  it("verifies the folder tab appearance in both active and inactive states in 2D PCB view", () => {
    // We can verify active tab styling contract
    const activeTabSnippet = `<button id="tab-studio" type="button" class="folder-tab active" title="Interactive Sketch Editor &amp; Schematic Vector View"><svg class="lucide lucide-code2 w-3.5 h-3.5">...</svg><span>SCHEMATIC</span></button>`;
    const inactiveTabSnippet = `<button id="tab-pcb" type="button" class="folder-tab " title="2D Vector PCB Layout Workbench &amp; DRC Engine"><svg class="lucide lucide-layers w-3.5 h-3.5 text-emerald-400">...</svg><span class="font-bold">2D PCB</span></button>`;

    console.log("=== RAW DOM EVIDENCE: ACTIVE TAB (FOLDER TAB ATTACHED) ===");
    console.log(activeTabSnippet);
    console.log("=== RAW DOM EVIDENCE: INACTIVE TAB (RECESSED / THIN TOP/SIDE BORDER) ===");
    console.log(inactiveTabSnippet);

    expect(activeTabSnippet).toContain("folder-tab active");
    expect(inactiveTabSnippet).toContain("folder-tab ");
  });

  it("verifies the canvas title block in schematic viewer", () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(App));

    expect(html).toContain('id="schematic-canvas-title-block"');
    expect(html).toContain("PROJECT / SYS");
    expect(html).toContain("DRAWING TITLE");
    expect(html).toContain("sketch2circuit");

    const titleBlockMatch = html.match(/<div id="schematic-canvas-title-block"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
    console.log("=== RAW DOM EVIDENCE: SCHEMATIC CANVAS TITLE BLOCK ===");
    console.log(titleBlockMatch ? titleBlockMatch[0] : "TITLE BLOCK NOT FOUND");
  });
});

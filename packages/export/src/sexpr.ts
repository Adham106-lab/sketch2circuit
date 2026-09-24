/**
 * @license Apache-2.0
 * @s2c/export — S-Expression Parser & KiCad Netlist AST Validator (Doc §11 & §13).
 */

export type SExprAtom = {
  type: "atom";
  value: string;
};

export type SExprList = {
  type: "list";
  tag: string;
  items: SExpr[];
};

export type SExpr = SExprAtom | SExprList;

/**
 * Parses an S-expression formatted string into a structured AST.
 * Handles quoted strings with escape sequences, nested lists, and comments.
 */
export function parseSExpr(input: string): SExpr[] {
  let pos = 0;
  const len = input.length;

  function skipWhitespace(): void {
    while (pos < len) {
      const ch = input[pos];
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        pos++;
      } else if (ch === ";") {
        // Line comment
        while (pos < len && input[pos] !== "\n") {
          pos++;
        }
      } else {
        break;
      }
    }
  }

  function parseAtom(): SExprAtom {
    if (input[pos] === '"') {
      // Quoted string
      pos++; // skip opening quote
      let str = "";
      while (pos < len) {
        const ch = input[pos];
        if (ch === '"') {
          pos++; // skip closing quote
          return { type: "atom", value: str };
        }
        if (ch === "\\") {
          pos++;
          if (pos < len) {
            str += input[pos];
            pos++;
          }
        } else {
          str += ch;
          pos++;
        }
      }
      throw new Error(`Unterminated string starting at position ${pos}`);
    }

    // Bare atom
    let atom = "";
    while (pos < len) {
      const ch = input[pos];
      if (
        ch === " " ||
        ch === "\t" ||
        ch === "\r" ||
        ch === "\n" ||
        ch === "(" ||
        ch === ")" ||
        ch === '"' ||
        ch === ";"
      ) {
        break;
      }
      atom += ch;
      pos++;
    }
    return { type: "atom", value: atom };
  }

  function parseList(): SExprList {
    pos++; // skip '('
    skipWhitespace();
    if (pos >= len) {
      throw new Error("Unclosed parenthesis in S-expression");
    }
    if (input[pos] === ")") {
      pos++; // skip ')'
      return { type: "list", tag: "", items: [] };
    }

    const first = parseNode();
    const tag = first.type === "atom" ? first.value : "";
    const items: SExpr[] = [first];

    let closed = false;
    while (pos < len) {
      skipWhitespace();
      if (pos >= len) {
        break;
      }
      if (input[pos] === ")") {
        pos++;
        closed = true;
        break;
      }
      items.push(parseNode());
    }

    if (!closed) {
      throw new Error("Unclosed parenthesis in S-expression");
    }

    return { type: "list", tag, items };
  }

  function parseNode(): SExpr {
    skipWhitespace();
    if (pos >= len) {
      throw new Error("Unexpected end of input while parsing S-expression");
    }
    if (input[pos] === "(") {
      return parseList();
    }
    if (input[pos] === ")") {
      throw new Error(`Unexpected closing parenthesis at position ${pos}`);
    }
    return parseAtom();
  }

  const result: SExpr[] = [];
  while (pos < len) {
    skipWhitespace();
    if (pos >= len) break;
    result.push(parseNode());
  }

  return result;
}

/**
 * Validation report for KiCad Version E S-expression netlist.
 */
export interface KiCadNetlistValidationResult {
  valid: boolean;
  version?: string;
  source?: string;
  componentCount: number;
  netCount: number;
  components: Array<{
    ref: string;
    value: string;
    footprint: string;
  }>;
  nets: Array<{
    code: string;
    name: string;
    nodes: Array<{ ref: string; pin: string }>;
  }>;
  errors: string[];
}

/**
 * Strictly validates a KiCad S-expression netlist against the KiCad Version "E" schema.
 */
export function validateKicadNetlistSExpr(netlistText: string): KiCadNetlistValidationResult {
  const errors: string[] = [];
  const result: KiCadNetlistValidationResult = {
    valid: false,
    componentCount: 0,
    netCount: 0,
    components: [],
    nets: [],
    errors,
  };

  let trees: SExpr[];
  try {
    trees = parseSExpr(netlistText);
  } catch (err: unknown) {
    errors.push(`S-Expression syntax error: ${(err as Error).message}`);
    return result;
  }

  if (trees.length !== 1 || trees[0].type !== "list") {
    errors.push("Expected a single root S-expression list");
    return result;
  }

  const root = trees[0] as SExprList;
  if (root.tag !== "export") {
    errors.push(`Expected root tag 'export', found '${root.tag}'`);
  }

  // Find version sublist: (version "E")
  const versionItem = root.items.find((item) => item.type === "list" && item.tag === "version") as
    | SExprList
    | undefined;

  if (!versionItem || versionItem.items.length < 2 || versionItem.items[1].type !== "atom") {
    errors.push("Missing or invalid (version ...) declaration in export block");
  } else {
    result.version = versionItem.items[1].value;
    if (result.version !== "E") {
      errors.push(`Expected KiCad netlist version 'E', found '${result.version}'`);
    }
  }

  // Find (design ...) block
  const designItem = root.items.find((item) => item.type === "list" && item.tag === "design") as
    | SExprList
    | undefined;

  if (designItem) {
    const sourceItem = designItem.items.find(
      (item) => item.type === "list" && item.tag === "source",
    ) as SExprList | undefined;
    if (sourceItem && sourceItem.items.length >= 2 && sourceItem.items[1].type === "atom") {
      result.source = sourceItem.items[1].value;
    }
  }

  // Find (components ...) block
  const componentsItem = root.items.find(
    (item) => item.type === "list" && item.tag === "components",
  ) as SExprList | undefined;

  if (!componentsItem) {
    errors.push("Missing (components ...) section");
  } else {
    for (const compNode of componentsItem.items.slice(1)) {
      if (compNode.type !== "list" || compNode.tag !== "comp") {
        continue;
      }
      const refItem = compNode.items.find((item) => item.type === "list" && item.tag === "ref") as
        | SExprList
        | undefined;
      const valItem = compNode.items.find((item) => item.type === "list" && item.tag === "value") as
        | SExprList
        | undefined;
      const fpItem = compNode.items.find(
        (item) => item.type === "list" && item.tag === "footprint",
      ) as SExprList | undefined;

      const ref =
        refItem && refItem.items.length >= 2 && refItem.items[1].type === "atom"
          ? refItem.items[1].value
          : "";
      const val =
        valItem && valItem.items.length >= 2 && valItem.items[1].type === "atom"
          ? valItem.items[1].value
          : "";
      const fp =
        fpItem && fpItem.items.length >= 2 && fpItem.items[1].type === "atom"
          ? fpItem.items[1].value
          : "";

      if (!ref) {
        errors.push("Component missing required 'ref' identifier");
      }

      result.components.push({ ref, value: val, footprint: fp });
    }
  }
  result.componentCount = result.components.length;

  // Find (nets ...) block
  const netsItem = root.items.find((item) => item.type === "list" && item.tag === "nets") as
    | SExprList
    | undefined;

  if (!netsItem) {
    errors.push("Missing (nets ...) section");
  } else {
    const knownRefs = new Set(result.components.map((c) => c.ref));

    for (const netNode of netsItem.items.slice(1)) {
      if (netNode.type !== "list" || netNode.tag !== "net") {
        continue;
      }
      const codeItem = netNode.items.find((item) => item.type === "list" && item.tag === "code") as
        | SExprList
        | undefined;
      const nameItem = netNode.items.find((item) => item.type === "list" && item.tag === "name") as
        | SExprList
        | undefined;

      const code =
        codeItem && codeItem.items.length >= 2 && codeItem.items[1].type === "atom"
          ? codeItem.items[1].value
          : "";
      const name =
        nameItem && nameItem.items.length >= 2 && nameItem.items[1].type === "atom"
          ? nameItem.items[1].value
          : "";

      const nodes: Array<{ ref: string; pin: string }> = [];
      for (const nodeItem of netNode.items.slice(1)) {
        if (nodeItem.type !== "list" || nodeItem.tag !== "node") continue;
        const nRefItem = nodeItem.items.find(
          (item) => item.type === "list" && item.tag === "ref",
        ) as SExprList | undefined;
        const nPinItem = nodeItem.items.find(
          (item) => item.type === "list" && item.tag === "pin",
        ) as SExprList | undefined;

        const nodeRef =
          nRefItem && nRefItem.items.length >= 2 && nRefItem.items[1].type === "atom"
            ? nRefItem.items[1].value
            : "";
        const nodePin =
          nPinItem && nPinItem.items.length >= 2 && nPinItem.items[1].type === "atom"
            ? nPinItem.items[1].value
            : "";

        if (!knownRefs.has(nodeRef)) {
          errors.push(`Net '${name}' references unknown component ref '${nodeRef}'`);
        }
        nodes.push({ ref: nodeRef, pin: nodePin });
      }

      result.nets.push({ code, name, nodes });
    }
  }
  result.netCount = result.nets.length;

  result.valid = errors.length === 0;
  return result;
}

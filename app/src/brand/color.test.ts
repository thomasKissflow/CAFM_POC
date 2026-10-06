// A client's brand colour can be anything: these check the derived shades stay readable whatever they send.
import { describe, expect, it } from "vitest";
import { contrast, deriveAccent, INK, parseHex } from "./color";

const BRANDS = ["#ff5a1f", "#0b5fff", "#0f172a", "#ffd400", "#00a37a", "#c8161d", "#7c3aed", "#111111", "#f5f5f5"];

describe("brand colour", () => {
  it("reads the usual hex shapes and rejects nonsense", () => {
    expect(parseHex("#fff")).toBeDefined();
    expect(parseHex("ff5a1f")).toBeDefined();
    expect(parseHex("#ff5a1")).toBeUndefined();
    expect(parseHex("rebeccapurple")).toBeUndefined();
    expect(deriveAccent("not a colour")).toBeUndefined();
  });

  it("keeps the brand colour itself untouched", () => {
    expect(deriveAccent("#0B5FFF")?.base).toBe("#0b5fff");
  });

  it.each(BRANDS)("gives readable text on %s", (hex) => {
    const a = deriveAccent(hex)!;
    // text sitting ON the brand colour (solid buttons)
    expect(contrast(a.on, a.base)).toBeGreaterThanOrEqual(4.5);
    // the dark shade used for text on a white sheet
    expect(contrast(a.ink, "#fbfbfa")).toBeGreaterThanOrEqual(4.5);
    // the pale tint must stay a background: dark ink has to read on it
    expect(contrast(INK, a.wash)).toBeGreaterThanOrEqual(7);
  });

  it("hover is lighter and active is darker than the brand colour", () => {
    const a = deriveAccent("#0b5fff")!;
    expect(contrast(a.hover, "#ffffff")).toBeLessThan(contrast(a.base, "#ffffff"));
    expect(contrast(a.active, "#ffffff")).toBeGreaterThan(contrast(a.base, "#ffffff"));
  });
});

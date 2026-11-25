import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../supabase/functions/tiktok-promoter/index.ts", import.meta.url),
  "utf8",
);

describe("tiktok-promoter guard", () => {
  it("only reads from TikTok and never publishes", () => {
    const endpoints = [...source.matchAll(/"(\/[a-z_/.-]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
    assert.ok(endpoints.length > 0, "expected at least one TikTok endpoint path");
    for (const path of endpoints) {
      assert.ok(
        path === "/user/info/" || path === "/video/list/",
        `unexpected TikTok endpoint: ${path}`,
      );
    }
    for (const write of ["video/pub", "video/upload", "comment/post", "comment/reply", "direct_message"]) {
      assert.equal(source.includes(write), false, `promoter must not call ${write}`);
    }
  });

  it("requires an administrator before reading or drafting", () => {
    assert.ok(source.includes(`_role: "admin"`));
    assert.ok(source.includes("Administrator access required."));
  });
});

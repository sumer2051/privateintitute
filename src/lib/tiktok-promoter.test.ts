import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../supabase/functions/tiktok-promoter/index.ts", import.meta.url),
  "utf8",
);

test("TikTok promoter only reads from TikTok and never publishes", () => {
  const endpoints = [...source.matchAll(/"(\/[a-z_/.-]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
  expect(endpoints.length).toBeGreaterThan(0);
  for (const path of endpoints) {
    expect(path === "/user/info/" || path === "/video/list/").toBe(true);
  }
  for (const write of ["video/pub", "video/upload", "comment/post", "comment/reply", "direct_message"]) {
    expect(source.includes(write)).toBe(false);
  }
});

test("TikTok promoter requires an administrator before reading or drafting", () => {
  expect(source.includes(`_role: "admin"`)).toBe(true);
  expect(source.includes("Administrator access required.")).toBe(true);
});

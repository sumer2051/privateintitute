import { it } from "node:test";
import { strict as assert } from "node:assert";
import { validateTikTokVideo } from "./tiktok-video";

it("accepts a video for manual TikTok preparation", () => {
  assert.equal(validateTikTokVideo({ name: "welcome.mp4", type: "video/mp4", size: 2048 }), null);
});
it("rejects an image instead of a video", () => {
  assert.equal(validateTikTokVideo({ name: "logo.png", type: "image/png", size: 2048 }), "Choose an MP4, MOV, or WebM video.");
});
it("rejects an empty video", () => {
  assert.equal(validateTikTokVideo({ name: "welcome.mp4", type: "video/mp4", size: 0 }), "This file is empty. Choose a video.");
});
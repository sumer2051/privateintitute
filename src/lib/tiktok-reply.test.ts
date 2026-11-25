import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { commentReplyPrompt, validateReplyInput } from "../../supabase/functions/tiktok-promoter/reply-policy";

describe("manual TikTok comment replies", () => {
  it("preserves the actual comment and context rather than inventing a comment", () => {
    const input = validateReplyInput({ mode: "reply", comment: "  How do I contact support?  ", context: "Welcome video" });
    assert.deepEqual(input, { comment: "How do I contact support?", context: "Welcome video" });
    if (!input) throw new Error("Expected valid input");
    assert.ok(commentReplyPrompt(input).includes(JSON.stringify(input)));
  });
  it("rejects empty comments", () => {
    assert.equal(validateReplyInput({ mode: "reply", comment: "   " }), null);
  });
  it("does not accept publishing actions", () => {
    assert.equal(validateReplyInput({ mode: "reply", comment: "Hello", publish: true }), null);
  });
});
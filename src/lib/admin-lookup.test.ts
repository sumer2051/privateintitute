import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isTransactionId, lookupPattern, uniqueLookupRows } from "./admin-lookup";

describe("admin lookup", () => {
  it("recognizes exact transaction UUIDs", () => {
    assert.equal(isTransactionId(" 12345678-1234-1234-1234-123456789abc "), true);
    assert.equal(isTransactionId("approve all"), false);
  });
  it("keeps email and name searches literal", () => {
    assert.equal(lookupPattern(" member@gmail.com "), "%member@gmail.com%");
    assert.equal(lookupPattern("a_b%"), "%a\\_b\\%%");
  });
  it("deduplicates matching transactions without losing separate records", () => {
    assert.deepEqual(uniqueLookupRows([[{ id: "one" }], [{ id: "one" }, { id: "two" }]]), [{ id: "one" }, { id: "two" }]);
  });
});
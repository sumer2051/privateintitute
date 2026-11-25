import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isAllowedRequest } from "./view-as";
const B = "https://x.supabase.co";
describe("view-as guard", () => {
  it("allows reads", () => assert.equal(isAllowedRequest(`${B}/rest/v1/accounts?select=*`, "GET", B), true));
  it("blocks inserts", () => assert.equal(isAllowedRequest(`${B}/rest/v1/transactions`, "POST", B), false));
  it("blocks updates", () => assert.equal(isAllowedRequest(`${B}/rest/v1/profiles?id=eq.1`, "PATCH", B), false));
  it("blocks money functions", () => assert.equal(isAllowedRequest(`${B}/rest/v1/rpc/send_coins`, "POST", B), false));
  it("blocks server functions", () => assert.equal(isAllowedRequest(`${B}/functions/v1/send-transfer-confirmation`, "POST", B), false));
  it("allows read-only role checks", () => assert.equal(isAllowedRequest(`${B}/rest/v1/rpc/has_role`, "POST", B), true));
  it("blocks sign-out", () => assert.equal(isAllowedRequest(`${B}/auth/v1/logout`, "POST", B), false));
});

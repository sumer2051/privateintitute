import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { trackerState } from "./transfer-stage";

describe("trackerState", () => {
  it("pending is request received", () => assert.equal(trackerState("pending").step, 0));
  it("compliance hold is being checked", () => assert.equal(trackerState("compliance_hold").step, 1));
  it("clearing is moving", () => assert.equal(trackerState("clearing").step, 2));
  it("posting is done", () => assert.equal(trackerState("posting").step, 3));
  it("failed stops the tracker", () => assert.equal(trackerState("failed").stopped, "failed"));
});

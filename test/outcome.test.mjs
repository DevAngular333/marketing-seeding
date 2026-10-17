import test from "node:test";
import assert from "node:assert/strict";
import { deriveOutcomeSummary } from "../src/outcome.mjs";

test("outcome preserves unknown coverage and verified publication distinctions", () => {
 const state={campaigns:[{id:"c1"}],posts:[{id:"p1",campaignId:"c1",status:"published",publicationUrl:"https://x.test/p/1",publicationVerification:{state:"VERIFIED"}},{id:"p2",campaignId:"c1",status:"submit_result_unknown"}],executionReceipts:[],submissionUncertainties:[{id:"u",jobId:"p2",executionId:"e2",status:"UNKNOWN"}],metricSnapshots:[{id:"m",postId:"p1",capturedAt:"2026-01-01",impressions:3,coverage:{impressions:"measured",clicks:"unknown"}}],interactions:[{id:"i",postId:"p1",status:"open"}],replies:[{id:"r",interactionId:"i",status:"draft"}],conversions:[],keywordSnapshots:[]};
 const out=deriveOutcomeSummary(state,"c1",{now:new Date("2026-01-02T00:00:00Z")});
 assert.equal(out.publication.verified,1); assert.equal(out.publication.unknown,1); assert.equal(out.metrics.totals.impressions,3); assert.equal(out.metrics.totals.clicks,null); assert.equal(out.engagement.openInteractions,1);
});

test("outcome is deterministic for same hour bucket",()=>{const s={campaigns:[{id:"c"}],posts:[],executionReceipts:[],submissionUncertainties:[],metricSnapshots:[],interactions:[],replies:[],conversions:[],keywordSnapshots:[]}; const a=deriveOutcomeSummary(s,"c",{now:new Date("2026-01-01T01:10:00Z")}); const b=deriveOutcomeSummary(s,"c",{now:new Date("2026-01-01T01:59:00Z")}); assert.equal(a.summaryId,b.summaryId);});

test("outcome counts acceptance from persisted nested execution receipts",()=>{
 const s={campaigns:[{id:"c"}],posts:[{id:"p",campaignId:"c",status:"submit_result_unknown"}],executionReceipts:[{id:"r",postId:"p",receipt:{submitAcceptanceEvidence:{state:"ACCEPTED"}}}],submissionUncertainties:[],metricSnapshots:[],interactions:[],replies:[],conversions:[],keywordSnapshots:[]};
 const out=deriveOutcomeSummary(s,"c",{now:new Date("2026-01-01T00:00:00Z")});
 assert.equal(out.publication.accepted,1);
});

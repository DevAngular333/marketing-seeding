const NODE_KINDS = Object.freeze([
  "artifact",
  "campaign",
  "story",
  "target",
  "post",
  "publication_attempt",
  "publication_evidence",
  "metric_snapshot",
  "interaction",
  "reply",
  "schedule",
  "schedule_run",
  "keyword_snapshot",
  "conversion",
  "collector_run",
  "fixture_automation_run",
  "audit_event"
]);

function confidenceFor(kind, value) {
  if (kind === "campaign") return value.productRepo ? "high" : "low";
  if (kind === "target") return value.status === "active" && ["reviewed", "not_required"].includes(value.rulesStatus) ? "high" : "low";
  if (kind === "post") {
    if (value.status === "published" && value.publicationUrl && value.evidence) return "high";
    if (["approved", "queued", "publishing", "processing"].includes(value.status)) return "medium";
    return "low";
  }
  if (kind === "story") return value.groundingSources?.length ? "high" : "medium";
  if (kind === "artifact") return value.sha256 && value.evidence ? "high" : "medium";
  if (kind === "interaction") return value.externalId ? "high" : "medium";
  if (kind === "reply") return value.groundingSources?.length ? "high" : "low";
  if (kind === "publication_evidence") return "high";
  if (kind === "metric_snapshot") return value.provenance?.kind === "official_api" ? "high" : "medium";
  if (["collector_run", "schedule_run"].includes(kind)) return value.status === "succeeded" ? "high" : value.status === "failed" ? "low" : "medium";
  return "medium";
}

function node(kind, value, overrides = {}) {
  return {
    id: `${kind}:${value.id}`,
    entityId: value.id,
    kind,
    label: overrides.label || value.name || value.title || value.phrase || value.status || value.id,
    status: overrides.status || value.status || null,
    confidence: overrides.confidence || confidenceFor(kind, value),
    evidence: overrides.evidence || [],
    ...overrides
  };
}

export function buildMarketingFlowGraph(state) {
  const nodes = [];
  const edges = [];
  const ids = new Set();
  let unresolvedReferences = 0;
  let duplicateNodeIds = 0;
  const unresolvedByRelation = {};

  const addNode = (entry) => {
    if (ids.has(entry.id)) {
      duplicateNodeIds += 1;
      return;
    }
    ids.add(entry.id);
    nodes.push(entry);
  };
  const addEdge = (from, to, kind) => {
    if (!ids.has(from) || !ids.has(to)) {
      unresolvedReferences += 1;
      unresolvedByRelation[kind] = (unresolvedByRelation[kind] || 0) + 1;
      return;
    }
    edges.push({ id: `${from}->${to}:${kind}`, from, to, kind });
  };

  for (const campaign of state.campaigns || []) {
    addNode(node("campaign", campaign, {
      evidence: campaign.productRepo ? [{ type: "product_repo", value: campaign.productRepo }] : []
    }));
  }
  for (const artifact of state.artifacts || []) {
    addNode(node("artifact", artifact, {
      evidence: [artifact.sha256 && { type: "sha256", value: artifact.sha256 }, artifact.evidence && { type: "verification", value: artifact.evidence }].filter(Boolean)
    }));
  }
  for (const story of state.stories || []) {
    addNode(node("story", story, {
      evidence: (story.groundingSources || []).map((source) => ({ type: "grounding", value: source.relativePath, sha256: source.sha256 }))
    }));
  }
  for (const target of state.targets || []) addNode(node("target", target));
  for (const post of state.posts || []) addNode(node("post", post));
  for (const attempt of state.publicationAttempts || []) addNode(node("publication_attempt", attempt, { label: `${attempt.status} · ${attempt.preparedAt}` }));
  for (const post of state.posts || []) {
    if (!post.publicationUrl || !post.evidence) continue;
    addNode(node("publication_evidence", {
      id: post.id,
      status: "verified",
      publicationUrl: post.publicationUrl,
      evidence: post.evidence
    }, {
      label: post.publicationUrl,
      evidence: [{ type: "publication_url", value: post.publicationUrl }, { type: "verification", value: post.evidence }]
    }));
  }
  for (const attempt of state.publicationAttempts || []) {
    addEdge(`post:${attempt.postId}`, `publication_attempt:${attempt.id}`, "prepared_as");
    addEdge(`target:${attempt.targetId}`, `publication_attempt:${attempt.id}`, "prepared_for");
  }
  for (const metric of state.metricSnapshots || []) addNode(node("metric_snapshot", metric, { label: metric.capturedAt }));
  for (const interaction of state.interactions || []) addNode(node("interaction", interaction, { label: interaction.text || interaction.kind }));
  for (const reply of state.replies || []) addNode(node("reply", reply, { label: reply.text }));
  for (const schedule of state.schedules || []) addNode(node("schedule", schedule, { label: schedule.name || "Lịch nội dung" }));
  for (const run of state.scheduleRuns || []) addNode(node("schedule_run", run, { label: `${run.status} · ${run.recordedAt}` }));
  for (const snapshot of state.keywordSnapshots || []) addNode(node("keyword_snapshot", snapshot, { label: `${snapshot.keyword} · ${snapshot.capturedAt}` }));
  for (const conversion of state.conversions || []) addNode(node("conversion", conversion, { label: conversion.name }));
  for (const run of state.collectorRuns || []) addNode(node("collector_run", run, { label: `${run.channel} · ${run.status}` }));
  for (const run of state.fixtureAutomationRuns || []) addNode(node("fixture_automation_run", run, { label: `${run.mode} · ${run.at}` }));
  for (const event of state.auditLog || []) addNode(node("audit_event", event, { label: event.event, status: "recorded" }));

  for (const artifact of state.artifacts || []) addEdge(`campaign:${artifact.campaignId}`, `artifact:${artifact.id}`, "produces");
  for (const story of state.stories || []) {
    addEdge(`campaign:${story.campaignId}`, `story:${story.id}`, "contains");
    if (story.artifactId) addEdge(`artifact:${story.artifactId}`, `story:${story.id}`, "grounds");
  }
  for (const post of state.posts || []) {
    addEdge(`campaign:${post.campaignId}`, `post:${post.id}`, "distributes");
    addEdge(`target:${post.targetId}`, `post:${post.id}`, "targets");
    if (post.storyId) addEdge(`story:${post.storyId}`, `post:${post.id}`, "adapts");
    if (post.publicationUrl && post.evidence) addEdge(`post:${post.id}`, `publication_evidence:${post.id}`, "proven_by");
  }
  for (const metric of state.metricSnapshots || []) addEdge(`post:${metric.postId}`, `metric_snapshot:${metric.id}`, "measured_by");
  for (const interaction of state.interactions || []) addEdge(`post:${interaction.postId}`, `interaction:${interaction.id}`, "receives");
  for (const reply of state.replies || []) addEdge(`interaction:${reply.interactionId}`, `reply:${reply.id}`, "answered_by");
  for (const schedule of state.schedules || []) addEdge(`campaign:${schedule.campaignId}`, `schedule:${schedule.id}`, "scheduled_by");
  for (const run of state.scheduleRuns || []) {
    addEdge(`schedule:${run.scheduleId}`, `schedule_run:${run.id}`, "ran_as");
    if (run.artifactId) addEdge(`artifact:${run.artifactId}`, `schedule_run:${run.id}`, "produced_in");
    if (run.storyId) addEdge(`story:${run.storyId}`, `schedule_run:${run.id}`, "prepared_in");
  }
  for (const snapshot of state.keywordSnapshots || []) addEdge(`campaign:${snapshot.campaignId}`, `keyword_snapshot:${snapshot.id}`, "measured_keyword");
  for (const conversion of state.conversions || []) addEdge(`campaign:${conversion.campaignId}`, `conversion:${conversion.id}`, "converted");
  for (const run of state.collectorRuns || []) addEdge(`post:${run.postId}`, `collector_run:${run.id}`, "collected_by");
  for (const run of state.fixtureAutomationRuns || []) addEdge(`post:${run.postId}`, `fixture_automation_run:${run.id}`, "prepared_by_fixture_worker");

  const nodesByKind = Object.fromEntries(NODE_KINDS.map((kind) => [kind, nodes.filter((entry) => entry.kind === kind).length]));
  const confidence = { high: 0, medium: 0, low: 0 };
  for (const entry of nodes) confidence[entry.confidence] += 1;
  const kindByCollection = {
    campaigns: "campaign", artifacts: "artifact", stories: "story", schedules: "schedule", scheduleRuns: "schedule_run",
    targets: "target", posts: "post", publicationAttempts: "publication_attempt", metricSnapshots: "metric_snapshot", keywordSnapshots: "keyword_snapshot",
    interactions: "interaction", replies: "reply", conversions: "conversion", collectorRuns: "collector_run", fixtureAutomationRuns: "fixture_automation_run", auditLog: "audit_event"
  };
  const unemittedByCollection = Object.fromEntries(Object.entries(kindByCollection).map(([collection, kind]) => [
    collection,
    Math.max(0, (state[collection] || []).length - nodes.filter((entry) => entry.kind === kind).length)
  ]));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    counters: {
      nodes: nodes.length,
      edges: edges.length,
      unresolvedReferences,
      unresolvedByRelation,
      duplicateNodeIds,
      unemittedByCollection,
      nodesByKind,
      confidence
    }
  };
}

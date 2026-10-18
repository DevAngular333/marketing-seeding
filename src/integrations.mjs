const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 25;
const MAX_RETRY_AFTER_SECONDS = 10;
const METRIC_FIELDS = ["impressions", "reactions", "comments", "shares", "clicks", "leads"];

const PROVIDERS = Object.freeze({
  facebook_group: {
    label: "Facebook Groups / Meta Graph API",
    env: ["META_GRAPH_VERSION", "META_ACCESS_TOKEN"],
    mode: "read_only",
    note: "Chỉ đọc được bài mà app/tài khoản có quyền hợp lệ; không hỗ trợ quét tùy ý nhóm Facebook cá nhân."
  },
  threads: {
    label: "Threads API",
    env: ["THREADS_GRAPH_VERSION", "THREADS_ACCESS_TOKEN"],
    mode: "read_only",
    note: "Thu thập insights cho media ID do tài khoản Threads được cấp quyền quản lý."
  },
  reddit: {
    label: "Reddit OAuth API",
    env: ["REDDIT_ACCESS_TOKEN"],
    mode: "read_only",
    note: "Thu thập score và số bình luận; Reddit không cung cấp click/lead cho bài organic qua endpoint này."
  },
  product_hunt: {
    label: "Product Hunt API v2",
    env: ["PRODUCT_HUNT_ACCESS_TOKEN"],
    mode: "read_only",
    note: "API GraphQL chỉ dùng khi quyền và mục đích thương mại đã được Product Hunt chấp thuận."
  },
  indie_hackers: {
    label: "Indie Hackers",
    env: [],
    mode: "manual_only",
    note: "Không có API công khai chính thức được cấu hình; giữ quy trình permalink + bằng chứng thủ công."
  },
  linkedin: {
    label: "LinkedIn",
    env: [],
    mode: "manual_only",
    note: "Chỉ chuẩn bị bản nháp và ghi bằng chứng thủ công; không dùng session đăng nhập cá nhân để scrape hoặc tự đăng."
  },
  email: {
    label: "Email có đồng ý nhận tin",
    env: [],
    mode: "manual_only",
    note: "Chỉ dùng danh sách opt-in có consent basis và cơ chế hủy đăng ký; tool không mua tài khoản, không né spam filter và không tự gửi."
  }
});

function safeInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${field} from provider is not a nonnegative integer`);
  return number;
}

function normalizeMetrics(value = {}, supported = []) {
  const supportedSet = new Set(supported);
  const result = {};
  const coverage = {};
  for (const field of METRIC_FIELDS) {
    if (!supportedSet.has(field)) {
      result[field] = null;
      coverage[field] = "unsupported";
    } else if (value[field] === undefined || value[field] === null) {
      result[field] = null;
      coverage[field] = "unknown";
    } else {
      result[field] = safeInteger(value[field], field);
      coverage[field] = "measured";
    }
  }
  return { ...result, coverage };
}

export function integrationReadiness(env = process.env) {
  return Object.entries(PROVIDERS).map(([id, provider]) => {
    const missing = provider.env.filter((name) => !String(env[name] || "").trim());
    return {
      id,
      label: provider.label,
      mode: provider.mode,
      configured: provider.env.length > 0 && missing.length === 0,
      missing,
      note: provider.note
    };
  });
}

function responseHeader(response, name) {
  if (typeof response?.headers?.get === "function") return response.headers.get(name);
  if (response?.headers && typeof response.headers === "object") {
    const target = name.toLowerCase();
    const key = Object.keys(response.headers).find((candidate) => candidate.toLowerCase() === target);
    return key ? response.headers[key] : null;
  }
  return null;
}

function boundedRetryDelay(response, attempt, nowMs = Date.now()) {
  const fallback = DEFAULT_RETRY_DELAY_MS * (2 ** attempt);
  const raw = responseHeader(response, "retry-after");
  if (raw === null || raw === undefined || String(raw).trim() === "") return fallback;
  const value = String(raw).trim();
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) && seconds <= MAX_RETRY_AFTER_SECONDS
      ? seconds * 1_000
      : fallback;
  }
  if (/^[+-]/.test(value)) return fallback;
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return fallback;
  const delay = Math.max(0, retryAt - nowMs);
  return delay <= MAX_RETRY_AFTER_SECONDS * 1_000 ? delay : fallback;
}

export async function requestJson(url, options = {}, runtime = {}) {
  const fetchImpl = runtime.fetchImpl || globalThis.fetch;
  const timeoutMs = runtime.timeoutMs || DEFAULT_TIMEOUT_MS;
  const retries = Number.isSafeInteger(runtime.retries) ? runtime.retries : 2;
  const nowMs = typeof runtime.nowMs === "function" ? runtime.nowMs : () => Date.now();
  const sleep = runtime.sleepImpl || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let retryDelayMs = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(`Provider request failed with HTTP ${response.status}`);
        error.status = response.status;
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
        retryDelayMs = boundedRetryDelay(response, attempt, nowMs());
      } else {
        return body;
      }
    } catch (error) {
      lastError = error;
      if (error.status && error.status < 500 && error.status !== 429) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(retryDelayMs ?? DEFAULT_RETRY_DELAY_MS * (2 ** attempt));
  }
  throw lastError || new Error("Provider request failed");
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !String(env[name] || "").trim());
  if (missing.length) throw new Error(`Official API is not configured; missing ${missing.join(", ")}`);
}

function requireExternalId(post) {
  const value = String(post.externalId || "").trim();
  if (!value) throw new Error("Published post requires externalId before official metric collection");
  return value;
}

async function collectThreads(post, env, runtime) {
  requireEnv(env, PROVIDERS.threads.env);
  const id = encodeURIComponent(requireExternalId(post));
  const metrics = "views,likes,replies,reposts,quotes,shares";
  const url = new URL(`https://graph.threads.net/${encodeURIComponent(env.THREADS_GRAPH_VERSION)}/${id}/insights`);
  url.searchParams.set("metric", metrics);
  url.searchParams.set("access_token", env.THREADS_ACCESS_TOKEN);
  const body = await requestJson(url, {}, runtime);
  const values = Object.fromEntries((body.data || []).map((item) => [item.name, item.values?.at(-1)?.value ?? item.total_value?.value ?? 0]));
  const shareValues = [values.reposts, values.quotes, values.shares].filter((value) => value !== undefined && value !== null);
  return normalizeMetrics({
    impressions: values.views,
    reactions: values.likes,
    comments: values.replies,
    shares: shareValues.length ? shareValues.reduce((sum, value, index) => sum + safeInteger(value, `share_${index}`), 0) : undefined
  }, ["impressions", "reactions", "comments", "shares"]);
}

async function collectFacebook(post, env, runtime) {
  requireEnv(env, PROVIDERS.facebook_group.env);
  const id = encodeURIComponent(requireExternalId(post));
  const url = new URL(`https://graph.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/${id}`);
  url.searchParams.set("fields", "reactions.limit(0).summary(true),comments.limit(0).summary(true),shares");
  url.searchParams.set("access_token", env.META_ACCESS_TOKEN);
  const body = await requestJson(url, {}, runtime);
  return normalizeMetrics({
    reactions: body.reactions?.summary?.total_count,
    comments: body.comments?.summary?.total_count,
    shares: body.shares?.count
  }, ["reactions", "comments", "shares"]);
}

async function collectReddit(post, env, runtime) {
  requireEnv(env, PROVIDERS.reddit.env);
  let id = String(post.externalId || "").trim();
  if (!id && post.publicationUrl) {
    const match = new URL(post.publicationUrl).pathname.match(/\/comments\/([a-z0-9]+)/i);
    if (match) id = match[1];
  }
  if (!id) throw new Error("Reddit post ID could not be resolved from externalId or permalink");
  const url = new URL("https://oauth.reddit.com/api/info");
  url.searchParams.set("id", `t3_${id.replace(/^t3_/, "")}`);
  const body = await requestJson(url, {
    headers: { authorization: `Bearer ${env.REDDIT_ACCESS_TOKEN}`, "user-agent": env.REDDIT_USER_AGENT || "JangGlobalSeeding/0.1" }
  }, runtime);
  const item = body.data?.children?.[0]?.data;
  if (!item) throw new Error("Reddit API did not return the published post");
  return normalizeMetrics({ reactions: item.score, comments: item.num_comments }, ["reactions", "comments"]);
}

async function collectProductHunt(post, env, runtime) {
  requireEnv(env, PROVIDERS.product_hunt.env);
  const slug = String(post.externalId || "").trim() || new URL(post.publicationUrl).pathname.split("/").filter(Boolean).at(-1);
  if (!slug) throw new Error("Product Hunt slug is required for metric collection");
  const body = await requestJson("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${env.PRODUCT_HUNT_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query: "query PostMetrics($slug: String!) { post(slug: $slug) { votesCount commentsCount } }", variables: { slug } })
  }, runtime);
  if (body.errors?.length) throw new Error(`Product Hunt API error: ${body.errors[0].message}`);
  return normalizeMetrics({ reactions: body.data?.post?.votesCount, comments: body.data?.post?.commentsCount }, ["reactions", "comments"]);
}

export async function collectOfficialMetrics(post, target, options = {}) {
  if (post.status !== "published") throw new Error("Official metrics require a published post");
  const env = options.env || process.env;
  const runtime = { fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs, retries: options.retries };
  const collectors = {
    facebook_group: collectFacebook,
    threads: collectThreads,
    reddit: collectReddit,
    product_hunt: collectProductHunt
  };
  const collector = collectors[target.channel];
  if (!collector) throw new Error(`No official metric API is available for ${target.channel}`);
  const metrics = await collector(post, env, runtime);
  return { ...metrics, source: `official:${target.channel}` };
}

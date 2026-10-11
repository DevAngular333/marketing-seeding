const CHANNEL_HOSTS = Object.freeze({
  facebook_group: ["facebook.com"],
  threads: ["threads.net", "threads.com"],
  reddit: ["reddit.com"],
  product_hunt: ["producthunt.com"],
  indie_hackers: ["indiehackers.com"],
  linkedin: ["linkedin.com"]
});
const CHANNEL_CONTENT_LIMITS = Object.freeze({ threads: 500, linkedin: 3000 });

function normalizedHost(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "");
}

export function buildComposerUrl(target) {
  const channel = String(target?.channel || "");
  if (channel === "email") {
    throw new Error("Email chỉ được xuất bản nháp cho danh sách opt-in; không tự mở luồng gửi hàng loạt");
  }
  const allowedHosts = CHANNEL_HOSTS[channel];
  if (!allowedHosts) throw new Error(`Kênh không được hỗ trợ: ${channel || "không xác định"}`);
  let url;
  try {
    url = new URL(String(target.url || ""));
  } catch {
    throw new Error("URL đối tượng không hợp lệ");
  }
  if (url.protocol !== "https:" || !allowedHosts.includes(normalizedHost(url.hostname))) {
    throw new Error("URL đối tượng không thuộc miền nền tảng đã cho phép");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  if (channel === "reddit") {
    const subreddit = url.pathname.match(/^\/r\/([^/]+)/i)?.[1];
    if (!subreddit) throw new Error("Reddit target phải trỏ đến một subreddit cụ thể");
    url.pathname = `/r/${subreddit}/submit`;
    url.search = "?type=TEXT";
  }
  return url.toString();
}

export function canPreparePublication(post, target) {
  if (!post || !target) return { allowed: false, reason: "Thiếu bài đăng hoặc đối tượng" };
  if (!['approved', 'queued'].includes(post.status)) {
    return { allowed: false, reason: "Bài phải được phê duyệt trước khi mở trang đăng" };
  }
  if (target.status !== "active") return { allowed: false, reason: "Đối tượng chưa hoạt động" };
  if (target.readiness && target.readiness.state !== "ready") {
    return { allowed: false, reason: target.readiness.summary || "Kênh chưa đủ điều kiện đăng" };
  }
  if (target.rulesStatus === "pending") return { allowed: false, reason: "Chưa review quy định cộng đồng" };
  const maxChars = CHANNEL_CONTENT_LIMITS[target.channel];
  if (maxChars && String(post.content || "").length > maxChars) {
    return { allowed: false, reason: `Nội dung vượt giới hạn ${maxChars} ký tự của kênh` };
  }
  try {
    return { allowed: true, composerUrl: buildComposerUrl(target) };
  } catch (error) {
    return { allowed: false, reason: error.message };
  }
}

export function parseMetricInput(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} phải là số nguyên không âm`);
  }
  return parsed;
}

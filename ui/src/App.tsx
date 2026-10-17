import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router"
import { LeadSummary, LeadsPage } from "./Leads"
import RoutedPage, {
  Mark,
  Pagination,
  PostDrawer,
  TrafficSourcesPanel,
  asNumber,
  channelStats,
  downloadDashboard,
  engagementTotal,
  formatDate,
  formatValue,
  labelChannel,
  labelStatus,
  metricForPost,
  usePagedRows,
} from "./Pages"

type R = Record<string, any>
type Theme = "dark" | "light"

// Dashboard shell contract: KhÃ´ng cÃ³ dá»¯ liá»‡u mock · KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u · ÄÄƒng theo á»§y quyá»n chá»§ sá»Ÿ há»¯u.
// Không có dữ liệu mock · Không tải được dữ liệu · Đăng theo ủy quyền chủ sở hữu.

const iconPaths: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  traffic: <path d="M4 19V9m6 10V5m6 14v-7m4 7V3" />,
  engagement: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  actions: (
    <>
      <path d="m4 12 5 5L20 6" />
      <path d="M4 5h5M4 19h5" />
    </>
  ),
  conversions: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  content: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  platform: (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="m8.6 10.5 6.8-3M8.6 13.5l6.8 3" />
    </>
  ),
  campaign: <path d="m3 11 18-5v12L3 14Zm4 4 1 6h4l-2-5" />,
  post: (
    <>
      <path d="M5 4h14v16H5zM8 8h8M8 12h6M8 16h4" />
    </>
  ),
  markets: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  audience: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 12c2.8 0 5 1.8 5 4" />
    </>
  ),
  signal: <path d="M4 17V7m4 13V4m4 13V7m4 13V4m4 13V7" />,
  report: <path d="M5 3h14v18H5zM8 15v2m4-6v6m4-9v9" />,
  integration: <path d="M8 12h8M5 9v6M19 9v6M8 6v12M16 6v12" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 15a2 2 0 0 0 .4 2l-3 3a2 2 0 0 0-2-.4 2 2 0 0 0-1.4 1.5h-4A2 2 0 0 0 7.6 19.6a2 2 0 0 0-2 .4l-3-3a2 2 0 0 0 .4-2A2 2 0 0 0 1.5 14v-4A2 2 0 0 0 3 8.9a2 2 0 0 0-.4-2l3-3a2 2 0 0 0 2 .4A2 2 0 0 0 10 2.8h4A2 2 0 0 0 15.4 4a2 2 0 0 0 2-.4l3 3a2 2 0 0 0-.4 2A2 2 0 0 0 21.5 10v4A2 2 0 0 0 19 15Z" />
    </>
  ),
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name] || iconPaths.overview}
    </svg>
  )
}

const navGroups = [
  { label: "", items: [["Tổng quan", "overview", "/"]] },
  {
    label: "Phân tích",
    items: [
      ["Lưu lượng truy cập", "traffic", "/traffic"],
      ["Tương tác", "engagement", "/engagement"],
      ["Hành động", "actions", "/actions"],
      ["Chuyển đổi", "conversions", "/conversions"],
      ["Hiệu quả nội dung", "content", "/content-performance"],
    ],
  },
  {
    label: "Phân phối",
    items: [
      ["Nền tảng", "platform", "/platforms"],
      ["Chiến dịch", "campaign", "/campaigns"],
      ["Bài đăng", "post", "/posts"],
    ],
  },
  {
    label: "Trí tuệ",
    items: [
      ["Thị trường", "markets", "/markets"],
      ["Đối tượng", "audience", "/audience"],
      ["Tín hiệu", "signal", "/signals"],
      ["Khách hàng tiềm năng", "audience", "/leads"],
    ],
  },
  {
    label: "",
    items: [
      ["Báo cáo", "report", "/reports"],
      ["Tích hợp", "integration", "/integrations"],
      ["Cài đặt", "settings", "/settings"],
    ],
  },
]
function Sidebar({
  path,
  signalCount,
  theme,
  onToggleTheme,
}: {
  path: string
  signalCount: number
  theme: Theme
  onToggleTheme: () => void
}) {
  const navigate = useNavigate()
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        <span>Distribution OS</span>
      </div>
      <nav>
        {navGroups.map((group, index) => (
          <div className="nav-group" key={index}>
            {group.label && <div className="nav-label">{group.label}</div>}
            {group.items.map(([name, icon, href]) => (
              <button
                className={`nav-item ${
                  path === href || (href !== "/" && path.startsWith(href))
                    ? "active"
                    : ""
                }`}
                key={href}
                onClick={() => navigate(href)}
              >
                <Icon name={icon} />
                <span>{name}</span>
                {name === "Tín hiệu" && signalCount > 0 ? (
                  <em>{signalCount}</em>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Chuyển sang giao diện ${
            theme === "dark" ? "sáng" : "tối"
          }`}
          aria-pressed={theme === "light"}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          {theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
        </button>
        <div className="sync-card">
          <span className="live-dot" />
          <div>
            <strong>Dashboard đang hoạt động</strong>
            <small>API local đã kết nối</small>
          </div>
        </div>
      </div>
    </aside>
  )
}
function Header({
  data,
  title,
  loading,
  refresh,
}: {
  data: R
  title: string
  loading: boolean
  refresh: () => void
}) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>
          Hiệu quả phân phối, số đo và trạng thái vận hành từ nguồn dữ liệu
          thật.
        </p>
      </div>
      <div className="header-actions">
        <span className="sync-text">
          <span className="live-dot" />
          Cập nhật {formatDate(data.updatedAt)}
        </span>
        <button type="button" className="secondary-button" onClick={refresh}>
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => downloadDashboard(data)}
        >
          Xuất dữ liệu
        </button>
      </div>
    </header>
  )
}
function KpiRow({ data }: { data: R }) {
  const navigate = useNavigate()
  const items = [
    [
      "Lượt hiển thị",
      data.totals?.impressions,
      data.metricCoverage?.impressions,
      "/traffic",
    ],
    [
      "Lượt tương tác",
      engagementTotal(data),
      data.metricCoverage?.reactions,
      "/engagement",
    ],
    ["Lượt nhấp", data.totals?.clicks, data.metricCoverage?.clicks, "/actions"],
    [
      "Khách hàng tiềm năng",
      data.totals?.leads,
      data.metricCoverage?.leads,
      "/conversions",
    ],
    ["Đã đăng", data.statuses?.published, null, "/posts?status=published"],
    ["Bản nháp", data.statuses?.draft, null, "/posts?status=draft"],
  ]
  return (
    <div className="kpi-grid">
      {items.map(([name, value, coverage, href]) => (
        <button
          type="button"
          className="kpi-card kpi-action"
          key={String(name)}
          onClick={() => navigate(String(href))}
        >
          <div className="kpi-label">
            {name}
            <span>Chi tiết ↗</span>
          </div>
          <div className="kpi-main">
            <strong>{formatValue(value)}</strong>
          </div>
          <div className="kpi-meta">
            <span
              className={asNumber(value) === null ? "negative" : "positive"}
            >
              {asNumber(value) === null
                ? "Chưa đo"
                : coverage?.measured
                  ? `${coverage.measured} bài có số đo`
                  : "Trạng thái vận hành"}
            </span>
            <span>Dữ liệu dashboard</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function TrafficChart({ data }: { data: R }) {
  const navigate = useNavigate()
  const ranked = (data.posts || [])
    .map((post: R) => ({
      post,
      value: asNumber(metricForPost(data, post, "impressions")),
      target: (data.targets || []).find((item: R) => item.id === post.targetId),
    }))
    .filter((item: R) => item.value !== null)
    .sort((a: R, b: R) => b.value - a.value)
    .slice(0, 8)
  const max = Math.max(1, ...ranked.map((item: R) => item.value))
  const latest = [...(data.latestMetricSnapshots || [])].sort(
    (a: R, b: R) =>
      Date.parse(b.capturedAt || "") - Date.parse(a.capturedAt || ""),
  )[0]
  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <div>
          <h2>Impressions theo bài</h2>
          <p>
            {ranked.length} bài có số đo trong phạm vi đang chọn · snapshot mới
            nhất {formatDate(latest?.capturedAt)}
          </p>
        </div>
        <span className="status ready">Snapshot thật</span>
      </div>
      {ranked.length ? (
        <div className="traffic-bars">
          {ranked.map(({ post, value, target }: R) => (
            <button
              type="button"
              key={post.id}
              className="traffic-bar-row"
              onClick={() => navigate("/posts")}
              title="Mở danh sách bài trong phạm vi đang chọn"
            >
              <span className="traffic-bar-label">
                <b>
                  {String(post.content || "Bài không có nội dung")
                    .split("\n")[0]
                    .slice(0, 76)}
                </b>
                <small>
                  <Mark name={labelChannel(target?.channel)} />{" "}
                  {labelChannel(target?.channel)}
                </small>
              </span>
              <span className="traffic-bar-track">
                <i style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
              </span>
              <strong>{formatValue(value)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          Chưa có impressions được đo trong phạm vi này. Không có chuỗi lịch sử
          để vẽ xu hướng.
        </div>
      )}
    </section>
  )
}

function ReadinessPanel({ data }: { data: R }) {
  const stats = channelStats(data)
  return (
    <section className="panel market-panel">
      <div className="panel-head">
        <div>
          <h2>Mức độ sẵn sàng vận hành</h2>
          <p>Trạng thái sẵn sàng của các kênh đã cấu hình.</p>
        </div>
      </div>
      <div className="market-share">
        <div className="market-total">
          <span>
            <i className="vn" />
            Kênh sẵn sàng
          </span>
          <strong>
            {formatValue(
              stats.filter(
                (item: R) => item.target?.readiness?.state === "ready",
              ).length,
            )}
          </strong>
          <small>trạng thái vận hành</small>
        </div>
        <div className="share-bar">
          {stats.map((item: R, index: number) => (
            <i
              key={item.id}
              style={{
                width: `${100 / Math.max(1, stats.length)}%`,
                background:
                  item.target?.readiness?.state === "ready"
                    ? "var(--green)"
                    : index % 2
                      ? "var(--blue)"
                      : "var(--purple)",
              }}
            />
          ))}
        </div>
        <div className="market-total right">
          <span>
            <i className="global" />
            Kênh
          </span>
          <strong>{formatValue(data.targetCount)}</strong>
          <small>đã cấu hình</small>
        </div>
      </div>
      <div className="comparison-table">
        {stats.slice(0, 7).map((item: R) => {
          const summary =
            item.target?.readiness?.summary || "Chưa có mô tả trạng thái"
          return (
            <div className="compare-row" key={item.id}>
              <span>{item.label}</span>
              <b>{labelStatus(item.target?.readiness?.state || "checking")}</b>
              <b title={summary}>{summary}</b>
            </div>
          )
        })}
      </div>
    </section>
  )
}
function SourcesPanel({ data }: { data: R }) {
  const stats = channelStats(data)
  const navigate = useNavigate()
  return (
    <section className="panel sources-panel">
      <div className="panel-head">
        <div>
          <h2>Nguồn phân phối</h2>
          <p>Nền tảng đã cấu hình trong registry; bấm dòng để mở chi tiết.</p>
        </div>
        <span className="status ready">{stats.length} nền tảng</span>
      </div>
      <div className="source-list">
        {stats.map((item: R) => (
          <button
            type="button"
            className="source-row source-row-button"
            key={item.id}
            onClick={() =>
              navigate(`/platforms/${item.id.replaceAll("_", "-")}`)
            }
          >
            <Mark name={item.label} />
            <span>
              <b>{item.label}</b>
              <small>
                {formatValue(item.posts)} bài ·{" "}
                {labelStatus(item.target?.readiness?.state || "checking")}
              </small>
            </span>
            <strong>{formatValue(item.impressions)}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}
function LifecycleFunnel({ data }: { data: R }) {
  const values = [
    ["Chiến dịch", data.campaignCount],
    ["Kênh", data.targetCount],
    ["Bài đăng", data.postCount],
    ["Đã đăng", data.statuses?.published],
    [
      "Có số đo",
      (data.posts || []).filter(
        (post: R) => metricForPost(data, post, "impressions") !== null,
      ).length,
    ],
  ]
  return (
    <section className="panel funnel-panel full-span">
      <div className="panel-head">
        <div>
          <h2>Quy trình phân phối</h2>
          <p>Từ cấu hình chiến dịch đến bằng chứng hiệu quả.</p>
        </div>
      </div>
      <div className="funnel-steps">
        {values.map(([name, value], index) => (
          <div key={String(name)}>
            <span>{index + 1}</span>
            <small>{name}</small>
            <strong>{formatValue(value)}</strong>
            {index < values.length - 1 ? <i>→</i> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
function UserActions({ data }: { data: R }) {
  const actions = [
    ["Cảm xúc", data.totals?.reactions],
    ["Bình luận", data.totals?.comments],
    ["Chia sẻ", data.totals?.shares],
    ["Lượt nhấp", data.totals?.clicks],
    ["Khách hàng tiềm năng", data.totals?.leads],
  ]
  return (
    <section className="panel actions-panel">
      <div className="panel-head">
        <div>
          <h2>Hành động người dùng</h2>
          <p>
            Chỉ hiển thị số liệu nền tảng cung cấp; dữ liệu thiếu giữ ở trạng
            thái chưa rõ.
          </p>
        </div>
      </div>
      <div className="action-grid">
        {actions.map(([name, value]) => (
          <div key={String(name)}>
            <span>{name}</span>
            <strong>{formatValue(value)}</strong>
            <small>{asNumber(value) === null ? "Chưa đo" : "Đã đo"}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
function ChannelTable({ data }: { data: R }) {
  const stats = channelStats(data)
  const navigate = useNavigate()
  return (
    <section className="panel full-span">
      <div className="panel-head table-title">
        <div>
          <h2>Hiệu quả theo nền tảng</h2>
          <p>
            Số đo theo bài được nối với trạng thái cấu hình; chọn dòng để xem
            bài chi tiết.
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nền tảng</th>
              <th>Kênh</th>
              <th>Bài đăng</th>
              <th>Đã đăng</th>
              <th>Lượt hiển thị</th>
              <th>Lượt tương tác</th>
              <th>Sẵn sàng</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((item: R) => (
              <tr
                key={item.id}
                className="clickable"
                onClick={() => navigate(`/platforms/${item.id}`)}
              >
                <td>
                  <span className="platform-cell">
                    <Mark name={item.label} />
                    <b>{item.label}</b>
                  </span>
                </td>
                <td>{formatValue(item.targets)}</td>
                <td>{formatValue(item.posts)}</td>
                <td>
                  {formatValue(
                    (data.posts || []).filter(
                      (post: R) =>
                        post.targetId === item.target?.id &&
                        post.status === "published",
                    ).length,
                  )}
                </td>
                <td>{formatValue(item.impressions)}</td>
                <td>{formatValue(item.engagements)}</td>
                <td>
                  <span
                    className={`status ${item.target?.readiness?.state || "checking"}`}
                  >
                    {labelStatus(item.target?.readiness?.state || "checking")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
function TopContent({ data, select }: { data: R; select: (post: R) => void }) {
  const rows = [...(data.posts || [])]
    .sort(
      (a: R, b: R) =>
        (asNumber(metricForPost(data, b, "impressions")) || -1) -
        (asNumber(metricForPost(data, a, "impressions")) || -1),
    )
    .slice(0, 5)
  return (
    <section className="panel content-panel full-span">
      <div className="panel-head">
        <div>
          <h2>Bài có hiệu quả cao nhất</h2>
          <p>
            Xếp theo lượt hiển thị đã đo; bài chưa có số liệu không bị xem là 0.
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Bài đăng</th>
              <th>Nền tảng</th>
              <th>Trạng thái</th>
              <th>Lượt hiển thị</th>
              <th>Lượt tương tác</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post: R) => {
              const target = (data.targets || []).find(
                (item: R) => item.id === post.targetId,
              )
              return (
                <tr
                  className="clickable"
                  onClick={() => select(post)}
                  key={post.id}
                >
                  <td>
                    <span className="post-title">
                      <b>
                        {String(post.content || "Chưa có nội dung")
                          .split("\n")[0]
                          .slice(0, 105)}
                      </b>
                      <small>{post.id}</small>
                    </span>
                  </td>
                  <td>{labelChannel(target?.channel)}</td>
                  <td>
                    <span className={`status ${post.status}`}>
                      {labelStatus(post.status)}
                    </span>
                  </td>
                  <td>
                    {formatValue(metricForPost(data, post, "impressions"))}
                  </td>
                  <td>
                    {formatValue(metricForPost(data, post, "engagements"))}
                  </td>
                  <td>{formatDate(post.updatedAt || post.publishedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
function Intelligence({ data }: { data: R }) {
  const stats = channelStats(data)
  return (
    <section className="intelligence-grid">
      <section className="panel world-map">
        <div className="panel-head">
          <div>
            <h2>Đối tượng theo thị trường</h2>
            <p>
              Cho biết người xem đến từ thị trường nào — chỉ hiện khi nền tảng
              thực sự cung cấp dữ liệu quốc gia hoặc khu vực.
            </p>
          </div>
        </div>
        <div className="empty-state">
          API hiện chưa nhận được số liệu theo quốc gia hoặc thị trường.
          Dashboard không tự suy đoán vị trí người xem từ tên nền tảng hay nội
          dung bài.
        </div>
      </section>
      <section className="panel heatmap-panel">
        <div className="panel-head">
          <div>
            <h2>Hiệu quả đo được theo nền tảng</h2>
            <p>Đối chiếu lượt hiển thị, tương tác và hành động theo kênh.</p>
          </div>
        </div>
        <div className="heat-table">
          <div>
            <b>Nền tảng</b>
            <b>Hiển thị</b>
            <b>Tương tác</b>
            <b>Hành động</b>
          </div>
          {stats.map((item: R) => (
            <div key={item.id}>
              <span>{item.label}</span>
              <i style={{ opacity: item.impressions === null ? 0.2 : 0.9 }}>
                {formatValue(item.impressions)}
              </i>
              <i style={{ opacity: item.engagements === null ? 0.2 : 0.9 }}>
                {formatValue(item.engagements)}
              </i>
              <i style={{ opacity: item.clicks === null ? 0.2 : 0.9 }}>
                {formatValue(item.clicks)}
              </i>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}
function SignalsAndLive({ data }: { data: R }) {
  const signals = (data.trafficPulse || data.signals || []).slice(0, 4)
  const snapshots: R[] = [...(data.latestMetricSnapshots || [])].sort(
    (a: R, b: R) =>
      new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  )
  const interactions: R[] = [
    ...(data.recentInteractions || data.interactions || []),
  ].sort(
    (a: R, b: R) =>
      new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  )
  const snapshotPage = usePagedRows<R>(
    snapshots,
    (item: R) => `${item.postId}-${item.capturedAt}`,
    "snapshots",
  )
  const interactionPage = usePagedRows<R>(
    interactions,
    (item: R) => item.id || `${item.postId}-${item.capturedAt}-${item.text}`,
    "interactions",
  )
  const posts: Record<string, R> = Object.fromEntries(
    (data.posts || []).map((post: R) => [post.id, post]),
  )
  return (
    <div className="bottom-grid">
      <section className="panel signals-panel">
        <div className="panel-head">
          <div>
            <h2>Tín hiệu tăng trưởng</h2>
            <p>Gợi ý trực tiếp từ dữ liệu theo dõi đã kết nối.</p>
          </div>
        </div>
        {signals.length ? (
          <div className="signal-grid">
            {signals.map((signal: R, index: number) => (
              <div
                className={`signal-card ${
                  signal.priority === "due" ? "down" : index % 2 ? "bolt" : ""
                }`}
                key={`${signal.postId || signal.id || "signal"}-${index}`}
              >
                <span className="signal-icon">
                  {signal.priority === "due" ? "↓" : "↑"}
                </span>
                <span>
                  <strong>
                    {signal.recommendation ||
                      signal.title ||
                      "Tín hiệu dữ liệu"}
                  </strong>
                  <p>
                    {signal.priority === "due" ? "Đến hạn rà soát" : "Cơ hội"} ·{" "}
                    {formatDate(signal.nextReviewAt || signal.updatedAt)}
                  </p>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Chưa có tín hiệu mới.</div>
        )}
      </section>
      <section className="panel live-panel">
        <div className="panel-head">
          <div>
            <h2>Hoạt động gần đây</h2>
            <p>
              Nhật ký các lần đo gần nhất. Số liệu được đối soát mỗi ngày lúc
              23:30, không phải cập nhật trực tiếp.
            </p>
          </div>
          <span className="live-dot" />
        </div>
        <div className="activity-block">
          <h3>Lịch sử số liệu bài đăng</h3>
          <div className="live-list">
            {snapshotPage.rows.length ? (
              snapshotPage.rows.map((snapshot: R) => {
                const post = posts[snapshot.postId]
                const target = (data.targets || []).find(
                  (item: R) => item.id === post?.targetId,
                )
                return (
                  <div key={`${snapshot.postId}-${snapshot.capturedAt}`}>
                    <span className="live-dot" />
                    <span>
                      <b>{labelChannel(target?.channel)}</b>
                      <small>
                        {formatValue(snapshot.impressions, " lượt hiển thị")} ·{" "}
                        {formatValue(snapshot.reactions, " lượt cảm xúc")}
                      </small>
                    </span>
                    <time>
                      {formatDate(snapshot.capturedAt).split(",")[1] ||
                        formatDate(snapshot.capturedAt)}
                    </time>
                  </div>
                )
              })
            ) : (
              <div className="empty-state">Chưa có bản ghi số liệu.</div>
            )}
          </div>
          <Pagination
            page={snapshotPage.page}
            pageCount={snapshotPage.pageCount}
            total={snapshots.length}
            setPage={snapshotPage.setPage}
          />
        </div>
        <div className="activity-block">
          <h3>Bình luận và tương tác đã ghi nhận</h3>
          <div className="live-list">
            {interactionPage.rows.length ? (
              interactionPage.rows.map((interaction: R) => {
                const post = posts[interaction.postId]
                const target = (data.targets || []).find(
                  (item: R) => item.id === post?.targetId,
                )
                return (
                  <div
                    key={
                      interaction.id ||
                      `${interaction.postId}-${interaction.capturedAt}`
                    }
                  >
                    <span className="live-dot" />
                    <span>
                      <b>
                        {labelChannel(target?.channel)} ·{" "}
                        {{
                          comment: "Bình luận",
                          reply: "Phản hồi",
                          reaction: "Cảm xúc",
                          like: "Lượt thích",
                          share: "Chia sẻ",
                          click: "Lượt nhấp",
                        }[
                          String(interaction.kind || "comment").toLowerCase()
                        ] || "Tương tác"}
                      </b>
                      <small>
                        {interaction.text || "Tương tác được ghi nhận"}
                      </small>
                    </span>
                    <time>{formatDate(interaction.capturedAt)}</time>
                  </div>
                )
              })
            ) : (
              <div className="empty-state">Chưa ghi nhận tương tác.</div>
            )}
          </div>
          <Pagination
            page={interactionPage.page}
            pageCount={interactionPage.pageCount}
            total={interactions.length}
            setPage={interactionPage.setPage}
          />
        </div>
      </section>
    </div>
  )
}

const communityRepoLabels: Record<string, string> = {
  "design-os-3d-blender": "Sản phẩm 3D",
  "design-os-code2flow": "Vibe Code",
  "design-os-svg-animation": "SVG Animation",
}
const communityStatusLabels: Record<string, string> = {
  joined: "Đã tham gia",
  pending: "Chờ duyệt",
  rejected: "Bị từ chối",
  blocked: "Bị chặn",
  not_applicable: "Không áp dụng",
  unknown: "Chưa xác minh",
}
const communityPostLabels: Record<string, string> = {
  allowed: "Được đăng",
  manual_review: "Chờ kiểm duyệt bài",
  blocked: "Bị chặn đăng",
  not_applicable: "Không áp dụng",
  unknown: "Chưa rõ quyền đăng",
}
function CommunityOverviewLegacy({ data }: { data: R }) {
  const [filter, setFilter] = useState("all")
  const rows = [...(data.communityMemberships || [])].sort((a: R, b: R) =>
    String(b.updatedAt || b.checkedAt || "").localeCompare(
      String(a.updatedAt || a.checkedAt || ""),
    ),
  )
  const filtered =
    filter === "all"
      ? rows
      : rows.filter(
          (item: R) =>
            item.membershipStatus === filter || item.postStatus === filter,
        )
  const grouped = Object.entries(communityRepoLabels).map(
    ([repo, label]) =>
      [
        repo,
        label,
        filtered.filter((item: R) => item.productRepo === repo),
      ] as const,
  )
  const pending = rows.filter(
    (item: R) => item.membershipStatus === "pending",
  ).length
  const blocked = rows.filter(
    (item: R) =>
      item.membershipStatus === "blocked" ||
      item.postStatus === "blocked" ||
      item.postStatus === "manual_review",
  ).length
  return (
    <section className="panel community-panel full-span">
      <div className="panel-head">
        <div>
          <h2>Cộng đồng theo repo</h2>
          <p>
            Trạng thái tham gia và quyền đăng được kiểm chứng trên từng nền
            tảng.
          </p>
        </div>
        <div className="community-summary">
          <span className="status pending">{pending} chờ duyệt</span>
          <span className="status blocked">{blocked} cần theo dõi</span>
        </div>
      </div>
      <div className="community-tools">
        <span>{rows.length} bản ghi cộng đồng</span>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="joined">Đã tham gia</option>
          <option value="pending">Chờ duyệt</option>
          <option value="blocked">Bị chặn / kiểm duyệt</option>
          <option value="rejected">Bị từ chối</option>
        </select>
      </div>
      <div className="community-groups">
        {grouped.map(([repo, label, items]) => (
          <div className="community-repo" key={repo}>
            <div className="community-repo-head">
              <span className="track-dot" />
              <div>
                <b>{label}</b>
                <small>{repo}</small>
              </div>
              <strong>{items.length}</strong>
            </div>
            {items.length ? (
              <div
                className={`community-list${items.length > 10 ? " is-scrollable" : ""}`}
                aria-label={items.length > 10 ? `Danh sách cộng đồng ${repo}` : undefined}
                role={items.length > 10 ? "region" : undefined}
                tabIndex={items.length > 10 ? 0 : undefined}
              >
                {items.map((item: R) => (
                  <div className="community-row" key={item.id}>
                    <Mark name={labelChannel(item.platform)} />
                    <span className="community-name">
                      <b>{item.communityName}</b>
                      <small>
                        {item.platform} ·{" "}
                        {item.notes || item.evidence || "Đã kiểm tra"}
                      </small>
                    </span>
                    <span className={`status ${item.membershipStatus}`}>
                      {communityStatusLabels[item.membershipStatus] ||
                        item.membershipStatus}
                    </span>
                    <span
                      className={`community-post-status ${item.postStatus}`}
                    >
                      {communityPostLabels[item.postStatus] || item.postStatus}
                    </span>
                    <time>{formatDate(item.checkedAt || item.updatedAt)}</time>
                    {item.communityUrl ? (
                      <a
                        href={item.communityUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mở ↗
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                Chưa có cộng đồng được ghi nhận cho repo này.
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function latestMissionRecord(data: R, key: string) {
  const rows = Array.isArray(data?.[key]) ? data[key] : []
  return [...rows]
    .sort((left: R, right: R) =>
      String(right.updatedAt || right.latest?.generatedAt || "").localeCompare(
        String(left.updatedAt || left.latest?.generatedAt || ""),
      ),
    )
    .at(0) || null
}

function advisoryAction(value: unknown) {
  const labels: Record<string, string> = {
    publish: "Chuẩn bị đăng",
    engage: "Tương tác có ngữ cảnh",
    research: "Nghiên cứu thêm",
    wait: "Chờ thêm dữ liệu",
    do_nothing: "Không hành động",
  }
  return labels[String(value || "")] || "UNKNOWN"
}

function missionValue(value: unknown, hasRecord: boolean) {
  return hasRecord && value !== null && value !== undefined ? String(value) : "UNKNOWN"
}

function MissionControlPanel({ data }: { data: R }) {
  const strategy = latestMissionRecord(data, "strategy")?.latest || null
  const learning = latestMissionRecord(data, "learning")?.latest || null
  const outcome = latestMissionRecord(data, "outcomes")?.latest || null
  const cycle = data?.automation?.controlCycle || null
  const reasons = (record: R | null) =>
    Array.isArray(record?.reasons) && record.reasons.length
      ? record.reasons.join(" · ")
      : "Chưa có lý do được ghi nhận"
  const measuredFields = outcome?.metrics?.coverage
    ? Object.entries(outcome.metrics.coverage)
        .filter(([, value]: [string, any]) => Number(value?.measured || 0) > 0)
        .map(([field]) => field)
    : []
  const cycleStatus = cycle
    ? cycle.running
      ? "Đang chạy"
      : cycle.enabled
        ? cycle.lastCompletedAt
          ? "Đã chạy theo lịch"
          : "Đã bật · chưa chạy"
        : "Đang tắt"
    : "Chưa có runtime"
  const accountRuntime = Array.isArray(data?.accountRuntime)
    ? data.accountRuntime
    : Array.isArray(data?.executionAccounts)
      ? data.executionAccounts
      : []
  const accountRows = accountRuntime.map((account: R) => ({
    id: String(account?.id || "UNKNOWN"),
    platform: String(account?.platform || "UNKNOWN"),
    sessionMode: String(account?.sessionMode || "UNKNOWN"),
    authMode: String(account?.authMode || "UNKNOWN"),
    eligible: account?.eligibleForExecution === true,
    blocker: String(account?.currentBlocker || "UNKNOWN"),
    reasons: Array.isArray(account?.ineligibilityReasons)
      ? account.ineligibilityReasons.map((reason: unknown) => String(reason)).filter(Boolean)
      : [],
  }))
  return (
    <section className="panel mission-control-panel full-span">
      <div className="panel-head">
        <div>
          <h2>Mission Control</h2>
          <p>
            Quan sát quyết định advisory, coverage và chu kỳ điều khiển từ state
            hiện tại. Panel này không cấp quyền và không thực hiện hành động.
          </p>
        </div>
        <span className="status completed">Chỉ đọc · advisory</span>
      </div>
      <div className="mission-control-grid">
        <article>
          <span className="mission-eyebrow">Chu kỳ điều khiển</span>
          <strong>{cycleStatus}</strong>
          <small>
            {cycle?.lastCompletedAt
              ? `Lần cuối: ${formatDate(cycle.lastCompletedAt)}`
              : "Chưa có bằng chứng chạy chu kỳ"}
          </small>
        </article>
        <article>
          <span className="mission-eyebrow">Next best action</span>
          <strong>{advisoryAction(strategy?.action)}</strong>
          <small>{reasons(strategy)}</small>
        </article>
        <article>
          <span className="mission-eyebrow">Learning signal</span>
          <strong>{advisoryAction(learning?.action)}</strong>
          <small>{reasons(learning)}</small>
        </article>
        <article>
          <span className="mission-eyebrow">Publication / metrics</span>
          <strong>
            {missionValue(outcome?.publication?.verified, Boolean(outcome))} verified ·{" "}
            {missionValue(outcome?.publication?.unknown, Boolean(outcome))} UNKNOWN
          </strong>
          <small>
            {outcome
              ? `${outcome.metrics?.snapshots ?? "UNKNOWN"} snapshot · ${measuredFields.length ? measuredFields.join(", ") : "chưa có field đo được"}`
              : "Chưa có outcome summary"}
          </small>
        </article>
      </div>
      <div className="mission-account-runtime">
        <div className="mission-account-head">
          <div>
            <span className="mission-eyebrow">Account / session readiness</span>
            <small>Read-only projection · không đăng nhập, chọn account hoặc chạy browser</small>
          </div>
          <span className="status">{accountRows.length ? `${accountRows.length} account` : "UNKNOWN"}</span>
        </div>
        {accountRows.length ? (
          <div className="mission-account-list">
            {accountRows.map((account) => (
              <article key={account.id}>
                <div className="mission-account-title">
                  <strong>{account.id}</strong>
                  <span className={account.eligible ? "status completed" : "status failed"}>
                    {account.eligible ? "Eligible" : "Ineligible"}
                  </span>
                </div>
                <small>{account.platform} · {account.sessionMode} · {account.authMode}</small>
                <small>Blocker: {account.blocker}</small>
                <small>Reasons: {account.reasons.length ? account.reasons.join(" · ") : "—"}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Chưa có account runtime projection.</div>
        )}
      </div>
    </section>
  )
}

function Overview({
  data,
  select,
  periodLabel,
}: {
  data: R
  select: (post: R) => void
  periodLabel: string
}) {
  return (
    <>
      <KpiRow data={data} />
      <div className="filterbar">
        <span className="sync-text">
          Phạm vi chung: {periodLabel} · {data.postCount} bài ·{" "}
          {data.latestMetricSnapshots?.length || 0} snapshot mới nhất theo bài ·
          số liệu thiếu hiển thị “—”
        </span>
      </div>
      <div className="dashboard-grid">
        <MissionControlPanel data={data} />
        <TrafficChart data={data} />
        <TrafficSourcesPanel data={data} />
        <ReadinessPanel data={data} />
        <SourcesPanel data={data} />
        <LifecycleFunnel data={data} />
        <UserActions data={data} />
        <ChannelTable data={data} />
        <CommunityOverview data={data} />
        <LeadSummary integration={data.autoGtm} />
        <TopContent data={data} select={select} />
        <Intelligence data={data} />
        <SignalsAndLive data={data} />
      </div>
    </>
  )
}

const titles: Record<string, string> = {
  "/": "Growth intelligence",
  "/traffic": "Phân tích traffic",
  "/engagement": "Phân tích tương tác",
  "/actions": "Phân tích hành động",
  "/conversions": "Phân tích chuyển đổi",
  "/content-performance": "Hiệu quả nội dung",
  "/platforms": "Nền tảng",
  "/campaigns": "Chiến dịch",
  "/posts": "Bài đăng & Seeds",
  "/markets": "Thị trường",
  "/audience": "Đối tượng",
  "/signals": "Trung tâm intelligence",
  "/leads": "Khách hàng tiềm năng",
  "/reports": "Báo cáo",
  "/integrations": "Tích hợp",
  "/settings": "Cài đặt",
}
const periodLabels: Record<string, string> = {
  today: "Hôm nay",
  "7d": "7 ngày",
  "30d": "30 ngày",
  all: "Toàn bộ",
}
const productOptions = [
  ["design-os-3d-blender", "3D Blender"],
  ["design-os-code2flow", "Vibe Code"],
  ["design-os-svg-animation", "SVG Animation"],
]
function productRepoFor(data: R, post: R) {
  const campaign = (data.campaigns || []).find(
    (item: R) => item.id === post.campaignId,
  )
  const explicit = post.productRepo || campaign?.productRepo || campaign?.repo
  if (explicit) return String(explicit)
  const text = `${campaign?.name || ""} ${post.content || ""}`.toLowerCase()
  if (
    text.includes("code2flow") ||
    text.includes("vibe-code") ||
    text.includes("signal relay flow")
  )
    return "design-os-code2flow"
  if (
    text.includes("svg-animation") ||
    text.includes("svg animation") ||
    text.includes("sentinel camera in svg")
  )
    return "design-os-svg-animation"
  if (
    text.includes("blender") ||
    text.includes("rover") ||
    text.includes("3d product") ||
    text.includes("3d")
  )
    return "design-os-3d-blender"
  return "unknown"
}
function channelMatches(value: unknown, channelId: string) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
  const wanted = String(channelId || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
  if (!wanted) return true
  if (normalized === wanted) return true
  return (
    (wanted === "facebookgroup" && normalized === "facebook") ||
    (wanted === "facebook" && normalized === "facebookgroup")
  )
}
function periodStart(period: string) {
  if (period === "all") return 0
  const now = new Date()
  if (period === "today") {
    now.setHours(0, 0, 0, 0)
    return now.getTime()
  }
  return now.getTime() - (period === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000
}
function validMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
function scopeDashboardData(
  data: R,
  period: string,
  channel: string,
  repo: string,
) {
  if (!data || !Array.isArray(data.posts)) return data
  const start = periodStart(period)
  const channels = (data.channels || []).filter(
    (item: R) => !channel || channelMatches(item.id, channel),
  )
  const targets = (data.targets || []).filter(
    (item: R) => !channel || channelMatches(item.channel, channel),
  )
  const targetIds = new Set(targets.map((item: R) => item.id))
  const targetScopedPosts = data.posts.filter(
    (post: R) =>
      (!channel || targetIds.has(post.targetId)) &&
      (!repo || productRepoFor(data, post) === repo),
  )
  const rawSnapshots: R[] = data.latestMetricSnapshots || []
  const snapshotsByPost = new Map<string, R[]>()
  rawSnapshots.forEach((snapshot: R) =>
    snapshotsByPost.set(snapshot.postId, [
      ...(snapshotsByPost.get(snapshot.postId) || []),
      snapshot,
    ]),
  )
  const inWindow = (value: unknown) =>
    period === "all" || (Date.parse(String(value || "")) || 0) >= start
  const baselinePosts = data.posts.filter(
    (post: R) =>
      period === "all" ||
      inWindow(post.publishedAt || post.createdAt || post.updatedAt) ||
      (snapshotsByPost.get(post.id) || []).some((snapshot: R) =>
        inWindow(snapshot.capturedAt),
      ),
  )
  const trafficSourceFallback = {
    ...data,
    posts: baselinePosts,
    targets: data.targets || [],
    channels: data.channels || [],
    latestMetricSnapshots: rawSnapshots.filter((snapshot: R) =>
      inWindow(snapshot.capturedAt),
    ),
  }
  const posts = targetScopedPosts.filter(
    (post: R) =>
      period === "all" ||
      inWindow(post.publishedAt || post.createdAt || post.updatedAt) ||
      (snapshotsByPost.get(post.id) || []).some((snapshot: R) =>
        inWindow(snapshot.capturedAt),
      ),
  )
  const postIds = new Set(posts.map((post: R) => post.id))
  const latestMetricSnapshots = rawSnapshots.filter(
    (snapshot: R) =>
      postIds.has(snapshot.postId) && inWindow(snapshot.capturedAt),
  )
  const totals: R = {}
  const metricCoverage: R = {}
  for (const key of [
    "impressions",
    "reactions",
    "comments",
    "shares",
    "clicks",
    "leads",
  ]) {
    const values = latestMetricSnapshots
      .map((snapshot: R) => validMetric(snapshot[key]))
      .filter((value: number | null): value is number => value !== null)
    totals[key] = values.length
      ? values.reduce((sum: number, value: number) => sum + value, 0)
      : null
    metricCoverage[key] = {
      measured: values.length,
      unsupported: latestMetricSnapshots.filter(
        (snapshot: R) => snapshot.coverage?.[key] === "unsupported",
      ).length,
      unknown: latestMetricSnapshots.filter(
        (snapshot: R) =>
          !snapshot.coverage?.[key] || snapshot.coverage?.[key] === "unknown",
      ).length,
    }
  }
  const engagements = [totals.reactions, totals.comments, totals.shares].filter(
    (value: number | null) => value !== null,
  )
  totals.engagements = engagements.length
    ? engagements.reduce((sum: number, value: number) => sum + value, 0)
    : null
  const statuses: R = {}
  for (const post of posts)
    statuses[post.status] = (statuses[post.status] || 0) + 1
  const campaignIds = new Set(
    posts.map((post: R) => post.campaignId).filter(Boolean),
  )
  const campaigns = (data.campaigns || []).filter((item: R) =>
    campaignIds.has(item.id),
  )
  const communityMemberships = (data.communityMemberships || []).filter(
    (item: R) =>
      (!repo || item.productRepo === repo) &&
      (!channel || channelMatches(item.platform, channel)),
  )
  const recentInteractions = (data.recentInteractions || []).filter(
    (item: R) => postIds.has(item.postId) && inWindow(item.capturedAt),
  )
  const signals = (data.trafficPulse || data.signals || []).filter(
    (item: R) => !item.postId || postIds.has(item.postId),
  )
  return {
    ...data,
    channels,
    targets,
    posts,
    campaigns,
    communityMemberships,
    latestMetricSnapshots,
    recentInteractions,
    trafficPulse: signals,
    signals,
    totals,
    metricCoverage,
    statuses,
    postCount: posts.length,
    targetCount: targets.length,
    campaignCount: campaigns.length,
    trafficSourceFallback,
    scope: { period, channel, repo },
  }
}
function DashboardScopeBar({
  data,
  sourceData,
  period,
  setPeriod,
  channel,
  setChannel,
  repo,
  setRepo,
}: {
  data: R
  sourceData: R
  period: string
  setPeriod: (value: string) => void
  channel: string
  setChannel: (value: string) => void
  repo: string
  setRepo: (value: string) => void
}) {
  const measured = (data.latestMetricSnapshots || []).filter((snapshot: R) =>
    ["impressions", "reactions", "comments", "shares", "clicks", "leads"].some(
      (key) => validMetric(snapshot[key]) !== null,
    ),
  ).length
  return (
    <section className="dashboard-scope" aria-label="Bộ lọc chung dashboard">
      <div className="scope-selects">
        <label>
          Thời gian
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
            <option value="all">Toàn bộ</option>
          </select>
        </label>
        <label>
          Nền tảng
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            <option value="">Tất cả nền tảng</option>
            {(sourceData.channels || []).map((item: R) => (
              <option value={item.id} key={item.id}>
                {labelChannel(item.id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repo sản phẩm
          <select
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
          >
            <option value="">Tất cả repo</option>
            {productOptions.map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="scope-summary">
        <strong>{data.postCount || 0} bài</strong>
        <span>{measured} bài có ít nhất một counter đo được</span>
        <span>API cập nhật {formatDate(data.updatedAt)}</span>
      </div>
    </section>
  )
}
function savedScope(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(`growth-dashboard-${key}`) || fallback
  } catch {
    return fallback
  }
}
function CommunityOverview({ data }: { data: R }) {
  const [filter, setFilter] = useState("all")
  const rows = [...(data.communityMemberships || [])].sort((a: R, b: R) =>
    String(b.updatedAt || b.checkedAt || "").localeCompare(
      String(a.updatedAt || a.checkedAt || ""),
    ),
  )
  const filtered =
    filter === "all"
      ? rows
      : rows.filter(
          (item: R) =>
            item.membershipStatus === filter || item.postStatus === filter,
        )
  const groups = Object.entries(communityRepoLabels).map(([repo, label]) => ({
    repo,
    label:
      repo === "design-os-3d-blender"
        ? "Sản phẩm 3D"
        : repo === "design-os-code2flow"
          ? "Vibe Code"
          : "Hoạt ảnh SVG",
    items: filtered.filter((item: R) => item.productRepo === repo),
  }))
  const joined = rows.filter(
    (item: R) => item.membershipStatus === "joined",
  ).length
  const pending = rows.filter(
    (item: R) =>
      item.membershipStatus === "pending" ||
      item.postStatus === "manual_review",
  ).length
  const labels: Record<string, string> = {
    joined: "Đã tham gia",
    pending: "Chờ duyệt",
    rejected: "Bị từ chối",
    blocked: "Bị chặn",
    not_applicable: "Không áp dụng",
    unknown: "Chưa xác minh",
    allowed: "Được đăng",
    manual_review: "Chờ duyệt bài",
  }
  return (
    <section className="panel community-panel full-span">
      <div className="panel-head">
        <div>
          <h2>Cộng đồng theo repo</h2>
          <p>Theo dõi trạng thái tham gia và quyền đăng theo từng sản phẩm.</p>
        </div>
        <div className="community-summary">
          <span className="status ready">{joined} đã tham gia</span>
          <span className="status pending">{pending} chờ duyệt</span>
        </div>
      </div>
      <div className="community-tools">
        <span>{rows.length} cộng đồng đã ghi nhận</span>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="joined">Đã tham gia</option>
          <option value="pending">Chờ duyệt</option>
          <option value="unknown">Chưa xác minh</option>
          <option value="blocked">Bị chặn</option>
          <option value="rejected">Bị từ chối</option>
        </select>
      </div>
      <div className="community-groups">
        {groups.map(({ repo, label, items }) => (
          <article className="community-repo" key={repo}>
            <div className="community-repo-head">
              <span className="track-dot" />
              <div>
                <b>{label}</b>
                <small>{repo}</small>
              </div>
              <strong>
                {items.length}
                <small>cộng đồng</small>
              </strong>
            </div>
            {items.length ? (
              <div className="community-list">
                {items.map((item: R) => (
                  <div className="community-row" key={item.id}>
                    <Mark name={labelChannel(item.platform)} />
                    <div className="community-row-main">
                      <b title={item.communityName}>{item.communityName}</b>
                      <small>
                        {labelChannel(item.platform)} · kiểm tra{" "}
                        {formatDate(item.checkedAt || item.updatedAt)}
                      </small>
                      <div className="community-statuses">
                        <span className={`status ${item.membershipStatus}`}>
                          {labels[item.membershipStatus] || "Chưa xác minh"}
                        </span>
                        <span
                          className={`community-post-status ${item.postStatus}`}
                        >
                          {labels[item.postStatus] || "Chưa rõ quyền đăng"}
                        </span>
                      </div>
                    </div>
                    {item.communityUrl ? (
                      <a
                        className="community-open"
                        href={item.communityUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mở nhóm ↗
                      </a>
                    ) : (
                      <span className="community-open disabled">
                        Thiếu link
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                Chưa có cộng đồng phù hợp với trạng thái lọc.
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const location = useLocation()
  const path =
    location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, "")
  const [data, setData] = useState<R>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<R | null>(null)
  const [period, setPeriod] = useState(() => savedScope("period", "30d"))
  const [channel, setChannel] = useState(() => savedScope("platform", ""))
  const [repo, setRepo] = useState(() => savedScope("repo", ""))
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme: Theme =
        localStorage.getItem("growth-dashboard-theme") === "light"
          ? "light"
          : "dark"
      document.documentElement.dataset.theme = savedTheme
      return savedTheme
    } catch {
      document.documentElement.dataset.theme = "dark"
      return "dark"
    }
  })
  const scopedData = useMemo(
    () => scopeDashboardData(data, period, channel, repo),
    [data, period, channel, repo],
  )
  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setData(await response.json())
      setError("")
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể kết nối API dashboard",
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem("growth-dashboard-theme", theme)
    } catch {
      /* private browsing can disable persistence */
    }
  }, [theme])
  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem("growth-dashboard-period", period)
      localStorage.setItem("growth-dashboard-platform", channel)
      localStorage.setItem("growth-dashboard-repo", repo)
    } catch {
      /* private browsing can disable persistence */
    }
  }, [period, channel, repo])
  const periodLabel = `${periodLabels[period]}${
    channel ? ` · ${labelChannel(channel)}` : ""
  }${repo ? ` · ${repo}` : ""}`
  return (
    <div className="app">
      <Sidebar
        path={path}
        theme={theme}
        onToggleTheme={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
        signalCount={
          (scopedData.trafficPulse || scopedData.signals || []).length
        }
      />
      <main className="main">
        {Object.keys(data).length > 0 && !error ? (
          <DashboardScopeBar
            data={scopedData}
            sourceData={data}
            period={period}
            setPeriod={setPeriod}
            channel={channel}
            setChannel={setChannel}
            repo={repo}
            setRepo={setRepo}
          />
        ) : null}
        {error ? (
          <div className="page-shell">
            <Header
              data={data}
              title={titles[path] || "Growth intelligence"}
              loading={loading}
              refresh={load}
            />
            <div className="empty-state">
              Dashboard API không khả dụng: {error}
            </div>
          </div>
        ) : Object.keys(data).length === 0 ? (
          <div className="page-shell">
            <Header
              data={data}
              title={titles[path] || "Growth intelligence"}
              loading={loading}
              refresh={load}
            />
            <div className="route-loading">
              <div />
              <div />
            </div>
          </div>
        ) : path === "/" ? (
          <div className="page-shell">
            <Header
              data={scopedData}
              title={titles[path]}
              loading={loading}
              refresh={load}
            />
            <Overview
              data={scopedData}
              select={setSelected}
              periodLabel={periodLabel}
            />
            <footer>
              Distribution OS <span>·</span> Dữ liệu từ dashboard API{" "}
              <span>·</span> Asia/Saigon
            </footer>
          </div>
        ) : path === "/leads" ? (
          <div className="page-shell">
            <Header
              data={scopedData}
              title={titles[path]}
              loading={loading}
              refresh={load}
            />
            <LeadsPage integration={data.autoGtm} />
          </div>
        ) : (
          <RoutedPage path={path} data={scopedData} onSelect={setSelected} />
        )}
      </main>
      <PostDrawer
        data={scopedData}
        post={selected}
        close={() => setSelected(null)}
      />
    </div>
  )
}

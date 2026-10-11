type Evidence = {
  signalId: string
  source: string
  kind: string
  occurredAt: string
  url: string
  snippet: string
}

type Lead = {
  leadId: string
  segment: string
  fit: number | null
  whyNow: number | null
  reach: number | null
  evidence: Evidence[]
}

type Integration = {
  status?: string
  reason?: string | null
  generatedAt?: string | null
  campaignId?: string | null
  portfolioProduct?: string
  leads?: Lead[]
  leadCount?: number
  signalCount?: number
}

const campaignId = "campaign_r19_gt_course_validation"
const states: Record<string, string> = {
  ready: "Đã kết nối",
  unavailable: "Chưa có bản xuất",
  not_initialized: "Nguồn chưa khởi tạo",
  not_configured: "Chưa khai báo sản phẩm",
  unsupported_schema: "Phiên bản chưa hỗ trợ",
  stale: "Bản xuất đã cũ",
  invalid: "Bản xuất không hợp lệ",
}

function time(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa có thời điểm"
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function score(value: number | null) {
  return value === null ? "Chưa chấm" : `${Math.round(value * 100)}%`
}

export function LeadSummary({ integration }: { integration?: Integration }) {
  const data = integration || {}
  return (
    <section className="panel lead-summary">
      <div className="panel-head">
        <div>
          <h2>Khách hàng tiềm năng từ Auto-GTM</h2>
          <p>
            {data.leadCount || 0} hồ sơ · {data.signalCount || 0} bằng chứng công khai · chỉ đọc
          </p>
        </div>
        <span className={`status ${data.status === "ready" ? "ready" : "pending"}`}>
          {states[data.status || "unavailable"] || "Chưa rõ trạng thái"}
        </span>
      </div>
      {data.status === "ready" ? (
        <p className="lead-summary-note">
          Bản xuất lúc {time(data.generatedAt)}. Việc gắn chiến dịch chỉ hợp lệ khi mã chiến dịch khớp.
        </p>
      ) : (
        <p className="lead-summary-note">
          {data.reason === "source_database_missing"
            ? "Auto-GTM chưa có cơ sở dữ liệu khách hàng tiềm năng; bảng điều khiển không tạo dữ liệu thay thế."
            : data.reason === "product_domain_required"
              ? "Chiến dịch chưa có tên miền sản phẩm do chủ sở hữu khai báo; chưa thể liên kết dữ liệu Auto-GTM."
            : "Chưa nhận được bản xuất từ tiến trình nền Auto-GTM."}
        </p>
      )}
    </section>
  )
}

export function LeadsPage({ integration }: { integration?: Integration }) {
  const data = integration || {}
  const matched = data.campaignId === campaignId
  const rows = matched && data.status === "ready" ? data.leads || [] : []
  return (
    <div className="page-shell">
      <LeadSummary integration={data} />
      {data.campaignId && !matched ? (
        <div className="empty-state lead-warning">
          Bản xuất đang gắn với chiến dịch khác ({data.campaignId}); dữ liệu được ẩn để tránh gắn nhầm sang chiến dịch R19.
        </div>
      ) : null}
      {!rows.length ? (
        <div className="empty-state">
          {data.status === "ready"
            ? "Chưa có khách hàng tiềm năng đủ bằng chứng cho chiến dịch này."
            : "Khu vực này đang ở chế độ chờ dữ liệu thật từ Auto-GTM."}
        </div>
      ) : (
        <section className="panel lead-table-panel">
          <div className="panel-head">
            <div>
              <h2>Danh sách có bằng chứng</h2>
              <p>Không hiển thị địa chỉ liên hệ, thông tin chặn hay nút gửi.</p>
            </div>
            <span className="status ready">Chiến dịch R19</span>
          </div>
          <div className="lead-table-wrap">
            <table className="lead-table">
              <thead>
                <tr>
                  <th>Mã hồ sơ</th><th>Phân khúc</th><th>Phù hợp</th>
                  <th>Đúng thời điểm</th><th>Khả năng tiếp cận</th><th>Bằng chứng</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr key={lead.leadId}>
                    <td><code>{lead.leadId}</code></td>
                    <td>{lead.segment || "Chưa phân loại"}</td>
                    <td>{score(lead.fit)}</td>
                    <td>{score(lead.whyNow)}</td>
                    <td>{score(lead.reach)}</td>
                    <td>
                      <div className="lead-evidence-list">
                        {lead.evidence.map((item) => (
                          <a key={item.signalId} href={item.url} target="_blank" rel="noreferrer">
                            <strong>{item.kind || item.source || "Tín hiệu"}</strong>
                            <span>{item.snippet || "Mở nguồn bằng chứng công khai"}</span>
                            <small>{time(item.occurredAt)}</small>
                          </a>
                        ))}
                        {!lead.evidence.length ? <span>Chưa có bằng chứng hiển thị</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

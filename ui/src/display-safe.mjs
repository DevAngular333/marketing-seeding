const DISPLAY_SECRET_RE = /(?:password|passphrase|secret|token|cookie|credential|api[_-]?key|session(?:[_ -]?token)?|authorization)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+|\bbearer\s+[^\s,;]+/gi;

export function compactDisplayText(value, fallback = "UNKNOWN", max = 180) {
  const text = String(value ?? "").replace(DISPLAY_SECRET_RE, (match) => {
    const separator = match.match(/\s*[:=]\s*/)?.[0] || " ";
    const label = match.split(separator)[0].trim();
    return `${label}${separator}[REDACTED]`;
  }).replace(/\s+/g, " ").trim();
  return text ? (text.length > max ? `${text.slice(0, max - 1)}…` : text) : fallback;
}

import React from 'react';

function shortenUrl(url) {
  if (!url) {
    return 'Not configured';
  }
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}

function PlanStatus({
  publicLinkStatus,
  publicBaseUrl,
  geminiConfigured,
  geminiModel,
}) {
  const linkLabel =
    publicLinkStatus === 'active'
      ? 'Active'
      : publicLinkStatus === 'expired'
        ? 'Expired'
        : 'Not set';

  const linkClass =
    publicLinkStatus === 'active'
      ? 'plan-pill active'
      : publicLinkStatus === 'expired'
        ? 'plan-pill expired'
        : 'plan-pill missing';

  const modelLabel = geminiConfigured
    ? geminiModel || 'Configured'
    : 'Not configured';

  return (
    <section className="plan-status" aria-label="Current plan status">
      <div className="plan-status-item">
        <span className="plan-label">Public link</span>
        <span className={linkClass}>{linkLabel}</span>
        <span className="plan-detail" title={publicBaseUrl || ''}>
          {shortenUrl(publicBaseUrl)}
        </span>
      </div>
      <div className="plan-status-item">
        <span className="plan-label">Gemini</span>
        <span
          className={
            geminiConfigured ? 'plan-pill active' : 'plan-pill expired'
          }
        >
          {geminiConfigured ? 'Ready' : 'Missing'}
        </span>
        <span className="plan-detail">{modelLabel}</span>
      </div>
    </section>
  );
}

export default PlanStatus;

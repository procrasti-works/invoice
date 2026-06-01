export default function DashboardLoading() {
  return (
    <div className="db-page db-page-loading" aria-label="Loading dashboard view">
      <div className="db-page-header">
        <div>
          <span className="db-loading-line db-loading-line-sm" />
          <span className="db-loading-line db-loading-line-lg" />
        </div>
        <span className="db-loading-pill" />
      </div>

      <div className="db-stat-row db-stat-row-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="db-stat-card db-stat-card-loading">
            <span className="db-loading-line db-loading-line-sm" />
            <span className="db-loading-line db-loading-line-md" />
            <span className="db-loading-line db-loading-line-xs" />
          </div>
        ))}
      </div>

      <section className="db-card db-list-card">
        <div className="db-list-toolbar">
          <div>
            <span className="db-loading-line db-loading-line-sm" />
            <span className="db-loading-line db-loading-line-md" />
          </div>
          <span className="db-loading-tabs" />
        </div>
        <div className="db-skeleton-list" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}

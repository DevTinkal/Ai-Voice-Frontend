import React from 'react';

function StatsCards({ stats }) {
  const items = [
    { label: 'Total Calls', value: stats?.totalCalls ?? 0 },
    { label: 'Active Calls', value: stats?.activeCalls ?? 0 },
    { label: 'Completed Calls', value: stats?.completedCalls ?? 0 },
    { label: 'Failed Calls', value: stats?.failedCalls ?? 0 },
  ];

  return (
    <section className="panel stats-cards">
      <h2>Statistics</h2>
      <div className="stats-grid">
        {items.map((item) => (
          <div className="stat-item" key={item.label}>
            <span className="stat-value">{item.value}</span>
            <span className="stat-label">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsCards;

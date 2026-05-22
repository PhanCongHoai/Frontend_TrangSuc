function StatsGrid({ stats }) {
  return (
    <section className="stats-grid">
      {stats.map((item) => (
        <article key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}

export default StatsGrid;

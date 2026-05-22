function HighlightsSection({ highlights }) {
  return (
    <section className="highlights">
      {highlights.map((item) => (
        <div className="highlight-item" key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  );
}

export default HighlightsSection;

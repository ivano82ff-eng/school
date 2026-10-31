export function CabinetShell({ title, subtitle, children }) {
  return (
    <div className="cabinet">
      <header className="cabinet-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}

export function CabinetGrid({ columns = 3, children }) {
  return <div className={`cabinet-grid cols-${columns}`}>{children}</div>;
}

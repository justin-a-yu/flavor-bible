export default function PrintExportButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#faf5ea', border: '1px solid #e0d6c4', borderRadius: 8,
        padding: '7px 14px', fontSize: '0.78rem', color: '#8a7450',
        cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: '0.06em',
      }}
    >
      <span style={{ fontSize: '1rem' }}>⎙</span>
      Print / Export
    </button>
  );
}

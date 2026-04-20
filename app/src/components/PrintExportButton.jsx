import useExplorerStore from '../store/useExplorerStore';

export default function PrintExportButton() {
  const lenses  = useExplorerStore(s => s.lenses);
  const filters = useExplorerStore(s => s.filters);

  const openPrint = () => {
    const params = new URLSearchParams();
    params.set('lenses', lenses.map(l => l.id).join(','));
    if (filters.seasons.length)              params.set('seasons',    filters.seasons.join(','));
    if (filters.tastes.length)               params.set('tastes',     filters.tastes.join(','));
    if (filters.regions.length)              params.set('regions',    filters.regions.join(','));
    if (filters.visibility !== 'all')        params.set('visibility', filters.visibility);
    window.open(`/print?${params}`, '_blank');
  };

  return (
    <button
      onClick={openPrint}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#faf5ea', border: '1px solid #e0d6c4', borderRadius: 8,
        padding: '7px 14px', fontSize: '0.78rem', color: '#8a7450',
        cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: '0.06em',
      }}
    >
      <span style={{ fontSize: '1rem' }}>⎙</span>
      Print View
    </button>
  );
}

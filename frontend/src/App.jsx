import StoreMap from './StoreMap';

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Retail Store Map</h1>
        <p>Use the map to explore store locations by viewport and zoom.</p>

        <div className="sidebar-card">
          <strong>Instructions</strong>
          <p>
            Pan and zoom the map to load only visible data. At low zoom, you will see state totals. At medium zoom, clusters appear. At deep zoom, stores appear individually.
          </p>
        </div>
      </aside>

      <main className="map-panel">
        <StoreMap />
      </main>
    </div>
  );
}

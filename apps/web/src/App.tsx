import Papa from "papaparse";
import {
  Activity,
  BarChart3,
  Database,
  Eye,
  EyeOff,
  FileUp,
  Layers3,
  Map,
  Maximize2,
  RadioTower,
  RotateCcw,
  Satellite,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import {
  CellAggregate,
  datasetFromRecords,
  fuseDatasets,
  prototypeCapabilities,
  RawRecord,
  TerraFuseDataset
} from "@terrafuse/core";
import { BasemapStyle, GlobeWorkspace } from "./GlobeWorkspace";

const initialDatasets = [
  datasetFromRecords("Field observations", [
    { latitude: 49.2827, longitude: -123.1207, value: 82, category: "medical", timestamp: "2026-06-14T09:00:00Z" },
    { latitude: 49.265, longitude: -123.101, value: 58, category: "logistics", timestamp: "2026-06-14T09:04:00Z" },
    { latitude: 49.249, longitude: -123.117, value: 74, category: "shelter", timestamp: "2026-06-14T09:12:00Z" },
    { latitude: 49.231, longitude: -123.065, value: 35, category: "transport", timestamp: "2026-06-14T09:20:00Z" },
    { latitude: 49.312, longitude: -123.08, value: 91, category: "medical", timestamp: "2026-06-14T09:25:00Z" }
  ]),
  datasetFromRecords("Infrastructure signals", [
    { lat: 49.281, lon: -123.119, score: 66, type: "power", time: "2026-06-14T09:05:00Z" },
    { lat: 49.263, lon: -123.105, score: 88, type: "cell", time: "2026-06-14T09:07:00Z" },
    { lat: 49.247, lon: -123.114, score: 42, type: "road", time: "2026-06-14T09:17:00Z" },
    { lat: 49.304, lon: -123.075, score: 95, type: "power", time: "2026-06-14T09:23:00Z" },
    { lat: 49.226, lon: -123.07, score: 50, type: "water", time: "2026-06-14T09:28:00Z" }
  ])
];

export function App() {
  const [datasets, setDatasets] = useState<TerraFuseDataset[]>(initialDatasets);
  const [visibleDatasetIds, setVisibleDatasetIds] = useState(() => new Set(initialDatasets.map((dataset) => dataset.id)));
  const [basemap, setBasemap] = useState<BasemapStyle>("street");
  const [resolution, setResolution] = useState(4);
  const [activeCell, setActiveCell] = useState<CellAggregate | null>(null);
  const [isCopMode, setIsCopMode] = useState(false);
  const [dropState, setDropState] = useState<"idle" | "hover" | "error">("idle");
  const [message, setMessage] = useState("Drop CSV, GeoJSON, or JSON.");

  const visibleDatasets = useMemo(
    () => datasets.filter((dataset) => visibleDatasetIds.has(dataset.id)),
    [datasets, visibleDatasetIds]
  );
  const fusion = useMemo(() => fuseDatasets(visibleDatasets, resolution), [visibleDatasets, resolution]);

  async function ingestFiles(fileList: FileList | File[]) {
    const files = [...fileList];
    const parsed: TerraFuseDataset[] = [];

    for (const file of files) {
      const records = await parseFile(file);
      if (records.length === 0) {
        continue;
      }
      parsed.push(datasetFromRecords(file.name, records));
    }

    if (parsed.length === 0) {
      setDropState("error");
      setMessage("No usable rows found. TerraFuse needs lat/lon style fields for this prototype.");
      return;
    }

    setDatasets((current) => [...current, ...parsed]);
    setVisibleDatasetIds((current) => new Set([...current, ...parsed.map((dataset) => dataset.id)]));
    setDropState("idle");
    setMessage(`Added ${parsed.length} dataset${parsed.length === 1 ? "" : "s"} to the fusion workspace.`);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDropState("idle");
    void ingestFiles(event.dataTransfer.files);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void ingestFiles(event.target.files);
    }
  }

  function setDatasetVisibility(datasetId: string, visible: boolean) {
    setActiveCell(null);
    setVisibleDatasetIds((current) => {
      const next = new Set(current);
      if (visible) {
        next.add(datasetId);
      } else {
        next.delete(datasetId);
      }
      return next;
    });
  }

  function resetDemoData() {
    setDatasets(initialDatasets);
    setVisibleDatasetIds(new Set(initialDatasets.map((dataset) => dataset.id)));
    setActiveCell(null);
  }

  return (
    <main className={isCopMode ? "app cop-mode" : "app"} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <section className="map-stage" onDragEnter={() => setDropState("hover")}>
        <GlobeWorkspace basemap={basemap} cells={fusion.cells} onHover={setActiveCell} />

        <div className="brand-panel">
          <div>
            <span className="eyebrow">TerraFuse</span>
            <h1>DGGS-native geospatial fusion</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => setIsCopMode((value) => !value)} title="Toggle touch COP mode">
            <Maximize2 size={20} />
          </button>
        </div>

        <div className="cell-hover">
          <Eye size={18} />
          <div>
            <strong>{activeCell ? activeCell.cell : "Hover a cell"}</strong>
            <span>
              {activeCell
                ? `${activeCell.count} records, mean ${activeCell.mean.toFixed(1)}, ${Object.keys(activeCell.datasets).length} sources`
                : "Cell details appear here"}
            </span>
          </div>
        </div>

        <label className={`drop-target ${dropState}`}>
          <FileUp size={22} />
          <input type="file" multiple accept=".csv,.json,.geojson,application/json,text/csv" onChange={onFileInput} />
          <span>{message}</span>
        </label>

        <div className="map-attribution">Drag to rotate. Mouse wheel or trackpad pinch to zoom. H3 cells are anchored by latitude/longitude.</div>
      </section>

      <aside className="control-rail">
        <header>
          <span className="status-dot" />
          <div>
            <h2>Fusion Workspace</h2>
            <p>{prototypeCapabilities.name} turns geospatial data into fused DGGS cells.</p>
          </div>
        </header>

        <section className="metric-grid">
          <Metric icon={<Database size={18} />} label="Datasets" value={fusion.datasetCount.toString()} />
          <Metric icon={<Activity size={18} />} label="Records" value={fusion.recordCount.toString()} />
          <Metric icon={<Layers3 size={18} />} label="Cells" value={fusion.cells.length.toString()} />
          <Metric icon={<Sparkles size={18} />} label="Shared" value={fusion.sharedCellCount.toString()} />
        </section>

        <section className="tool-panel">
          <div className="panel-title">
            <SlidersHorizontal size={18} />
            <h3>DGGS Resolution</h3>
          </div>
          <input
            type="range"
            min="4"
            max="11"
            value={resolution}
            onChange={(event) => setResolution(Number(event.target.value))}
          />
          <div className="range-labels">
            <span>coarse</span>
            <strong>H3 r{resolution}</strong>
            <span>fine</span>
          </div>
        </section>

        <section className="tool-panel">
          <div className="panel-title">
            <Map size={18} />
            <h3>Basemap</h3>
          </div>
          <div className="segmented-control" role="group" aria-label="Basemap style">
            <button
              className={basemap === "street" ? "active" : ""}
              type="button"
              onClick={() => setBasemap("street")}
              title="Use OpenStreetMap street basemap"
            >
              <Map size={16} />
              Street
            </button>
            <button
              className={basemap === "satellite" ? "active" : ""}
              type="button"
              onClick={() => setBasemap("satellite")}
              title="Use Esri World Imagery satellite basemap"
            >
              <Satellite size={16} />
              Satellite
            </button>
          </div>
        </section>

        <section className="tool-panel">
          <div className="panel-title">
            <BarChart3 size={18} />
            <h3>Datasets</h3>
          </div>
          <div className="dataset-list">
            {datasets.map((dataset) => {
              const isVisible = visibleDatasetIds.has(dataset.id);
              return (
                <article key={dataset.id} className={isVisible ? "dataset-card" : "dataset-card muted"}>
                  <label className="dataset-toggle">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(event) => setDatasetVisibility(dataset.id, event.target.checked)}
                    />
                    {isVisible ? <Eye size={17} /> : <EyeOff size={17} />}
                    <strong>{dataset.name}</strong>
                  </label>
                  <span>{dataset.records.length} rows</span>
                  <small>
                    {dataset.schema.latField ?? "?"}/{dataset.schema.lonField ?? "?"}
                    {dataset.schema.valueField ? `, value: ${dataset.schema.valueField}` : ""}
                  </small>
                </article>
              );
            })}
          </div>
        </section>

        <section className="tool-panel">
          <div className="panel-title">
            <RadioTower size={18} />
            <h3>Common Picture</h3>
          </div>
          <button className="primary-button" type="button" onClick={() => setIsCopMode((value) => !value)}>
            {isCopMode ? "Return to analyst workspace" : "Open touch COP mode"}
          </button>
          <button className="secondary-button" type="button" onClick={resetDemoData}>
            <RotateCcw size={16} />
            Reset demo data
          </button>
        </section>
      </aside>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

async function parseFile(file: File): Promise<RawRecord[]> {
  const text = await file.text();
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".csv")) {
    const result = Papa.parse<RawRecord>(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
    return result.data.filter((row) => Object.keys(row).length > 0);
  }

  const parsed = JSON.parse(text) as unknown;
  if (isFeatureCollection(parsed)) {
    return parsed.features.map(featureToRecord).filter(Boolean) as RawRecord[];
  }

  if (Array.isArray(parsed)) {
    return parsed.filter((row): row is RawRecord => typeof row === "object" && row !== null);
  }

  return [];
}

function isFeatureCollection(value: unknown): value is {
  type: "FeatureCollection";
  features: Array<{ geometry?: { type: string; coordinates: unknown }; properties?: RawRecord }>;
} {
  return typeof value === "object" && value !== null && (value as { type?: string }).type === "FeatureCollection";
}

function featureToRecord(feature: { geometry?: { type: string; coordinates: unknown }; properties?: RawRecord }): RawRecord | null {
  const point = extractGeoJsonPoint(feature.geometry);
  if (!point) {
    return null;
  }

  return {
    ...(feature.properties ?? {}),
    latitude: point.lat,
    longitude: point.lon
  };
}

function extractGeoJsonPoint(geometry?: { type: string; coordinates: unknown }): { lat: number; lon: number } | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  if (geometry.type === "Point") {
    const [lon, lat] = geometry.coordinates as number[];
    return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
  }

  const flat = flattenCoordinates(geometry.coordinates);
  if (flat.length === 0) {
    return null;
  }

  const totals = flat.reduce(
    (sum, coordinate) => ({ lon: sum.lon + coordinate[0], lat: sum.lat + coordinate[1] }),
    { lon: 0, lat: 0 }
  );
  return { lat: totals.lat / flat.length, lon: totals.lon / flat.length };
}

function flattenCoordinates(value: unknown): number[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [[value[0], value[1]]];
  }

  return value.flatMap(flattenCoordinates);
}

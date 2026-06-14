import { latLngToCell } from "h3-js";

export type RawRecord = Record<string, unknown>;

export type DatasetSchema = {
  latField?: string;
  lonField?: string;
  valueField?: string;
  timeField?: string;
  labelField?: string;
};

export type TerraFuseDataset = {
  id: string;
  name: string;
  records: RawRecord[];
  schema: DatasetSchema;
};

export type CellAggregate = {
  cell: string;
  count: number;
  sum: number;
  mean: number;
  datasets: Record<string, number>;
  labels: string[];
};

export type FusionResult = {
  resolution: number;
  cells: CellAggregate[];
  datasetCount: number;
  recordCount: number;
  sharedCellCount: number;
};

const latCandidates = ["lat", "latitude", "y", "center_lat", "centroid_lat"];
const lonCandidates = ["lon", "lng", "long", "longitude", "x", "center_lon", "centroid_lon"];
const valueCandidates = ["value", "score", "weight", "magnitude", "intensity", "count"];
const timeCandidates = ["time", "timestamp", "datetime", "date", "observed_at"];
const labelCandidates = ["name", "label", "type", "category", "class", "source"];

export const prototypeCapabilities = {
  name: "TerraFuse",
  tagline: "Open-source geospatial fusion for DGGS-native analysis and common operating pictures.",
  dggs: ["H3"],
  ingest: ["CSV", "GeoJSON", "JSON"],
  analysis: ["cell aggregation", "resolution rollups", "multi-dataset cell fusion"],
  modes: ["analyst workspace", "touch COP"]
};

export function inferSchema(records: RawRecord[]): DatasetSchema {
  const fields = Object.keys(records[0] ?? {});
  return {
    latField: findField(fields, latCandidates),
    lonField: findField(fields, lonCandidates),
    valueField: findField(fields, valueCandidates),
    timeField: findField(fields, timeCandidates),
    labelField: findField(fields, labelCandidates)
  };
}

export function fuseDatasets(datasets: TerraFuseDataset[], resolution: number): FusionResult {
  const aggregates = new Map<string, CellAggregate>();
  let recordCount = 0;

  for (const dataset of datasets) {
    for (const record of dataset.records) {
      const point = extractPoint(record, dataset.schema);
      if (!point) {
        continue;
      }

      const cell = latLngToCell(point.lat, point.lon, resolution);
      const value = extractNumber(record, dataset.schema.valueField) ?? 1;
      const label = extractString(record, dataset.schema.labelField);
      const aggregate = aggregates.get(cell) ?? {
        cell,
        count: 0,
        sum: 0,
        mean: 0,
        datasets: {},
        labels: []
      };

      aggregate.count += 1;
      aggregate.sum += value;
      aggregate.mean = aggregate.sum / aggregate.count;
      aggregate.datasets[dataset.id] = (aggregate.datasets[dataset.id] ?? 0) + 1;

      if (label && !aggregate.labels.includes(label)) {
        aggregate.labels.push(label);
      }

      aggregates.set(cell, aggregate);
      recordCount += 1;
    }
  }

  const cells = [...aggregates.values()].sort((left, right) => right.count - left.count);
  const sharedCellCount = cells.filter((cell) => Object.keys(cell.datasets).length > 1).length;

  return {
    resolution,
    cells,
    datasetCount: datasets.length,
    recordCount,
    sharedCellCount
  };
}

export function datasetFromRecords(name: string, records: RawRecord[]): TerraFuseDataset {
  return {
    id: slugId(name),
    name,
    records,
    schema: inferSchema(records)
  };
}

function findField(fields: string[], candidates: string[]): string | undefined {
  return candidates
    .map((candidate) => fields.find((field) => field.toLowerCase() === candidate))
    .find(Boolean);
}

function extractPoint(record: RawRecord, schema: DatasetSchema): { lat: number; lon: number } | null {
  const lat = extractNumber(record, schema.latField);
  const lon = extractNumber(record, schema.lonField);
  if (lat === undefined || lon === undefined || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return { lat, lon };
}

function extractNumber(record: RawRecord, field?: string): number | undefined {
  if (!field) {
    return undefined;
  }

  const value = record[field];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function extractString(record: RawRecord, field?: string): string | undefined {
  if (!field) {
    return undefined;
  }

  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function slugId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "dataset"}-${Math.random().toString(36).slice(2, 8)}`;
}

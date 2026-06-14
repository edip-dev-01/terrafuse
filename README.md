# TerraFuse

Open-source geospatial fusion for DGGS-native analysis and common operating pictures.

TerraFuse is an early prototype of a drag-and-drop web environment for geospatial data fusion. The first slice focuses on H3-backed cell aggregation, Cesium globe visualization, and a full-stack project shape that can grow into server-side ingest, analysis, collaboration, and operator-room workflows.

## Prototype Features

- Drag and drop CSV, GeoJSON, or JSON files.
- Auto-detect latitude/longitude, value, timestamp, and category-like fields.
- Convert records into H3 cells at selectable resolution.
- Render fused cell layers as geospatial polygons on a Cesium globe with an OpenStreetMap basemap.
- Compare uploaded datasets by shared cell and fused score.
- Switch into a touch-oriented common operating picture layout.

## Run Locally

```bash
npm install
npm run dev
```

The web app runs on `http://localhost:5173`. The API runs on `http://localhost:8787`.

## Project Shape

- `apps/web`: React, Vite, CesiumJS globe UI.
- `apps/api`: Express API skeleton for future ingest/workspaces.
- `packages/core`: Shared DGGS indexing and fusion logic.

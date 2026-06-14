import { cellToBoundary, cellToLatLng } from "h3-js";
import { useEffect, useRef } from "react";
import {
  ArcGisMapServerImageryProvider,
  Cartesian2,
  Cartesian3,
  Color,
  Entity,
  HorizontalOrigin,
  ImageryLayer,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { CellAggregate } from "@terrafuse/core";

export type BasemapStyle = "street" | "satellite";

type GlobeWorkspaceProps = {
  basemap: BasemapStyle;
  cells: CellAggregate[];
  onHover: (cell: CellAggregate | null) => void;
};

const vancouver = { lat: 49.2827, lon: -123.1207 };

Ion.defaultAccessToken = "";

export function GlobeWorkspace({ basemap, cells, onHover }: GlobeWorkspaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const basemapLayerRef = useRef<ImageryLayer | null>(null);
  const cellLookupRef = useRef(new Map<string, CellAggregate>());
  const onHoverRef = useRef(onHover);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || viewerRef.current) {
      return;
    }

    const viewer = new Viewer(host, {
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      shouldAnimate: false,
      timeline: false
    });

    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(vancouver.lon, vancouver.lat, 650000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-54),
        roll: 0
      }
    });

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: ScreenSpaceEventHandler.MotionEvent) => {
      const picked = viewer.scene.pick(movement.endPosition) as { id?: Entity } | undefined;
      const entityId = picked?.id?.id;
      onHoverRef.current(entityId ? (cellLookupRef.current.get(entityId) ?? null) : null);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      onHoverRef.current(null);
    }, ScreenSpaceEventType.LEFT_UP);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
      basemapLayerRef.current = null;
      cellLookupRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const nextLayer = createBasemapLayer(basemap);
    const currentLayer = basemapLayerRef.current;
    if (currentLayer) {
      viewer.imageryLayers.remove(currentLayer, true);
    }

    viewer.imageryLayers.add(nextLayer, 0);
    basemapLayerRef.current = nextLayer;
  }, [basemap]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.entities.removeAll();
    const lookup = new Map<string, CellAggregate>();

    for (const cell of cells) {
      lookup.set(cell.cell, cell);
      addCellEntity(viewer, cell);
    }

    cellLookupRef.current = lookup;
  }, [cells]);

  return <div className="globe-workspace" ref={hostRef} aria-label="Interactive Cesium TerraFuse globe" />;
}

function createBasemapLayer(basemap: BasemapStyle) {
  if (basemap === "satellite") {
    return ImageryLayer.fromProviderAsync(
      ArcGisMapServerImageryProvider.fromUrl("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer", {
        credit: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      })
    );
  }

  return new ImageryLayer(
    new OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/",
      credit: "(c) OpenStreetMap contributors"
    })
  );
}

function addCellEntity(viewer: Viewer, cell: CellAggregate) {
  const shared = Object.keys(cell.datasets).length > 1;
  const fill = shared ? Color.ORANGE.withAlpha(0.34) : Color.CYAN.withAlpha(0.26);
  const outline = shared ? Color.fromCssColorString("#f5be48") : Color.fromCssColorString("#3ac7dc");
  const boundary = cellToBoundary(cell.cell);
  const hierarchy = new PolygonHierarchy(boundary.map(([lat, lon]) => Cartesian3.fromDegrees(lon, lat, 200)));
  const [lat, lon] = cellToLatLng(cell.cell);

  viewer.entities.add({
    id: cell.cell,
    name: cell.cell,
    position: Cartesian3.fromDegrees(lon, lat, 1200),
    polygon: {
      hierarchy,
      material: fill,
      outline: true,
      outlineColor: outline,
      outlineWidth: shared ? 3 : 2,
      perPositionHeight: true
    },
    point: {
      color: outline,
      outlineColor: Color.BLACK.withAlpha(0.55),
      outlineWidth: 1,
      pixelSize: shared ? 10 : 8
    },
    label: shared
      ? {
          text: `${cell.count}`,
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          pixelOffset: new Cartesian2(0, -18),
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          scale: 0.42
        }
      : undefined
  });
}

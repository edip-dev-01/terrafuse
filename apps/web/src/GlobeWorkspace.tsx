import { cellToBoundary, cellToLatLng } from "h3-js";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CellAggregate } from "@terrafuse/core";

type GlobeWorkspaceProps = {
  cells: CellAggregate[];
  onHover: (cell: CellAggregate | null) => void;
};

const globeRadius = 2;
const cellRadius = 2.085;
const markerRadius = 2.13;

export function GlobeWorkspace({ cells, onHover }: GlobeWorkspaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onHoverRef = useRef(onHover);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const container = host;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071015");

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.copy(latLonToVector(49.26, -123.12, 5.4));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.55;
    controls.maxDistance = 8.8;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.82;
    controls.target.set(0, 0, 0);
    controls.update();

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 96, 64),
      new THREE.MeshPhongMaterial({
        color: "#132d3a",
        emissive: "#061116",
        shininess: 12,
        specular: "#285b67"
      })
    );
    scene.add(globe);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.012, 96, 64),
      new THREE.MeshBasicMaterial({
        color: "#63d5dc",
        transparent: true,
        opacity: 0.075,
        side: THREE.BackSide
      })
    );
    atmosphere.scale.setScalar(1.05);
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight("#8bb7c0", 1.3));
    const keyLight = new THREE.DirectionalLight("#f6fbff", 2.1);
    keyLight.position.set(-3, 3, 5);
    scene.add(keyLight);

    const graticule = buildGraticule();
    scene.add(graticule);

    const cellGroup = new THREE.Group();
    const hitTargets: THREE.Object3D[] = [];
    cells.forEach((cell) => addCellToGlobe(cellGroup, hitTargets, cell));
    scene.add(cellGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: CellAggregate | null = null;

    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(hitTargets, false)[0]?.object as THREE.Mesh | undefined;
      const nextCell = (hit?.userData.cell as CellAggregate | undefined) ?? null;
      if (nextCell?.cell !== hovered?.cell) {
        hovered = nextCell;
        onHoverRef.current(nextCell);
      }
    }

    function onPointerLeave() {
      hovered = null;
      onHoverRef.current(null);
    }

    let frameId = 0;
    function animate() {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    resize();
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [cells]);

  return <div className="globe-workspace" ref={hostRef} aria-label="Interactive 3D TerraFuse globe" />;
}

function addCellToGlobe(group: THREE.Group, hitTargets: THREE.Object3D[], cell: CellAggregate) {
  const shared = Object.keys(cell.datasets).length > 1;
  const color = shared ? new THREE.Color("#f5be48") : new THREE.Color("#3ac7dc");
  const h3Boundary = cellToBoundary(cell.cell);
  const points = h3Boundary.map(([lat, lon]) => latLonToVector(lat, lon, cellRadius));
  points.push(points[0].clone());

  const [lat, lon] = cellToLatLng(cell.cell);
  const center = latLonToVector(lat, lon, cellRadius);
  const fillGeometry = new THREE.BufferGeometry().setFromPoints([center, ...points.slice(0, -1)]);
  const indices: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    indices.push(0, index, index === points.length - 1 ? 1 : index + 1);
  }
  fillGeometry.setIndex(indices);
  fillGeometry.computeVertexNormals();
  const fill = new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: shared ? 0.38 : 0.26,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    })
  );
  fill.renderOrder = 3;
  group.add(fill);

  const boundaryMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 72, shared ? 0.01 : 0.008, 8, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthTest: false,
      opacity: shared ? 0.96 : 0.78
    })
  );
  boundaryMesh.renderOrder = 4;
  group.add(boundaryMesh);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(shared ? 0.033 : 0.025, 16, 12),
    new THREE.MeshBasicMaterial({ color })
  );
  marker.position.copy(latLonToVector(lat, lon, markerRadius));
  marker.userData.cell = cell;
  marker.renderOrder = 5;
  group.add(marker);
  hitTargets.push(marker);

  const glyph = buildAnchoredHexGlyph(lat, lon, shared ? 0.16 : 0.13, color);
  glyph.userData.cell = cell;
  glyph.renderOrder = 6;
  glyph.traverse((object) => {
    object.userData.cell = cell;
    if (object instanceof THREE.Mesh) {
      hitTargets.push(object);
    }
  });
  group.add(glyph);
}

function buildAnchoredHexGlyph(lat: number, lon: number, size: number, color: THREE.Color) {
  const center = latLonToVector(lat, lon, markerRadius + 0.012);
  const normal = center.clone().normalize();
  const polarAxis = Math.abs(normal.y) > 0.94 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(polarAxis, normal).normalize();
  const north = new THREE.Vector3().crossVectors(normal, east).normalize();
  const ring = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index + Math.PI / 6;
    return center.clone().addScaledVector(east, Math.cos(angle) * size).addScaledVector(north, Math.sin(angle) * size);
  });

  const fillGeometry = new THREE.BufferGeometry().setFromPoints([center, ...ring]);
  fillGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 1]);
  fillGeometry.computeVertexNormals();
  const fill = new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );

  const outlinePoints = [...ring, ring[0]];
  const outline = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outlinePoints, true), 48, 0.008, 8, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false })
  );

  const group = new THREE.Group();
  group.add(fill, outline);
  return group;
}

function buildGraticule() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: "#7fa7ad",
    transparent: true,
    opacity: 0.24
  });

  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      points.push(latLonToVector(lat, lon, globeRadius + 0.006));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  for (let lon = -180; lon < 180; lon += 30) {
    const points = [];
    for (let lat = -84; lat <= 84; lat += 4) {
      points.push(latLonToVector(lat, lon, globeRadius + 0.006));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  return group;
}

function latLonToVector(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

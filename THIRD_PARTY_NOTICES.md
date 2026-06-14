# Third-Party Notices

TerraFuse is licensed under the Apache License, Version 2.0.

The current prototype depends on third-party packages installed through npm. The dependency set was checked with `license-checker --excludePrivatePackages` before adding the project license. The dependency licenses are predominantly permissive and compatible with Apache-2.0 distribution.

## License Summary

- MIT
- ISC
- BSD-2-Clause
- BSD-3-Clause
- Apache-2.0
- 0BSD
- MIT OR Apache-2.0
- MIT AND Zlib
- ODbL / OpenStreetMap attribution for streamed basemap data

## Notable Transitive Dependencies

- `cesium` / CesiumJS is licensed under Apache-2.0 and is used for the 3D globe, camera controls, and geospatial rendering runtime.
- The prototype uses OpenStreetMap tiles from `https://tile.openstreetmap.org/` as an online basemap layer. OpenStreetMap data is licensed under the Open Database License (ODbL), and OSM tile use requires attribution and compliance with the OpenStreetMap tile usage policy. TerraFuse displays `© OpenStreetMap contributors` through Cesium's credit system. For production deployments, replace this with an appropriate hosted tile service or Cesium ion imagery account.
- `jszip` is dual licensed as `MIT OR GPL-3.0-or-later`; TerraFuse relies on the MIT option.
- `caniuse-lite` is licensed under CC-BY-4.0 and is used as browser compatibility data through the frontend build toolchain.
- `@mapbox/jsonlint-lines-primitives` is reported by `license-checker` as a custom license linked to the Mapbox/jsonlint package; it is a transitive development/tooling dependency.

The authoritative dependency graph is `package-lock.json`. When adding or upgrading dependencies, rerun a license scan and update this file if new license families appear.

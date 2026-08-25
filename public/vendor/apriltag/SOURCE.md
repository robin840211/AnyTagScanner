# AprilTag WebAssembly provenance

- Wrapper project: https://github.com/arenaxr/apriltag-js-standalone
- Wrapper commit: `f0fe55676265a1251ad36f18bac9939206a59e19`
- Detector source: https://github.com/WiseLabCMU/apriltag
- Detector commit: `4cdba6a8c6cf4efeb032fa5542da927d4677c035`
- Supported family in this build: `tag36h11`

## Distributed files

| File | SHA-256 |
|---|---|
| `apriltag_wasm.js` | `DFD03EA330012975FF3185872053229F5C638FD4EBD228FD80C0C7218A15B201` |
| `apriltag_wasm.wasm` | `0283215C40F3BCD265D2650AEB0D4419E87222830FE8A31A1978401A4CAC77AA` |

The local `worker.js` replaces the upstream example's CDN-based Comlink wrapper. It initializes the same compiled detector with pose output disabled and exposes only local message-based detection.

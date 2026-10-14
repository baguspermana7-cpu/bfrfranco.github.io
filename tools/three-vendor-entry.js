/* The three.js subset behind js/vendor/three-r170.min.js (DH01 3D + CFD view), as the global RZ3.
 * Rebuild:  npm pack three@0.170.0 && tar xzf three-0.170.0.tgz
 *           (point examples/jsm/controls/OrbitControls.js at ../../../build/three.module.js)
 *           npx esbuild@0.24.0 tools/three-vendor-entry.js --bundle --minify --format=iife --global-name=RZ3 \
 *             --legal-comments=none --banner:js="/* three.js r170 (MIT) … *\/" --outfile=js/vendor/three-r170.min.js
 * Licence: js/vendor/three-LICENSE.txt. Lazy-loaded by js/ltc-dh01.js on the first switch to 3D. */
export { WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, Color, Fog, AmbientLight, HemisphereLight, DirectionalLight, PointLight,
  BoxGeometry, PlaneGeometry, CylinderGeometry, CircleGeometry, BufferGeometry, BufferAttribute, InstancedMesh, Mesh, Group, Points, LineSegments, Line,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial, PointsMaterial, ShaderMaterial, CanvasTexture, Object3D, Matrix4, Vector2, Vector3, Raycaster,
  EdgesGeometry, AdditiveBlending, NormalBlending, DoubleSide, SRGBColorSpace, ACESFilmicToneMapping, Quaternion, TubeGeometry, CatmullRomCurve3, LineCurve3, CurvePath, InstancedBufferAttribute, DynamicDrawUsage, PCFSoftShadowMap, GridHelper, Data3DTexture, DataTexture, FloatType, HalfFloatType, RGBAFormat, RedFormat, LinearFilter, NearestFilter, BackSide, FrontSide, GLSL3, UnsignedByteType } from './package/build/three.module.js';

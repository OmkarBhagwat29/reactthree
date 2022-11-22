import React, { useRef, useState, Suspense, useEffect } from "react";

import "./css/App.scss";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";

import { OrbitControls, Html } from "@react-three/drei";

import { Rhino3dmLoader } from "three/examples/jsm/loaders/3DMLoader";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

import * as THREE from "three";

THREE.Object3D.DefaultUp.set(0, 0, 1);
// softShadows();
let lableData, spaceData;
const LoadRhinoModel = ({ url, setModel, canvas, setLabels }) => {
  const rhinoObject = useLoader(Rhino3dmLoader, url, (loader) =>
    loader.setLibraryPath("https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/")
  );

  const { camera } = useThree();

  spaceData = GetSpaceData(rhinoObject);
  //console.log("loaded!!!");
  useFrame(() => {
    if (rhinoObject != null) {
      lableData = GetCSSCoords(spaceData, camera, canvas.current);

      setLabels(lableData);
    }
  });

  return (
    <>
      rhinoObject && (<primitive object={rhinoObject} dispose={null} />)
    </>
  );
};

const HTMLContent = (props) => {
  return (
    <group>
      <mesh {...props}>
        <Html fullscreen></Html>

        <LoadRhinoModel
          url="/testModel.3dm"
          setModel={props.setModel}
          canvas={props.canvas}
          setLabels={props.setLabels}
        />
      </mesh>
    </group>
  );
};

const App = () => {
  const myCanvas = useRef();

  const [model, setModel] = useState(null);
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    if (model) {
      // create pccupancy spheres here
    }
  }, [model]);

  return (
    <>
      <div id="labels">
        {labels.map((label, index) => {
          return (
            <div
              key={index}
              style={{
                left: label.x,
                top: label.y,
                padding: "3px",
                border: "1px solid black",
                borderRadius: "10px",
                backgroundColor: "white",
                opacity: 0.65,
              }}
            >
              {label.spaceName}
            </div>
          );
        })}
      </div>

      <Canvas
        ref={myCanvas}
        onCreated={(state) => {
          setCamera(state.camera);
        }}
        camera={{ fov: 10, position: [1, -2, 100] }}
      >
        <color attach="background" args={["#f2f2f2"]} />

        <ambientLight intensity={0.25} />
        <directionalLight position={[1, 1, 20]} intensity={1} />
        <directionalLight position={[-1, 1, 20]} intensity={1} />

        <Suspense fallback={null}>
          <HTMLContent
            position={[0, 0, 0]}
            setModel={setModel}
            canvas={myCanvas}
            setLabels={setLabels}
          />
        </Suspense>

        <OrbitControls />
      </Canvas>
    </>
  );
};

function GetCSSCoords(data, camera, canvas) {
  const coords = [];

  data.forEach((d) => {
    const center = d.center;
    const spaceName = d.space.name;
    const c = center.clone();
    c.z += 1;

    var widthHalf = 0.5 * canvas.width;
    var heightHalf = 0.5 * canvas.height;

    let tempV = c.clone();

    // get the normalized screen coordinate of that position
    // x and y will be in the -1 to +1 range with x = -1 being
    // on the left and y = -1 being on the bottom
    var vec = tempV.project(camera);

    const x = vec.x * widthHalf + widthHalf;
    const y = -(vec.y * heightHalf) + heightHalf;

    coords.push({ spaceName, x, y });
  });

  return coords;
}

function GetSpaceData(model) {
  const data = [];

  const children = model.children;
  const layers = model.userData.layers;

  children.forEach((space) => {
    if (space.userData.hasOwnProperty("attributes")) {
      if ("layerIndex" in space.userData.attributes) {
        const layerName = layers[space.userData.attributes.layerIndex].name;

        if (layerName === "Spaces") {
          const center = GetCenterOfMesh(space);

          data.push({ center, space });
        }
      }
    }
  });

  return data;
}

//this is will be the position for lable
function GetCenterOfMesh(mesh) {
  const middle = new THREE.Vector3();
  const geometry = mesh.geometry;

  geometry.computeBoundingBox();

  middle.x = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
  middle.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
  middle.z = (geometry.boundingBox.max.z + geometry.boundingBox.min.z) / 2;

  mesh.localToWorld(middle);

  return middle;
}

//occupancz curves and its vertices
function GetOccCurves(model, scene) {
  const cvs = [];

  const layers = model.userData.layers;

  scene.traverse(function (cv) {
    if (cv.userData.hasOwnProperty("attributes")) {
      if ("layerIndex" in cv.userData.attributes) {
        const layerName = layers[cv.userData.attributes.layerIndex].name;

        if (layerName === "Occ") {
          const positionAttribute = cv.geometry.getAttribute("position");

          const vertex = new THREE.Vector3();

          let vertices = [];

          for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i); // read vertex

            let tempV = vertex.clone();

            vertices.push(tempV);
          }

          cvs.push({ cv, vertices });
        }
      }
    }
  });

  return cvs;
}

//generate random points inside the space/closed planar boundary
function GetRandomPoints(scene, cv, cVertices, count) {
  var geometry = new ConvexGeometry(cVertices);

  //scene.add(testMesh);

  const dummyTarget = new THREE.Vector3(); //to prevent logging of warnings from ray.at() method

  const ray = new THREE.Ray();

  const size = new THREE.Vector3();
  geometry.computeBoundingBox();
  let bbox = geometry.boundingBox;

  let points = [];

  var dir = new THREE.Vector3(1, 1, 1).normalize();

  let counter = 0;

  while (counter < count) {
    let v = new THREE.Vector3(
      THREE.MathUtils.randFloat(bbox.min.x, bbox.max.x),
      THREE.MathUtils.randFloat(bbox.min.y, bbox.max.y),
      THREE.MathUtils.randFloat(bbox.min.z, bbox.max.z)
    );

    points.push(v);
    counter++;

    const spGeom = new THREE.SphereGeometry(0.25, 32, 16);

    const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const sphere = new THREE.Mesh(spGeom, material);

    sphere.position.set(v.x, v.y, 0.35);

    scene.add(sphere);
  }

  function isInside(v) {
    ray.set(v, dir);
    let counter = 0;

    let pos = geometry.attributes.position;
    let faces = pos.count / 3;
    //console.log(faces);
    let vA = new THREE.Vector3(),
      vB = new THREE.Vector3(),
      vC = new THREE.Vector3();
    for (let i = 0; i < faces; i++) {
      vA.fromBufferAttribute(pos, i * 3 + 0);
      vB.fromBufferAttribute(pos, i * 3 + 1);
      vC.fromBufferAttribute(pos, i * 3 + 2);
      if (ray.intersectTriangle(vA, vB, vC, false, dummyTarget)) counter++;
    }

    return counter % 2 == 1;
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}

function GetRandomPointsInsideMesh(scene, mesh, count) {
  //scene.add(testMesh);

  const dummyTarget = new THREE.Vector3(); //to prevent logging of warnings from ray.at() method

  const ray = new THREE.Ray();

  const geometry = mesh.geometry;

  const size = new THREE.Vector3();
  geometry.computeBoundingBox();
  let bbox = geometry.boundingBox;

  let points = [];

  var dir = new THREE.Vector3(1, 1, 1).normalize();

  let counter = 0;

  while (counter < count) {
    let v = new THREE.Vector3(
      THREE.MathUtils.randFloat(bbox.min.x, bbox.max.x),
      THREE.MathUtils.randFloat(bbox.min.y, bbox.max.y),
      THREE.MathUtils.randFloat(bbox.min.z, bbox.max.z)
    );

    points.push(v);
    counter++;

    const spGeom = new THREE.SphereGeometry(0.25, 32, 16);

    const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const sphere = new THREE.Mesh(spGeom, material);

    sphere.position.set(v.x, v.y, 0.35);

    scene.add(sphere);
  }

  function isInside(v) {
    ray.set(v, dir);
    let counter = 0;

    let pos = geometry.attributes.position;
    let faces = pos.count / 3;
    //console.log(faces);
    let vA = new THREE.Vector3(),
      vB = new THREE.Vector3(),
      vC = new THREE.Vector3();
    for (let i = 0; i < faces; i++) {
      vA.fromBufferAttribute(pos, i * 3 + 0);
      vB.fromBufferAttribute(pos, i * 3 + 1);
      vC.fromBufferAttribute(pos, i * 3 + 2);
      if (ray.intersectTriangle(vA, vB, vC, false, dummyTarget)) counter++;
    }

    return counter % 2 == 1;
  }

  return points;
}

function maxMin(arr) {
  let maxNum = -Infinity;
  let minNum = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > maxNum) {
      maxNum = arr[i];
    }

    if (arr[i] < minNum) {
      minNum = arr[i];
    }
  }

  return { maxNum, minNum };
}

export default App;

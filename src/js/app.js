import { MSDFTextGeometry, uniforms } from "three-msdf-text";
import * as THREE from "three";
import fragment from "../js/shader/fragment.glsl";
import vertex from "../js/shader/vertex.glsl";
import VirtualScroll from "virtual-scroll";

import fnt from "../font/KyivTypeSans-Black2-msdf.json";
import atlasURL from "../font/KyivTypeSans-Black2.png";

// console.log(fnt, atlasURL);

const TEXTS = [
  "Bungalow",
  "Chatoyant",
  "Demure",
  "Denouement",
  "Effervescent",
  "Elegance",
  "Elixir",
  "Eloquence",
  "Ephemeral",
  "Epiphany",
  "Bungalow",
  "Chatoyant",
  "Demure",
  "Denouement",
  "Effervescent",
  "Elegance",
  "Elixir",
  "Eloquence",
  "Ephemeral",
  "Epiphany",
];

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();
    this.sceneCopy = new THREE.Scene();
    this.groupCopy = new THREE.Group();
    this.sceneCopy.add(this.groupCopy);
    this.group = new THREE.Group();
    this.groupPlane = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(this.groupPlane);

    this.textures = [...document.querySelectorAll(".js-texture")];

    this.textures = this.textures.map((t) => {
      return new THREE.TextureLoader().load(t.src);
    });

    this.container = options.dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0xeeeeee, 1);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.appendChild(this.renderer.domElement);

    this.position = 0;
    this.speed = 0;
    this.targetSpeed = 0;
    this.scroller = new VirtualScroll();
    this.scroller.on((event) => {
      // wrapper.style.transform = `translateY(${event.y}px)`;
      this.position = event.y / 2000;
      this.speed = event.deltaY / 2000;
    });

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.01,
      100
    );
    this.camera.position.set(0, 0, 2);

    this.time = 0;

    this.isPlaying = true;

    this.addTexts();
    this.addObjects();
    this.resize();
    this.render();
    this.setupResize();
    // this.addLight();
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    this.camera.updateProjectionMatrix();
  }

  addTexts() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      defines: {
        IS_SMALL: false,
      },
      extensions: {
        derivatives: true,
      },
      uniforms: {
        uSpeed: { value: 0 },
        // Common
        ...uniforms.common,

        // Rendering
        ...uniforms.rendering,

        // Strokes
        ...uniforms.strokes,
      },
      vertexShader: `
          // Attribute
          #include <three_msdf_attributes>
  
          // Varyings
          #include <three_msdf_varyings>
          mat4 rotationMatrix(vec3 axis, float angle) {
            axis = normalize(axis);
            float s = sin(angle);
            float c = cos(angle);
            float oc = 1.0 - c;
            
            return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                        0.0,                                0.0,                                0.0,                                1.0);
        }
        
        vec3 rotate(vec3 v, vec3 axis, float angle) {
          mat4 m = rotationMatrix(axis, angle);
          return (m * vec4(v, 1.0)).xyz;
        }

        uniform float uSpeed;
  
          void main() {
            // Varyings
            vUv = uv;
            vLayoutUv = layoutUv;
            
            vNormal = normal;
            
            vLineIndex = lineIndex;
            
            vLineLettersTotal = lineLettersTotal;
            vLineLetterIndex = lineLetterIndex;
            
            vLineWordsTotal = lineWordsTotal;
            vLineWordIndex = lineWordIndex;
            
            vWordIndex = wordIndex;
            
            vLetterIndex = letterIndex;

            // Output
            vec3 newpos = position;
            float xx = position.x*.003;
            newpos = rotate(newpos, vec3(.0, 0.0, 1.0), uSpeed*xx*xx);

            vec4 mvPosition = vec4(newpos, 1.0);
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;

            vViewPosition = -mvPosition.xyz;
          }
      `,
      fragmentShader: `
          // Varyings
          #include <three_msdf_varyings>
  
          // Uniforms
          #include <three_msdf_common_uniforms>
          #include <three_msdf_strokes_uniforms>
  
          // Utils
          #include <three_msdf_median>
  
          void main() {
              // Common
              #include <three_msdf_common>
  
              // Strokes
              #include <three_msdf_strokes>
  
              // Alpha Test
              #include <three_msdf_alpha_test>
  
              // Outputs
              #include <three_msdf_strokes_output>

              gl_FragColor = vec4(0.,239.,235.,1.);
          }
      `,
    });

    Promise.all([loadFontAtlas(atlasURL)]).then(([atlas]) => {
      this.size = 0.2;

      this.material.uniforms.uMap.value = atlas;

      TEXTS.forEach((text, i) => {
        const geometry = new MSDFTextGeometry({
          text: text.toUpperCase(),
          font: fnt,
        });

        const mesh = new THREE.Mesh(geometry, this.material);
        let s = 0.005;
        mesh.scale.set(s, -s, s);
        mesh.position.x = -0.5;
        mesh.position.y = this.size * i;

        this.group.add(mesh);
        this.groupCopy.add(mesh.clone());
      });
    });

    function loadFontAtlas(path) {
      const promise = new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(path, resolve);
      });

      return promise;
    }
  }

  addObjects() {
    let that = this;
    this.planematerial = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable",
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        uTexture: { value: this.textures[0] },
        resolution: { value: new THREE.Vector4() },
      },
      // wireframe: true,
      // transparent: true,
      vertexShader: vertex,
      fragmentShader: fragment,
    });

    this.geometry = new THREE.PlaneGeometry(1.77 / 2, 1 / 2, 30, 30).translate(
      0,
      0,
      1
    );
    let pos = this.geometry.attributes.position.array;
    let newpos = [];
    let r = 1.2;

    for (let i = 0; i < pos.length; i += 3) {
      let x = pos[i];
      let y = pos[i + 1];
      let z = pos[i + 2];

      let xz = new THREE.Vector2(x, z).normalize().multiplyScalar(r);

      let xyz = new THREE.Vector3(x, y, z).normalize().multiplyScalar(r);

      newpos.push(xz.x, y, xz.y);
    }

    // let testmesh = new THREE.Mesh(
    //   new THREE.SphereGeometry(r, 32, 32),
    //   new THREE.MeshBasicMaterial({ wireframe: true, color: 0xff0000 })
    // );
    // this.scene.add(testmesh);

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(newpos, 3)
    );

    this.plane = new THREE.Mesh(this.geometry, this.planematerial);
    this.groupPlane.add(this.plane);
  }

  addLight() {
    const light1 = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(0.5, 0, 0.866);
    this.scene.add(light2);
  }

  stop() {
    this.isPlaying = false;
  }

  play() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.render();
    }
  }

  updateTexture() {
    // console.log(Math.round(this.position));
    let index = Math.round(this.position + 10000) % this.textures.length;
    this.planematerial.uniforms.uTexture.value = this.textures[index];
    this.groupCopy.children.forEach((mesh, i) => {
      if (i !== index) {
        mesh.visible = false;
      } else {
        mesh.visible = true;
      }
    });
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.05;
    this.updateTexture();
    this.speed *= 0.9;
    this.targetSpeed += (this.speed - this.targetSpeed) * 0.1;
    this.material.uniforms.uSpeed.value = this.targetSpeed;

    this.group.position.y = -this.position * this.size - 0.05;
    this.groupCopy.position.y = -this.position * this.size - 0.05;

    this.plane.rotation.y = this.position * 2 * Math.PI;
    this.groupPlane.rotation.z = 0.2 * Math.sin(this.position * 0.5);
    requestAnimationFrame(this.render.bind(this));
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.sceneCopy, this.camera);
  }
}

new Sketch({
  dom: document.getElementById("container"),
});

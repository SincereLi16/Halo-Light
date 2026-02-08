import * as THREE from "three";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let material: THREE.ShaderMaterial | null = null;
let startTime = performance.now();

const VERT_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAG_SHADER = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_wobbleAmount;   // 形变强度
uniform float u_wobbleSpeed;    // 形变速度

// HSL -> RGB 辅助
vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb1;
  if (hp < 1.0) rgb1 = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb1 = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb1 = vec3(0.0, c, x);
  else if (hp < 4.0) rgb1 = vec3(0.0, x, c);
  else if (hp < 5.0) rgb1 = vec3(x, 0.0, c);
  else rgb1 = vec3(c, 0.0, x);
  float m = l - 0.5 * c;
  return rgb1 + vec3(m);
}

float angleDiff(float a, float b) {
  float d = a - b;
  return atan(sin(d), cos(d));
}

const float PI = 3.14159265;
const float TWO_PI = 6.2831853;

// 沿圆周的局部形变“锚点”，中心最强，向两侧平滑衰减
float lobe(float theta, float center, float width) {
  float d = angleDiff(theta, center);
  float x = d / width;
  return exp(-x * x);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 center = 0.5 * u_resolution;
  // 稍微缩小半径，避免光斑边缘被画布裁切
  float radius = 0.32 * min(u_resolution.x, u_resolution.y);
  vec2 uv = (frag - center) / radius;
  float r = length(uv);
  if (r > 1.6) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float theta = atan(uv.y, uv.x);
  float t = u_time;

  // 基础夕阳灯光斑：单色、中心亮、边缘柔和
  // 仅在“半影环带”内设置 3 个随时间绕圈的形变锚点，制造不规则呼吸感
  // 半影环带固定为 [innerR, outerR]，以后可与 Canvas 半影参数对齐
  float innerR = 0.45;  // 动效开始的半径
  float outerR = 1.25;  // 动效结束的半径
  float radialFactor = smoothstep(innerR, outerR, r); // 中心基本不动，靠近外缘才形变

  // 三个锚点沿圆周匀速运动，速度由 u_wobbleSpeed 控制
  float moveSpeed = mix(0.15, 2.5, clamp(u_wobbleSpeed, 0.0, 1.0));
  float theta0 = t * moveSpeed;
  float theta1 = theta0 + TWO_PI / 3.0;
  float theta2 = theta0 + 2.0 * TWO_PI / 3.0;

  // 每个锚点自身也在轻微呼吸（向内/向外）
  float a0 = sin(t * 1.1);
  float a1 = sin(t * 1.4 + 1.3);
  float a2 = sin(t * 0.9 + 2.1);

  // 局部形变叠加（三个高斯锚点）
  float w0 = a0 * lobe(theta, theta0, 0.6);
  float w1 = a1 * lobe(theta, theta1, 0.6);
  float w2 = a2 * lobe(theta, theta2, 0.6);
  float wobbleBase = w0 + w1 + w2;

  // 形变强度控制整体幅度：放大一些，让同样的滑块值下起伏更明显
  float wobble = u_wobbleAmount * 2.0 * radialFactor * wobbleBase;
  float rLocal = r + wobble;

  // 高斯型径向衰减：中心最亮，向外平滑变暗
  // 固定为较柔和的边缘（相当于“边缘软硬”打满）
  float k = 1.2;
  float intensity = exp(-rLocal * rLocal * k);

  if (intensity < 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // 暖色夕阳灯单色
  vec3 baseColor = hsl2rgb(vec3(0.08, 0.8, 0.65)); // 稍偏橙黄
  vec3 color = baseColor * intensity;
  float alpha = clamp(intensity, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

function init() {
  const canvas = document.getElementById("laser-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const geometry = new THREE.PlaneGeometry(2, 2);
  material = new THREE.ShaderMaterial({
    vertexShader: VERT_SHADER,
    fragmentShader: FRAG_SHADER,
    uniforms: {
      u_resolution: { value: new THREE.Vector2() },
      u_time: { value: 0 },
      u_wobbleAmount: { value: 0.03 },
      u_wobbleSpeed: { value: 0.4 },
    },
    transparent: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  onResize();
  window.addEventListener("resize", onResize);
  setupControls();
  animate();
}

function setupControls() {
  const controls = document.querySelectorAll<HTMLInputElement>("[data-uniform]");
  if (!material) return;
  controls.forEach((input) => {
    const name = input.dataset.uniform!;
    const uniform = (material!.uniforms as any)[name];
    if (!uniform) return;
    // 初始化 UI 显示
    const min = Number(input.min || "0");
    const max = Number(input.max || "1");
    const val = uniform.value as number;
    if (!isNaN(val)) {
      const t = (val - min) / (max - min);
      input.value = String(min + t * (max - min));
    }
    input.addEventListener("input", () => {
      const v = Number(input.value);
      uniform.value = v;
    });
  });
}

function onResize() {
  if (!renderer || !material) return;
  const canvas = renderer.domElement;
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  material.uniforms.u_resolution.value.set(width, height);
}

function animate() {
  if (!renderer || !scene || !camera || !material) {
    requestAnimationFrame(animate);
    return;
  }
  const t = (performance.now() - startTime) / 1000;
  material.uniforms.u_time.value = t;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

init();


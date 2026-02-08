/** 色温 Kelvin → sRGB，近似（Tanner Helland 风格） */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = kelvin / 100;
  let r: number, g: number, b: number;

  if (t <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(t) - 161.1195681661));
    b = t <= 19 ? 0 : Math.min(255, Math.max(0, 138.5177312231 * Math.log(t - 10) - 305.0447927307));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(t - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(t - 60, -0.0755148492)));
    b = 255;
  }

  return [r / 255, g / 255, b / 255];
}

/** 波长 nm → sRGB，近似（可见光 380–780nm） */
export function wavelengthToRgb(nm: number): [number, number, number] {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  let r = 0, g = 0, b = 0;

  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    r = 0;
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    r = 0;
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
    b = 0;
  } else if (nm >= 645 && nm <= 780) {
    r = 1;
    g = 0;
    b = 0;
  }

  const factor = nm < 420 ? 0.3 + 0.7 * (nm - 380) / (420 - 380) : nm > 700 ? 0.3 + 0.7 * (780 - nm) / (780 - 700) : 1;
  return [clamp(r * factor), clamp(g * factor), clamp(b * factor)];
}

export function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}


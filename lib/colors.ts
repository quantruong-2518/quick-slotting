const LIGHT = [84, 76, 90];
const hue = (id: number) => Math.round((id * 137.508 + 210) % 360);

/** Màu nền dịu cho từng đơn vị; khác cả sắc độ lẫn độ sáng để in đen trắng vẫn phân biệt. */
export const unitColor = (id: number) => `hsl(${hue(id)} 72% ${LIGHT[id % 3]}%)`;

export function unitColorHex(id: number): string {
  const s = 0.72;
  const l = LIGHT[id % 3] / 100;
  const h = hue(id);
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return (f(0) + f(8) + f(4)).toUpperCase();
}

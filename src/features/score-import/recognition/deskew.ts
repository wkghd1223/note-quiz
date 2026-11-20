// For a tilted photo, staff lines accumulate in the same five rows when we
// project ink along their slope. Sample evenly spaced columns to bound cost.
export function straightenStaff(
  gray: Uint8Array,
  width: number,
  height: number,
) {
  const samples: { x: number; rows: number[] }[] = [];
  const step = Math.max(1, Math.ceil(width / 80));
  for (let x = 0; x < width; x += step) {
    const rows: number[] = [];
    for (let y = 0; y < height; y++)
      if (gray[y * width + x] < 144) rows.push(y);
    samples.push({ x, rows });
  }
  const maxTilt = 4;
  const slope = (degrees: number) => Math.tan((degrees * Math.PI) / 180);
  const pad = Math.ceil(width * slope(maxTilt)) + 1;
  const histogram = new Uint8Array(height + 2 * pad);
  let best = -1,
    angle = 0;
  function evaluate(degrees: number) {
    histogram.fill(0);
    const gradient = slope(degrees);
    for (const { x, rows } of samples) {
      const offset = pad - Math.round(x * gradient);
      for (const y of rows) histogram[y + offset]++;
    }
    // Concentrated ink along a row is stronger evidence than isolated symbols.
    let score = 0;
    for (const count of histogram) score += count ** 4;
    if (score > best) {
      best = score;
      angle = degrees;
    }
    return score;
  }
  const horizontal = evaluate(0);
  for (let i = -32; i <= 32; i++) evaluate(i / 8);
  const coarse = angle;
  for (let i = -8; i <= 8; i++) {
    const fine = coarse + i / 100;
    if (Math.abs(fine) <= maxTilt) evaluate(fine);
  }
  if (Math.abs(angle) < 0.05 || best < horizontal * 1.2) return null;
  // Undo the rotation in both axes so that note stems become vertical again.
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians),
    sin = Math.sin(radians);
  const outputWidth = Math.ceil(width * cos + height * Math.abs(sin));
  const outputHeight = Math.ceil(height * cos + width * Math.abs(sin));
  if (outputWidth * outputHeight > 8_000_000) return null;
  const pixels = new Uint8Array(outputWidth * outputHeight).fill(255);
  const cx = (width - 1) / 2,
    cy = (height - 1) / 2;
  const left = (1 - outputWidth) / 2,
    top = (1 - outputHeight) / 2;
  for (let y = 0; y < outputHeight; y++) {
    let sx = cx + left * cos - (y + top) * sin;
    let sy = cy + left * sin + (y + top) * cos;
    for (let x = 0; x < outputWidth; x++, sx += cos, sy += sin) {
      if (sx < 0 || sy < 0 || sx >= width - 1 || sy >= height - 1) continue;
      const col = Math.floor(sx),
        row = Math.floor(sy);
      const dx = sx - col,
        dy = sy - row,
        i = row * width + col;
      const a = gray[i] + dx * (gray[i + 1] - gray[i]);
      const b = gray[i + width] + dx * (gray[i + width + 1] - gray[i + width]);
      pixels[y * outputWidth + x] = Math.round(a + dy * (b - a));
    }
  }
  return { pixels, width: outputWidth, height: outputHeight };
}

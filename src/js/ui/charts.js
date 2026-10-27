import { esc } from './dom.js';

const W = 620;
const H = 250;
const PAD = { top: 24, right: 22, bottom: 48, left: 30 };

export function barChart({ data, target = 0, unit = '', showValues = null }) {
  if (!data.length) return '';
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(target || 0, ...data.map((item) => Number(item.value) || 0), 1) * 1.14;
  const slot = plotW / data.length;
  const barW = Math.min(38, Math.max(6, slot * 0.58));
  const baseY = PAD.top + plotH;
  const show = showValues ?? data.length <= 8;

  const grid = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = baseY - plotH * ratio;
    return `<line class="chart-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}"/>`;
  }).join('');

  const bars = data.map((item, index) => {
    const value = Number(item.value) || 0;
    const height = Math.max(value > 0 ? 3 : 0, (value / max) * plotH);
    const x = PAD.left + slot * index + (slot - barW) / 2;
    const y = baseY - height;
    const isActive = item.active ? ' is-active' : '';
    const empty = value ? '' : ' is-empty';
    const label = show ? `<text class="chart-value" x="${x + barW / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle">${Math.round(value)}</text>` : '';
    return `<g class="chart-bar${isActive}${empty}">
      <title>${esc(item.label)} — ${Math.round(value)} ${esc(unit)}</title>
      <rect x="${x}" y="${y}" width="${barW}" height="${height}" rx="${Math.min(8, barW / 2)}"/>
      ${label}
      <text class="chart-label" x="${x + barW / 2}" y="${baseY + 22}" text-anchor="middle">${esc(item.short || item.label)}</text>
    </g>`;
  }).join('');

  const targetLine = target > 0 ? (() => {
    const y = baseY - (target / max) * plotH;
    return `<g class="chart-target"><line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}"/><text x="${W - PAD.right}" y="${y - 6}" text-anchor="end">الهدف ${Math.round(target)}</text></g>`;
  })() : '';

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="رسم بياني">
    ${grid}${bars}${targetLine}
  </svg>`;
}

export function lineChart({ data, unit = 'كجم', digits = 1 }) {
  if (!data.length) return '';
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const values = data.map((item) => Number(item.value) || 0);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) { max += 0.8; min -= 0.8; }
  const pad = (max - min) * 0.16;
  min -= pad;
  max += pad;

  const xFor = (index) => data.length === 1 ? PAD.left + plotW / 2 : PAD.left + (plotW * index) / (data.length - 1);
  const yFor = (value) => PAD.top + plotH - ((value - min) / (max - min)) * plotH;

  const points = data.map((item, index) => `${xFor(index).toFixed(1)},${yFor(Number(item.value) || 0).toFixed(1)}`);
  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${xFor(data.length - 1)},${PAD.top + plotH} L ${xFor(0)},${PAD.top + plotH} Z`;

  const grid = [0, 0.5, 1].map((ratio) => {
    const y = PAD.top + plotH * ratio;
    const value = max - (max - min) * ratio;
    return `<line class="chart-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}"/>
      <text class="chart-axis" x="${W - PAD.right}" y="${y - 5}" text-anchor="end">${value.toFixed(digits)}</text>`;
  }).join('');

  const dots = data.map((item, index) => {
    const x = xFor(index);
    const y = yFor(Number(item.value) || 0);
    const last = index === data.length - 1;
    return `<g class="chart-dot${last ? ' is-last' : ''}">
      <title>${esc(item.label)} — ${Number(item.value).toFixed(digits)} ${esc(unit)}</title>
      <circle cx="${x}" cy="${y}" r="${last ? 5.5 : 3.2}"/>
    </g>`;
  }).join('');

  const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const labels = labelIndexes.map((index) => `
    <text class="chart-label" x="${xFor(index)}" y="${H - 16}" text-anchor="${index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}">${esc(data[index].short || data[index].label)}</text>`).join('');

  return `<svg class="chart chart-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="رسم بياني">
    <defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path class="chart-area" d="${area}"/>
    <path class="chart-line-path" d="${line}"/>
    ${dots}${labels}
  </svg>`;
}

export function sparkline(values) {
  if (!values.length) return '';
  const w = 150;
  const h = 48;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 0.5) { max += 0.3; min -= 0.3; }
  const points = values.map((value, index) => {
    const x = values.length === 1 ? w / 2 : (w * index) / (values.length - 1);
    const y = h - 8 - ((value - min) / (max - min)) * (h - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = points.split(' ').pop().split(',');
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${points}"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5"/>
  </svg>`;
}

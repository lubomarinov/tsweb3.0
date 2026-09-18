import { useId, useMemo, useRef, useState } from 'react';
import type { GoldQuote } from '../core/goldPrice';
import { formatDate, formatEur } from '../core/format';
import { GRAMS_PER_TROY_OUNCE } from '../core/money';

/**
 * Цена на златото във времето.
 *
 * Една серия → без легенда; заглавието над графиката я именува. Стойността
 * се чете при посочване (крос-курсор + подсказка), затова по точките няма
 * постоянни етикети — освен последната, която носи текущата цена.
 */

interface PriceChartProps {
  readonly history: readonly GoldQuote[];
  /** Показва цената за грам вместо за унция. */
  readonly perGram?: boolean;
  readonly height?: number;
}

const PADDING = { top: 16, right: 56, bottom: 26, left: 8 };
const VIEW_WIDTH = 720;

export function PriceChart({
  history,
  perGram = false,
  height = 260,
}: PriceChartProps) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const points = history.map((quote) => ({
      at: quote.at,
      value: perGram
        ? quote.midPerOunce / GRAMS_PER_TROY_OUNCE
        : quote.midPerOunce,
    }));

    if (points.length < 2) return null;

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Отстъп от 8%, за да не лепне линията за ръбовете на полето.
    const pad = (max - min) * 0.08 || Math.max(max * 0.01, 1);
    const lo = min - pad;
    const hi = max + pad;

    const plotWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;

    const x = (index: number) =>
      PADDING.left + (index / (points.length - 1)) * plotWidth;
    const y = (value: number) =>
      PADDING.top + (1 - (value - lo) / (hi - lo)) * plotHeight;

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`)
      .join(' ');

    const baseline = PADDING.top + plotHeight;
    const area = `${line} L${x(points.length - 1).toFixed(2)},${baseline} L${x(0).toFixed(2)},${baseline} Z`;

    // Три хоризонтални линии — достатъчно за ориентир, без да шумят.
    const gridLines = [0.5, 0.5, 0.5].map((_, i) => {
      const ratio = (i + 1) / 4;
      return PADDING.top + ratio * plotHeight;
    });

    return { points, x, y, line, area, lo, hi, baseline, gridLines };
  }, [history, perGram, height]);

  if (!geometry) return null;

  const { points, x, y, line, area, baseline, gridLines } = geometry;
  const last = points[points.length - 1];
  const active = hoverIndex === null ? null : points[hoverIndex];

  /** Превръща позицията на показалеца в най-близкия индекс от серията. */
  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio =
      ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH - PADDING.left;
    const plotWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
    const index = Math.round((ratio / plotWidth) * (points.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), points.length - 1));
  };

  const format = (value: number) => formatEur(Math.round(value));

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        className="chart"
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        role="img"
        aria-label={`Цена на златото за ${perGram ? 'грам' : 'тройунция'}, ${
          points.length
        } точки, последна стойност ${format(last.value)}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold-300)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--gold-300)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className="chart-grid">
          {gridLines.map((gy) => (
            <line key={gy} x1={PADDING.left} x2={VIEW_WIDTH - PADDING.right} y1={gy} y2={gy} />
          ))}
          <line
            x1={PADDING.left}
            x2={VIEW_WIDTH - PADDING.right}
            y1={baseline}
            y2={baseline}
          />
        </g>

        <path d={area} fill={`url(#${gradientId})`} />
        <path className="chart-line" d={line} />

        {/* Директен етикет само на последната точка — тя носи "цената сега". */}
        <circle className="chart-marker" cx={x(points.length - 1)} cy={y(last.value)} r={4.5} />
        <text
          className="chart-axis"
          x={VIEW_WIDTH - PADDING.right + 8}
          y={y(last.value) + 4}
          fill="var(--gold-300)"
        >
          {format(last.value)}
        </text>

        <text className="chart-axis" x={PADDING.left} y={height - 8}>
          {formatDate(points[0].at)}
        </text>
        <text
          className="chart-axis"
          x={VIEW_WIDTH - PADDING.right}
          y={height - 8}
          textAnchor="end"
        >
          {formatDate(last.at)}
        </text>

        {active && hoverIndex !== null && (
          <g>
            <line
              className="chart-crosshair"
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PADDING.top}
              y2={baseline}
            />
            <circle
              className="chart-marker"
              cx={x(hoverIndex)}
              cy={y(active.value)}
              r={5}
            />
          </g>
        )}
      </svg>

      {active && hoverIndex !== null && (
        <div
          className="tooltip"
          style={{
            left: `${(x(hoverIndex) / VIEW_WIDTH) * 100}%`,
            top: `${(y(active.value) / height) * 100}%`,
          }}
        >
          <strong className="tnum">{format(active.value)}</strong>
          <span className="muted"> · {formatDate(active.at)}</span>
        </div>
      )}
    </div>
  );
}

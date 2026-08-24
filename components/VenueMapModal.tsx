import type { JSX } from "react";
import { useEffect, useState, useRef, type MouseEvent, type TouchEvent } from "react";
import {
  resolveVenueMap,
  getPolygonPointsString,
  getBoothCentroidAndBounds,
  type VenueMapMatchResult,
} from "../lib/maps";

export interface VenueMapModalProps {
  location: string | null | undefined;
  title?: string;
  onClose: () => void;
}

export function VenueMapModal({
  location,
  title,
  onClose,
}: VenueMapModalProps): JSX.Element {
  const matchResult: VenueMapMatchResult = resolveVenueMap(location);
  const { map, booth, roomName } = matchResult;

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native <dialog>: showModal() gives top layer, focus trap, and Escape-to-close;
  // React's onClose wires the native `close` event back to parent state.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const pointsStr = booth ? getPolygonPointsString(booth.coordinates) : "";
  const centroidData = booth ? getBoothCentroidAndBounds(booth.coordinates) : null;

  // Center pan on the room centroid on initial load if coordinates exist
  useEffect(() => {
    if (centroidData && map.width > 0 && map.height > 0 && containerRef.current) {
      // Calculate container center offset relative to the room centroid
      const rect = containerRef.current.getBoundingClientRect();
      const scaleFactor = rect.width / map.width;
      const targetX = -(centroidData.cx * scaleFactor - rect.width / 2);
      const targetY = -(centroidData.cy * scaleFactor - rect.height / 2);
      // Zoom in slightly to highlight the room
      setZoom(1.35);
      setPan({ x: targetX, y: targetY });
    }
  }, [centroidData, map.width, map.height]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(3.5, Number((z + 0.35).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.35).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse Drag / Pan handlers
  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const imgWidth = map.width || 1024;
  const imgHeight = map.height || 2048;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="cd-glass-panel cd-notch cd-scrim-strong"
      style={{
        width: "100%",
        maxWidth: 720,
        maxHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        backgroundColor: "var(--grey-950)",
        color: "inherit",
        border: "1px solid var(--line-purple)",
        borderRadius: "var(--r-modal)",
        boxShadow: "var(--shadow-sheet)",
        overflow: "hidden",
      }}
    >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="cd-badge cd-badge-gold">
                📍 {map.name}
              </span>
              {booth ? (
                <span className="cd-badge cd-badge-purple">
                  ✨ {booth.name}
                </span>
              ) : roomName ? (
                <span className="cd-badge" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                  {roomName}
                </span>
              ) : null}
            </div>
            <h3
              style={{
                margin: "6px 0 2px 0",
                font: "var(--type-heading)",
                color: "var(--text-primary)",
                fontSize: 16,
              }}
            >
              {title ? `Map: ${title}` : `${map.name} Floor Plan`}
            </h3>
            <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {booth
                ? "🎯 Exact room polygon highlighted on floor plan"
                : "ℹ️ Hotel floor map (Pinch or drag to explore)"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={onClose}
              className="cd-btn cd-btn-ghost"
              style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
              aria-label="Close map modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Map Viewport Area */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "56vh",
            minHeight: 320,
            backgroundColor: "#06080b",
            border: "1px solid var(--line-subtle)",
            borderRadius: "var(--r-control)",
            overflow: "hidden",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Zoom / Pan Container */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 120ms ease-out",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 600,
                display: "inline-block",
                lineHeight: 0,
              }}
            >
              {/* Floor Plan Image */}
              <img
                src={map.localPath || map.imgUrl || ""}
                alt={`${map.name} floor plan`}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  pointerEvents: "none",
                }}
                draggable={false}
              />

              {/* Room Highlight SVG Overlay */}
              <svg
                viewBox={`0 0 ${imgWidth} ${imgHeight}`}
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              >
                {booth && pointsStr && (
                  <g>
                    {/* Glowing highlight polygon */}
                    <polygon
                      points={pointsStr}
                      fill="rgba(232, 185, 58, 0.48)"
                      stroke="var(--gold-500)"
                      strokeWidth="12"
                      strokeLinejoin="round"
                    />
                    <polygon
                      points={pointsStr}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      strokeDasharray="16 10"
                    />

                    {/* Centroid Room Pin & Badge */}
                    {centroidData && (
                      <g>
                        {/* Outer pulsating glow circle */}
                        <circle
                          cx={centroidData.cx}
                          cy={centroidData.cy}
                          r="44"
                          fill="none"
                          stroke="var(--coral-500)"
                          strokeWidth="8"
                          opacity="0.85"
                        />
                        {/* Inner pin point */}
                        <circle
                          cx={centroidData.cx}
                          cy={centroidData.cy}
                          r="22"
                          fill="var(--coral-500)"
                          stroke="#ffffff"
                          strokeWidth="6"
                        />
                        {/* Room label box */}
                        <rect
                          x={centroidData.cx - 160}
                          y={centroidData.cy - 100}
                          width="320"
                          height="54"
                          rx="10"
                          fill="rgba(12, 14, 17, 0.94)"
                          stroke="var(--gold-500)"
                          strokeWidth="4"
                        />
                        <text
                          x={centroidData.cx}
                          y={centroidData.cy - 65}
                          fill="#ffffff"
                          fontSize="26"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                          textAnchor="middle"
                        >
                          {booth.name}
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* In-Canvas Floating Zoom Controls */}
          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={handleZoomIn}
              className="cd-btn cd-btn-secondary"
              style={{ padding: "6px 12px", fontSize: 16, fontWeight: "bold" }}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="cd-btn cd-btn-secondary"
              style={{ padding: "6px 12px", fontSize: 16, fontWeight: "bold" }}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="cd-btn cd-btn-ghost"
              style={{ padding: "4px 8px", fontSize: 10 }}
              aria-label="Reset zoom and position"
            >
              RESET
            </button>
          </div>
        </div>

        {/* Action Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div className="cd-data" style={{ fontSize: 11, color: "var(--jade-500)" }}>
            ⚡ Offline Floor Plan • Cached for Dragon Con 2026
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={matchResult.officialPlaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-btn cd-btn-ghost"
              style={{
                fontSize: 12,
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderBottom: "none",
              }}
            >
              Official Map ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="cd-btn cd-btn-primary"
              style={{ fontSize: 12, padding: "8px 16px" }}
            >
              Close
            </button>
          </div>
        </div>
    </dialog>
  );
}

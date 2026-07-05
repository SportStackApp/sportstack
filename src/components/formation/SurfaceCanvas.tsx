import { useRef, useState, type MouseEvent } from "react";
import { HockeyPitch } from "@/components/lineup/HockeyPitch";
import { type BoundaryBox, gridToPercent } from "@/lib/formationPlanner";
import { cn } from "@/lib/utils";

export type CanvasMarker = {
  key: string;
  code: string;
  name: string;
  iconUrl?: string | null;
  gridX: number;
  gridY: number;
  xPercent: number;
  yPercent: number;
};

export type CanvasPlacement = {
  snappedX: number;
  snappedY: number;
  gridX: number;
  gridY: number;
  xPercent: number;
  yPercent: number;
};

type SurfaceCanvasProps = {
  backgroundUrl?: string | null;
  boundary: BoundaryBox;
  gridRows: number;
  gridColumns: number;
  showGrid: boolean;
  snapToGrid: boolean;
  rotation: "landscape" | "portrait";
  zoom: number;
  markers?: CanvasMarker[];
  selectedMarkerKey?: string | null;
  markerSize?: number;
  onCanvasClick?: (placement: CanvasPlacement) => void;
  onMarkerSelect?: (markerKey: string) => void;
  onMarkerMove?: (markerKey: string, placement: CanvasPlacement) => void;
  className?: string;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export function SurfaceCanvas({
  backgroundUrl,
  boundary,
  gridRows,
  gridColumns,
  showGrid,
  snapToGrid,
  rotation,
  zoom,
  markers = [],
  selectedMarkerKey,
  markerSize = 40,
  onCanvasClick,
  onMarkerSelect,
  onMarkerMove,
  className,
}: SurfaceCanvasProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [draggingMarkerKey, setDraggingMarkerKey] = useState<string | null>(null);
  const effectiveZoom = Math.max(1, zoom);

  const getPlacement = (clientX: number, clientY: number): CanvasPlacement | null => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const visualX = clampPercent(((clientX - rect.left) / rect.width) * 100);
    const visualY = clampPercent(((clientY - rect.top) / rect.height) * 100);
    const surfaceX = rotation === "portrait" ? visualY : visualX;
    const surfaceY = rotation === "portrait" ? 100 - visualX : visualY;
    const boundedX = clampPercent(surfaceX);
    const boundedY = clampPercent(surfaceY);

    const rawGridX = ((boundedX - boundary.x) / boundary.width) * gridColumns;
    const rawGridY = ((boundedY - boundary.y) / boundary.height) * gridRows;
    const snappedX = Math.min(gridColumns, Math.max(0, Math.round(rawGridX)));
    const snappedY = Math.min(gridRows, Math.max(0, Math.round(rawGridY)));
    const freeGridX = Math.min(gridColumns, Math.max(0, Number(rawGridX.toFixed(2))));
    const freeGridY = Math.min(gridRows, Math.max(0, Number(rawGridY.toFixed(2))));
    const percent = gridToPercent(snappedX, snappedY, gridColumns, gridRows, boundary);

    return {
      snappedX,
      snappedY,
      gridX: snapToGrid ? snappedX : freeGridX,
      gridY: snapToGrid ? snappedY : freeGridY,
      xPercent: snapToGrid ? percent.x : Number(boundedX.toFixed(3)),
      yPercent: snapToGrid ? percent.y : Number(boundedY.toFixed(3)),
    };
  };

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onCanvasClick || (event.target as HTMLElement).closest("[data-position-marker]")) return;
    const placement = getPlacement(event.clientX, event.clientY);
    if (placement) onCanvasClick(placement);
  };

  const moveDraggingMarker = (clientX: number, clientY: number) => {
    if (!draggingMarkerKey || !onMarkerMove) return;
    const placement = getPlacement(clientX, clientY);
    if (placement) onMarkerMove(draggingMarkerKey, placement);
  };

  return (
    <div
      className={cn("overflow-auto rounded-md border bg-muted/20 p-2", className)}
      style={{ maxHeight: "min(70vh, 680px)" }}
    >
      <div
        ref={viewportRef}
        className="relative mx-auto origin-center"
        style={{
          aspectRatio: rotation === "portrait" ? "620 / 1000" : "1000 / 620",
          width: `${Math.round(effectiveZoom * 100)}%`,
          minWidth: rotation === "portrait" ? "320px" : "520px",
          maxWidth: "none",
        }}
        onClick={handleCanvasClick}
        onMouseMove={(event) => moveDraggingMarker(event.clientX, event.clientY)}
        onMouseUp={() => setDraggingMarkerKey(null)}
        onMouseLeave={() => setDraggingMarkerKey(null)}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: rotation === "portrait" ? "161.29%" : "100%",
            height: rotation === "portrait" ? "62%" : "100%",
            transform: rotation === "portrait" ? "translate(-50%, -50%) rotate(90deg)" : "translate(-50%, -50%)",
          }}
        >
          <HockeyPitch backgroundUrl={backgroundUrl}>
            {showGrid && (
              <div
                className="absolute border-2 border-primary/80 bg-primary/5"
                style={{
                  left: `${boundary.x}%`,
                  top: `${boundary.y}%`,
                  width: `${boundary.width}%`,
                  height: `${boundary.height}%`,
                }}
              >
                {Array.from({ length: gridColumns + 1 }).map((_, index) => (
                  <span
                    key={`x-${index}`}
                    className="absolute top-0 h-full border-l border-white/20"
                    style={{ left: `${(index / gridColumns) * 100}%` }}
                  />
                ))}
                {Array.from({ length: gridRows + 1 }).map((_, index) => (
                  <span
                    key={`y-${index}`}
                    className="absolute left-0 w-full border-t border-white/20"
                    style={{ top: `${(index / gridRows) * 100}%` }}
                  />
                ))}
              </div>
            )}

            {markers.map((marker) => {
              const isSelected = selectedMarkerKey === marker.key;
              return (
                <button
                  key={marker.key}
                  type="button"
                  data-position-marker="true"
                  className={cn(
                    "absolute touch-none rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg",
                    isSelected && "ring-4 ring-amber-400 ring-offset-2 ring-offset-background",
                  )}
                  style={{
                    left: `${marker.xPercent}%`,
                    top: `${marker.yPercent}%`,
                    width: `${markerSize}px`,
                    height: `${markerSize}px`,
                    transform: `translate(-50%, -50%) rotate(${rotation === "portrait" ? "-90deg" : "0deg"})`,
                  }}
                  title={marker.name}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkerSelect?.(marker.key);
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onMarkerSelect?.(marker.key);
                    setDraggingMarkerKey(marker.key);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    onMarkerSelect?.(marker.key);
                    setDraggingMarkerKey(marker.key);
                  }}
                  onPointerMove={(event) => {
                    if (draggingMarkerKey !== marker.key) return;
                    event.stopPropagation();
                    moveDraggingMarker(event.clientX, event.clientY);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    setDraggingMarkerKey(null);
                  }}
                  onMouseUp={(event) => {
                    event.stopPropagation();
                    setDraggingMarkerKey(null);
                  }}
                  onPointerCancel={() => setDraggingMarkerKey(null)}
                >
                  {marker.iconUrl ? (
                    <img src={marker.iconUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold">{marker.code}</span>
                  )}
                  <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-background/90 px-1 text-[10px] font-semibold text-foreground">
                    {marker.code}
                  </span>
                </button>
              );
            })}
          </HockeyPitch>
        </div>
      </div>
    </div>
  );
}

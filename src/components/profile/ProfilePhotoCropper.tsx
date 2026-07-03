import { useState, useRef, useCallback } from "react";
import { Cropper, CropperRef, CircleStencil } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Trash2, ZoomIn } from "lucide-react";

interface ProfilePhotoCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (blob: Blob) => Promise<void>;
  onDelete?: () => Promise<void>;
  currentImage?: string | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const OUTPUT_SIZE = 256;
const JPEG_QUALITY = 0.8;

export const ProfilePhotoCropper = ({
  open,
  onOpenChange,
  onSave,
  onDelete,
  currentImage,
}: ProfilePhotoCropperProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState([1]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cropperRef = useRef<CropperRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError("Image must be less than 5MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setZoom([1]);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleZoomChange = useCallback((value: number[]) => {
    setZoom(value);
    if (cropperRef.current) {
      cropperRef.current.zoomImage(value[0] / zoom[0]);
    }
  }, [zoom]);

  const handleSave = async () => {
    if (!cropperRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const canvas = cropperRef.current.getCanvas({
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
      });

      if (!canvas) {
        throw new Error("Failed to create canvas");
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      });

      await onSave(blob);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsLoading(true);
    setError(null);

    try {
      await onDelete();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setZoom([1]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Profile Photo</DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-4">
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-40 h-40 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-border"
                onClick={triggerFileInput}
              >
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt="Current avatar"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm text-center px-4">
                    Click to select an image
                  </span>
                )}
              </div>
              <Button onClick={triggerFileInput} variant="outline">
                Choose Photo
              </Button>
            </div>
          ) : (
            <>
              <div className="relative w-full aspect-square max-h-[300px] rounded-lg overflow-hidden bg-muted">
                <Cropper
                  ref={cropperRef}
                  src={imageSrc}
                  stencilComponent={CircleStencil}
                  className="h-full"
                  stencilProps={{
                    aspectRatio: 1,
                  }}
                />
              </div>

              <div className="flex items-center gap-3">
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={zoom}
                  onValueChange={handleZoomChange}
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="flex-1"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={triggerFileInput}
                className="w-full"
              >
                Choose Different Photo
              </Button>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          {currentImage && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Photo
                </>
              )}
            </Button>
          )}
          <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            {imageSrc && (
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 sm:flex-initial"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

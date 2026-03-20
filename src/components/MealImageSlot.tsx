import { useEffect, useState } from "react";

/** Heroicons photo (outline) */
const PHOTO_ICON_PATH =
  "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z";

function PhotoPlaceholderIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={PHOTO_ICON_PATH} />
    </svg>
  );
}

export type MealImageSlotVariant =
  | "row"
  | "modalHeader"
  | "detail"
  | "editorPreview"
  | "card-tight"
  | "card-compact"
  | "card";

export interface MealImageSlotProps {
  imageUrl?: string;
  alt: string;
  variant: MealImageSlotVariant;
  imageTestId?: string;
  placeholderTestId?: string;
}

const VARIANT: Record<
  MealImageSlotVariant,
  {
    slot: string;
    img: string;
    placeholder: string;
    icon: string;
  }
> = {
  row: {
    slot: "h-8 w-8 shrink-0 overflow-hidden rounded border border-border-light",
    img: "h-full w-full object-cover",
    placeholder:
      "flex h-full w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-4 w-4 text-text-muted/50",
  },
  modalHeader: {
    slot:
      "h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border-light sm:h-[5.5rem] sm:w-[5.5rem]",
    img: "h-full w-full object-cover",
    placeholder:
      "flex h-full w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-10 w-10 text-text-muted/50 sm:h-11 sm:w-11",
  },
  detail: {
    slot: "mb-4 w-full overflow-hidden rounded-md border border-border-light",
    img: "max-h-64 w-full object-cover",
    placeholder:
      "flex min-h-[12rem] w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-16 w-16 text-text-muted/50",
  },
  editorPreview: {
    slot: "mt-2 h-24 w-36 overflow-hidden rounded-md border border-border-light",
    img: "h-full w-full object-cover",
    placeholder:
      "flex h-full w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-10 w-10 text-text-muted/50",
  },
  "card-tight": {
    slot: "mb-1.5 w-full overflow-hidden rounded-md border border-border-light",
    img: "max-h-[4.5rem] w-full object-cover",
    placeholder:
      "flex h-[4.5rem] w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-8 w-8 text-text-muted/45",
  },
  "card-compact": {
    slot: "mb-1.5 w-full overflow-hidden rounded-md border border-border-light",
    img: "max-h-24 w-full object-cover",
    placeholder:
      "flex h-24 w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-10 w-10 text-text-muted/45",
  },
  card: {
    slot: "mb-1.5 w-full overflow-hidden rounded-md border border-border-light",
    img: "max-h-36 w-full object-cover",
    placeholder:
      "flex h-36 w-full items-center justify-center bg-gradient-to-br from-bg via-surface to-brand-light/35",
    icon: "h-12 w-12 text-text-muted/45",
  },
};

/**
 * Meal photo with a consistent placeholder when there is no URL or the image fails to load.
 */
export default function MealImageSlot({
  imageUrl,
  alt,
  variant,
  imageTestId = "meal-image",
  placeholderTestId = "meal-image-placeholder",
}: MealImageSlotProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const cfg = VARIANT[variant];
  const showImg = Boolean(imageUrl?.trim()) && !failed;

  return (
    <div className={cfg.slot}>
      {showImg ? (
        <img
          src={imageUrl}
          alt={alt}
          className={cfg.img}
          data-testid={imageTestId}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={cfg.placeholder}
          data-testid={placeholderTestId}
          role="img"
          aria-label="No meal photo"
        >
          <PhotoPlaceholderIcon className={cfg.icon} />
        </div>
      )}
    </div>
  );
}

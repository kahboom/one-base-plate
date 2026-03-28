import { useEffect, useRef, useState } from 'react';
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { Button } from './ui';

type EmojiPickerFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  'data-testid'?: string;
};

export function EmojiPickerField({
  value,
  onChange,
  placeholder = 'Choose emoji',
  'data-testid': dataTestId,
}: EmojiPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }
  }, [open]);

  function handleEmoji(emoji: EmojiClickData) {
    onChange(emoji.emoji);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={dataTestId}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={value ? `Theme icon: ${value}` : placeholder}
          className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-sm border border-border-default bg-surface px-4 py-2 text-2xl leading-none transition-colors hover:bg-bg focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light sm:min-w-[120px] sm:justify-start"
          onClick={() => setOpen((o) => !o)}
        >
          {value ? (
            <span aria-hidden>{value}</span>
          ) : (
            <span className="text-base text-text-muted">{placeholder}</span>
          )}
        </button>
        {value ? (
          <Button type="button" small variant="ghost" onClick={() => onChange('')}>
            Clear
          </Button>
        ) : null}
      </div>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border-light shadow-card"
          role="dialog"
          aria-label="Emoji picker"
        >
          <EmojiPicker
            onEmojiClick={handleEmoji}
            theme={Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            width={320}
            height={380}
            searchPlaceholder="Search emojis…"
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}

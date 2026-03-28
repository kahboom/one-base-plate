import { useState } from 'react';
import { AnchorStructureTypesField } from './AnchorStructureTypesField';
import { EmojiPickerField } from './EmojiPickerField';
import { Card, Button, Input, FieldLabel } from './ui';
import type { WeeklyAnchor } from '../types';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

type Props = {
  weeklyAnchors: WeeklyAnchor[];
  onPersist: (anchors: WeeklyAnchor[]) => void;
};

export default function WeeklyThemeNightsCollapsible({ weeklyAnchors, onPersist }: Props) {
  const [open, setOpen] = useState(false);
  const [anchorForm, setAnchorForm] = useState<{
    weekday: (typeof WEEKDAYS)[number];
    label: string;
    icon: string;
    tags: string;
    structureTypes: string[];
    enabled: boolean;
  }>({
    weekday: WEEKDAYS[0]!,
    label: '',
    icon: '',
    tags: '',
    structureTypes: [],
    enabled: true,
  });

  function handleAddAnchor() {
    const label = anchorForm.label.trim();
    if (!label) return;
    const matchTags = anchorForm.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const matchStructureTypes = [...anchorForm.structureTypes];
    const anchor: WeeklyAnchor = {
      id: crypto.randomUUID(),
      weekday: anchorForm.weekday,
      label,
      icon: anchorForm.icon.trim() || undefined,
      matchTags,
      matchStructureTypes,
      enabled: anchorForm.enabled,
    };
    onPersist([...weeklyAnchors, anchor]);
    setAnchorForm({
      weekday: WEEKDAYS[0]!,
      label: '',
      icon: '',
      tags: '',
      structureTypes: [],
      enabled: true,
    });
  }

  return (
    <Card className="mb-6" data-testid="weekly-theme-nights-section">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="weekly-theme-nights-toggle"
      >
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Weekly theme nights</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Optional soft anchors (e.g. Taco Tuesday). They lightly boost matching meals after
            household fit — you can still assign any meal.
          </p>
        </div>
        <span
          className="shrink-0 text-text-muted transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-4 border-t border-border-light pt-4">
          <div
            className="mb-4 space-y-3 rounded-md border border-border-light bg-bg p-3"
            data-testid="weekly-anchors-form"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Weekday">
                <select
                  className="w-full rounded-md border border-border-light bg-surface px-3 py-2 text-sm"
                  value={anchorForm.weekday}
                  onChange={(e) =>
                    setAnchorForm((f) => ({
                      ...f,
                      weekday: e.target.value as (typeof WEEKDAYS)[number],
                    }))
                  }
                  data-testid="anchor-weekday"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Label">
                <Input
                  value={anchorForm.label}
                  onChange={(e) => setAnchorForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Taco night"
                  data-testid="anchor-label"
                />
              </FieldLabel>
              <FieldLabel label="Icon (optional)">
                <EmojiPickerField
                  value={anchorForm.icon}
                  onChange={(icon) => setAnchorForm((f) => ({ ...f, icon }))}
                  placeholder="Choose emoji"
                  data-testid="anchor-icon"
                />
              </FieldLabel>
              <FieldLabel label="Match tags (comma-separated)">
                <Input
                  value={anchorForm.tags}
                  onChange={(e) => setAnchorForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="taco, mexican"
                  data-testid="anchor-tags"
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <AnchorStructureTypesField
                  selected={anchorForm.structureTypes}
                  onChange={(structureTypes) => setAnchorForm((f) => ({ ...f, structureTypes }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={anchorForm.enabled}
                onChange={(e) => setAnchorForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <Button type="button" onClick={handleAddAnchor} data-testid="anchor-add-btn">
              Add anchor
            </Button>
          </div>
          {weeklyAnchors.length > 0 ? (
            <ul className="space-y-2" data-testid="weekly-anchors-list">
              {weeklyAnchors.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-light px-3 py-2 text-sm"
                  data-testid={`weekly-anchor-${a.id}`}
                >
                  <span>
                    <strong>{a.weekday}</strong>: {a.icon ? `${a.icon} ` : ''}
                    {a.label}
                    {!a.enabled && <span className="ml-2 text-text-muted">(off)</span>}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      small
                      variant="ghost"
                      onClick={() =>
                        onPersist(
                          weeklyAnchors.map((x) =>
                            x.id === a.id ? { ...x, enabled: !x.enabled } : x,
                          ),
                        )
                      }
                    >
                      {a.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      type="button"
                      small
                      variant="danger"
                      onClick={() => onPersist(weeklyAnchors.filter((x) => x.id !== a.id))}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No theme nights yet.</p>
          )}
        </div>
      )}
    </Card>
  );
}

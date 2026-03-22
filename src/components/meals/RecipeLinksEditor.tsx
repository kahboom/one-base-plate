import { useState } from "react";
import type { RecipeLink } from "../../types";
import { Button, Input, Chip } from "../ui";

export default function RecipeLinksEditor({
  links,
  onChange,
}: {
  links: RecipeLink[];
  onChange: (links: RecipeLink[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  function addLink() {
    const trimmedUrl = newUrl.trim();
    const trimmedLabel = newLabel.trim() || trimmedUrl;
    if (!trimmedUrl) return;
    onChange([...links, { label: trimmedLabel, url: trimmedUrl }]);
    setNewLabel("");
    setNewUrl("");
  }

  function removeLink(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-4" data-testid="recipe-links-editor">
      <h3 className="mb-2 text-base font-semibold text-text-primary">
        Recipe links ({links.length})
      </h3>
      {links.length > 0 && (
        <div className="mb-3 space-y-2">
          {links.map((link, i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              data-testid={`recipe-link-${i}`}
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1"
                data-testid={`recipe-link-anchor-${i}`}
              >
                <span className="flex min-w-0 items-center gap-2 rounded-sm border border-border-light bg-bg px-2 py-1.5 transition-colors hover:bg-surface-card">
                  <Chip variant="info">{link.label}</Chip>
                  <span className="truncate text-xs text-text-muted">{link.url}</span>
                </span>
              </a>
              <Button variant="ghost" small onClick={() => removeLink(i)}>
                x
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (e.g. Gousto)"
          className="sm:max-w-[180px]"
          data-testid="recipe-link-label"
        />
        <Input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL"
          data-testid="recipe-link-url"
        />
        <Button small onClick={addLink}>
          Add link
        </Button>
      </div>
    </div>
  );
}

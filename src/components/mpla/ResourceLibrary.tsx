import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, LibraryBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createResource, getResources, type ApiResource } from "@/lib/mypla-api";

export function ResourceLibrary() {
  const [resources, setResources] = useState<ApiResource[]>([]);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getResources().then(
      (items) => {
        if (active) setResources(items);
      },
      (error: unknown) => {
        if (active) {
          setNotice(
            error instanceof Error ? error.message : "Saved resources could not be loaded.",
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const saved = await createResource({
        name: name.trim(),
        type: "tool",
        url: url.trim() || null,
        purpose: purpose.trim(),
        tags: [],
      });
      setResources((current) => [saved, ...current]);
      setName("");
      setPurpose("");
      setUrl("");
      setNotice("Resource saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The resource could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2">
        <LibraryBig className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Saved resources</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Keep useful tools, links, and prompts together for later.
      </p>

      <ul className="mt-4 space-y-2">
        {resources.length ? (
          resources.map((resource) => (
            <li key={resource.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{resource.name}</p>
                  {resource.purpose ? (
                    <p className="mt-1 text-xs text-muted-foreground">{resource.purpose}</p>
                  ) : null}
                </div>
                {resource.url ? (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${resource.name}`}
                    className="rounded-md p-1 text-primary hover:bg-muted"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            No saved resources yet.
          </li>
        )}
      </ul>

      <form className="mt-4 space-y-2" onSubmit={(event) => void addResource(event)}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Resource name"
          maxLength={200}
          required
        />
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Link (optional)"
        />
        <Textarea
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          placeholder="When is this useful? (optional)"
          rows={2}
        />
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save resource"}
        </Button>
      </form>
      {notice ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

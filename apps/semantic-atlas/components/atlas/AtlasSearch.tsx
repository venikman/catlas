"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { searchAtlas } from "@/lib/atlas/api";
import { ATLAS_CLIENT_CACHE } from "@/lib/atlas/cachePolicy";
import { formatAtlasCount } from "@/lib/atlas/format";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
import type { AtlasSearchResult } from "@/lib/atlas/types";
import { AtlasIcon } from "./AtlasIcon";

const RESULT_COLORS = [
  "#8FB0FF",
  "#549E79",
  "#009271",
  "#008941",
  "#004D43",
  "#00FECF",
];

export function AtlasSearch({
  corpusCount,
  onResultSelect,
  selectedView,
  status,
}: {
  corpusCount: number | null;
  onResultSelect: (result: AtlasSearchResult) => void;
  selectedView: string;
  status: string;
}) {
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const queryText = q.trim();
  const query = useQuery({
    enabled: queryText.length >= 2,
    queryKey: atlasQueryKeys.search({ view: selectedView, q: queryText }),
    queryFn: ({ signal }) => searchAtlas({ view: selectedView, q: queryText, signal }),
    staleTime: ATLAS_CLIENT_CACHE.search.staleTime,
    gcTime: ATLAS_CLIENT_CACHE.search.gcTime,
  });

  const results = query.data?.results ?? [];
  const showResults = queryText.length >= 2;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (results[0]) {
      onResultSelect(results[0]);
    }
  }

  return (
    <section className="atlas-command" aria-label="Atlas finder">
      <form className="atlas-finder" onSubmit={handleSubmit}>
        <div className="finder-meta">
          <span>Search map</span>
          <output suppressHydrationWarning>{mounted ? status : "Ready"}</output>
        </div>
        <div className="finder-control">
          <AtlasIcon name="search" size={17} />
          <input
            data-testid="atlas-search-input"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Document/member ID, topic, or family"
            aria-label="Search by document/member ID, topic, or family"
          />
          {q.length > 0 ? (
            <button
              type="button"
              data-testid="atlas-search-clear"
              title="Clear search"
              aria-label="Clear search"
              onClick={() => setQ("")}
            >
              <AtlasIcon name="close" size={15} />
            </button>
          ) : null}
          <button type="submit" title="Search map">
            <AtlasIcon name="search" size={15} />
            <span>Search</span>
          </button>
        </div>
        <p className="finder-hint">Examples: MBR-0000042, Social drivers, FPF</p>

        {showResults ? (
          <div className="atlas-scrollbar max-h-[280px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--line-4)] bg-[var(--surface-overlay)] p-2">
            {query.isLoading ? (
              <div className="px-2 py-3 text-[var(--label-sm)] text-[var(--fg-3)]">
                Searching atlas...
              </div>
            ) : results.length === 0 ? (
              <div className="px-2 py-3 text-[var(--label-sm)] text-[var(--fg-3)]">
                No lightweight matches.
              </div>
            ) : (
              <div className="grid gap-1">
                {results.slice(0, 6).map((result, index) => (
                  <Fragment key={`${result.entityId}-${index}`}>
                    {index === 1 ? (
                      <div className="eyebrow px-2 pt-2 text-[var(--fg-6)]">
                        Other results
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[var(--radius-sm)] border border-transparent px-2 py-2 text-left transition hover:border-[var(--line-1)] hover:bg-white"
                      data-atlas-entity-id={result.entityId}
                      data-atlas-kind="search-result"
                      data-atlas-result-index={index}
                      onClick={() => onResultSelect(result)}
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: RESULT_COLORS[index % RESULT_COLORS.length],
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-extrabold text-[var(--fg-1)]">
                          {result.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--fg-3)]">
                          {result.entityType} · {result.clusterId}
                        </span>
                      </span>
                      <span className="tabular text-[11px] font-extrabold text-[var(--fg-5)]">
                        {Math.round(result.score * 100)}%
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </form>

      <div className="atlas-map-badge" aria-label="Atlas dataset">
        <strong>OntoTwin</strong>
        <span suppressHydrationWarning>
          {corpusCount != null
            ? `${formatAtlasCount(corpusCount)} total docs`
            : "Loading corpus"}
        </span>
      </div>
    </section>
  );
}

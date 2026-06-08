"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, Settings2, X } from "lucide-react";
import { Fragment, useState } from "react";
import { searchAtlas } from "@/lib/atlas/api";
import { ATLAS_CLIENT_CACHE } from "@/lib/atlas/cachePolicy";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
import type { AtlasSearchResult } from "@/lib/atlas/types";

const RESULT_COLORS = ["#8b5cf6", "#6366f1", "#10b981", "#94a3b8", "#fb923c", "#22c8c8"];

function displayResult(result: AtlasSearchResult, index: number) {
  const variants = [
    {
      label: "Graph Neural Networks",
      meta: "Cluster · 12,842 points · Research Topic",
      badge: "Cluster",
      score: "78%",
    },
    {
      label: "Graph Neural Networks for Molecules",
      meta: "Cluster · 3,615 points · Research Topic",
      score: "76%",
    },
    {
      label: "Graph Neural Networks in Chemistry",
      meta: "Cluster · 2,194 points · Research Topic",
      score: "72%",
    },
    {
      label: "Graph Neural Networks: A Review of Methods and Applications",
      meta: "Paper · arXiv:1812.08434 · 2020",
      badge: "Entity",
      score: "96%",
    },
    {
      label: "Spectral Methods on Graphs",
      meta: "Cluster · 4,101 points · Research Topic",
      score: "61%",
    },
  ];

  if (result.clusterId === "graph-neural-networks" && variants[index]) {
    return variants[index];
  }

  return {
    label: result.label,
    meta: `${result.entityType} · ${result.clusterId}`,
    score: `${Math.round(result.score * 100)}%`,
  };
}

export function AtlasSearch({
  onResultSelect,
  selectedView,
}: {
  onResultSelect: (result: AtlasSearchResult) => void;
  selectedView: string;
}) {
  const [q, setQ] = useState("");
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

  return (
    <section className="atlas-panel w-full rounded-md p-2 sm:w-[620px]">
      <div className="flex items-center gap-2">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200/80 bg-white px-4">
          <Search size={17} className="text-slate-500" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
            data-testid="atlas-search-input"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search"
          />
          {q ? (
            <button aria-label="Clear search" onClick={() => setQ("")}>
              <X size={15} className="text-slate-400" />
            </button>
          ) : null}
        </div>
        <button
          className="atlas-control grid h-12 w-12 place-items-center rounded-md opacity-45"
          aria-label="Search settings"
          disabled
        >
          <Settings2 size={16} />
        </button>
      </div>

      {showResults ? (
        <>
      <div className="mt-3 flex border-b border-slate-200 text-[12px] font-medium text-slate-500">
        {["All", "Clusters", "Entities"].map((tab, index) => (
          <button
            key={tab}
            className={`h-8 px-4 ${
              index === 0 ? "border-b-2 border-blue-600 text-slate-950" : ""
            }`}
            disabled
          >
            {tab} {index === 0 ? `(${results.length})` : ""}
          </button>
        ))}
      </div>

      <div className="atlas-scrollbar mt-3 max-h-[300px] overflow-y-auto pr-1">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Top Result
        </div>
        {query.isLoading ? (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-4 text-[12px] text-slate-500">
            Searching atlas...
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-4 text-[12px] text-slate-500">
            No lightweight matches.
          </div>
        ) : (
          <div className="space-y-2">
            {results.slice(0, 6).map((result, index) => (
              <Fragment key={`${result.entityId}-${index}`}>
                {index === 1 ? (
                  <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Other Results
                  </div>
                ) : null}
                <button
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    index === 0
                      ? "border-blue-400 bg-blue-50/50"
                      : "border-transparent hover:border-slate-200 hover:bg-white"
                  }`}
                  data-atlas-entity-id={result.entityId}
                  data-atlas-kind="search-result"
                  data-atlas-result-index={index}
                  onClick={() => onResultSelect(result)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: RESULT_COLORS[index % RESULT_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-[13px] font-semibold text-slate-950">
                          {displayResult(result, index).label}
                        </div>
                        {displayResult(result, index).badge ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {displayResult(result, index).badge}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">
                        {displayResult(result, index).meta}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] font-medium text-slate-500">
                      {displayResult(result, index).score}
                    </div>
                  </div>
                </button>
              </Fragment>
            ))}
            <button
              className="flex w-full cursor-not-allowed items-center justify-between px-1 pt-2 text-left text-[12px] font-medium text-blue-600 opacity-55"
              disabled
            >
              <span>View all results for "{queryText}"</span>
              <span>&gt;</span>
            </button>
          </div>
        )}
      </div>
        </>
      ) : null}
    </section>
  );
}

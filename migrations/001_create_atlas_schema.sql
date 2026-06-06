create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists atlas_views (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas_points (
  id text primary key default gen_random_uuid()::text,
  entity_id text not null,
  view_id text not null references atlas_views(id) on delete cascade,
  x double precision not null,
  y double precision not null,
  cluster_id text not null,
  label text not null,
  entity_type text not null,
  importance double precision not null default 0,
  payload_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, view_id)
);

create table if not exists atlas_clusters (
  id text primary key default gen_random_uuid()::text,
  view_id text not null references atlas_views(id) on delete cascade,
  lod_level integer not null,
  cluster_id text not null,
  label text not null,
  centroid_x double precision not null,
  centroid_y double precision not null,
  radius double precision not null,
  point_count integer not null,
  importance double precision not null default 0,
  bounds_min_x double precision not null,
  bounds_max_x double precision not null,
  bounds_min_y double precision not null,
  bounds_max_y double precision not null,
  color_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (view_id, lod_level, cluster_id)
);

create table if not exists atlas_density_tiles (
  id text primary key default gen_random_uuid()::text,
  view_id text not null references atlas_views(id) on delete cascade,
  z integer not null,
  x_tile integer not null,
  y_tile integer not null,
  bounds jsonb not null,
  density_payload jsonb not null,
  point_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (view_id, z, x_tile, y_tile)
);

create index if not exists idx_atlas_points_view_xy
  on atlas_points (view_id, x, y);

create index if not exists idx_atlas_points_entity
  on atlas_points (entity_id);

create index if not exists idx_atlas_points_view_cluster
  on atlas_points (view_id, cluster_id);

create index if not exists idx_atlas_points_label_trgm_candidate
  on atlas_points using gin (label gin_trgm_ops);

create index if not exists idx_atlas_clusters_view_lod_bounds
  on atlas_clusters (
    view_id,
    lod_level,
    bounds_min_x,
    bounds_max_x,
    bounds_min_y,
    bounds_max_y
  );

create index if not exists idx_atlas_density_tiles_view_z_tile
  on atlas_density_tiles (view_id, z, x_tile, y_tile);

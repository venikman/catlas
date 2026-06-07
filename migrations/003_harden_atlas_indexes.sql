create extension if not exists pg_trgm;

create index if not exists idx_atlas_views_slug
  on atlas_views (slug);

create index if not exists idx_atlas_points_view_xy_importance
  on atlas_points (view_id, x, y, importance desc);

create index if not exists idx_atlas_points_view_cluster_importance
  on atlas_points (view_id, cluster_id, importance desc);

create index if not exists idx_atlas_points_entity_view
  on atlas_points (entity_id, view_id);

create index if not exists idx_atlas_points_cluster_trgm
  on atlas_points using gin (cluster_id gin_trgm_ops);

create index if not exists idx_atlas_clusters_view_lod_cluster
  on atlas_clusters (view_id, lod_level, cluster_id);

create index if not exists idx_atlas_clusters_view_lod_importance
  on atlas_clusters (view_id, lod_level, importance desc, point_count desc);

create index if not exists idx_atlas_density_tiles_view_bounds_expr
  on atlas_density_tiles (
    view_id,
    ((bounds->>'minX')::double precision),
    ((bounds->>'maxX')::double precision),
    ((bounds->>'minY')::double precision),
    ((bounds->>'maxY')::double precision)
  );

create index if not exists idx_atlas_density_tiles_view_z_count
  on atlas_density_tiles (view_id, z, point_count desc);

create extension if not exists postgis;

alter table atlas_points
  add column if not exists geom geometry(Point, 3857);

update atlas_points
set geom = st_setsrid(st_makepoint(x, y), 3857)
where geom is null;

create index if not exists idx_atlas_points_geom
  on atlas_points using gist (geom);

-- The baseline btree view_id index plus GiST geom index supports filtered
-- spatial lookups without requiring btree_gist for uuid GiST operators.

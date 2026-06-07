-- Semantic Atlas benchmark query-plan inspection.
-- Usage:
--   psql "$DATABASE_URL" -f benchmarks/sql/explain-atlas-queries.sql
--
-- This file is intentionally separate from the API benchmark runner. It gives
-- database owners representative EXPLAIN ANALYZE statements for production-like
-- plan review without making quick local validation depend on a live database.

\set view_slug 'research-domains'
\set small_min_x -0.8
\set small_max_x 0.8
\set small_min_y -0.8
\set small_max_y 0.8
\set medium_min_x -3
\set medium_max_x 4
\set medium_min_y -3
\set medium_max_y 3
\set point_limit 5000
\set cluster_limit 600
\set density_limit 240
\set search_query 'graph neural networks'
\set search_limit 20
\set entity_id 'ent-0000001'

explain analyze
select
  p.id::text,
  p.entity_id,
  p.view_id::text,
  p.x,
  p.y,
  p.cluster_id,
  p.label,
  p.entity_type,
  p.importance
from atlas_points p
join atlas_views v on v.id = p.view_id
where v.slug = :'view_slug'
  and p.x between :small_min_x and :small_max_x
  and p.y between :small_min_y and :small_max_y
order by p.importance desc
limit :point_limit;

explain analyze
select
  c.id::text,
  c.view_id::text,
  c.lod_level,
  c.cluster_id,
  c.label,
  c.centroid_x,
  c.centroid_y,
  c.radius,
  c.point_count,
  c.importance,
  c.bounds_min_x,
  c.bounds_max_x,
  c.bounds_min_y,
  c.bounds_max_y,
  c.color_key
from atlas_clusters c
join atlas_views v on v.id = c.view_id
where v.slug = :'view_slug'
  and not (
    c.bounds_max_x < :medium_min_x or
    c.bounds_min_x > :medium_max_x or
    c.bounds_max_y < :medium_min_y or
    c.bounds_min_y > :medium_max_y
  )
order by c.importance desc, c.point_count desc
limit :cluster_limit;

explain analyze
select
  t.id::text,
  t.view_id::text,
  t.z,
  t.x_tile,
  t.y_tile,
  t.bounds,
  t.density_payload,
  t.point_count
from atlas_density_tiles t
join atlas_views v on v.id = t.view_id
where v.slug = :'view_slug'
  and (t.bounds->>'maxX')::double precision >= :medium_min_x
  and (t.bounds->>'minX')::double precision <= :medium_max_x
  and (t.bounds->>'maxY')::double precision >= :medium_min_y
  and (t.bounds->>'minY')::double precision <= :medium_max_y
order by t.point_count desc
limit :density_limit;

explain analyze
select
  p.entity_id,
  p.label,
  p.entity_type,
  p.x,
  p.y,
  p.cluster_id,
  similarity(p.label, :'search_query') as score
from atlas_points p
join atlas_views v on v.id = p.view_id
where v.slug = :'view_slug'
  and (
    p.label ilike '%' || :'search_query' || '%'
    or p.cluster_id ilike '%' || :'search_query' || '%'
  )
order by score desc, p.importance desc
limit :search_limit;

explain analyze
select
  p.id::text,
  p.entity_id,
  p.view_id::text,
  v.slug as view_slug,
  p.x,
  p.y,
  p.cluster_id,
  p.label,
  p.entity_type,
  p.importance,
  p.payload_summary,
  p.metadata
from atlas_points p
join atlas_views v on v.id = p.view_id
where p.entity_id = :'entity_id'
order by v.name;

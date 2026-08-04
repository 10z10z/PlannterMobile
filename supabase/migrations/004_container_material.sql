-- Containers are identified by what they're made of rather than a free-text label.

alter table containers
  add column material text not null default 'plastic'
    check (material in ('plastic', 'fabric', 'terracotta'));

alter table containers drop column name;

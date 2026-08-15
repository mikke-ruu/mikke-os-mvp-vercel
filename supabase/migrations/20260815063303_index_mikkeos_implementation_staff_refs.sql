create index if not exists mikkeos_implementation_projects_created_by_idx
  on public.mikkeos_implementation_projects(created_by);

create index if not exists mikkeos_implementation_projects_updated_by_idx
  on public.mikkeos_implementation_projects(updated_by);

create index if not exists mikkeos_implementation_gates_updated_by_idx
  on public.mikkeos_implementation_gates(updated_by);

create index if not exists mikkeos_implementation_items_created_by_idx
  on public.mikkeos_implementation_items(created_by);

create index if not exists mikkeos_implementation_items_updated_by_idx
  on public.mikkeos_implementation_items(updated_by);

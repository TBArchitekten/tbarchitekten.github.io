-- TBA Office · small fixes for the Window copy (part B).
-- Everyone starts with the same two categories (client keys 'arbeit' and 'personal'), so a category's
-- client key is unique per person, not across the whole office.
alter table public.isabella_categories drop constraint isabella_categories_client_key_key;
alter table public.isabella_categories
  add constraint isabella_categories_user_client_key unique (user_id, client_key);

-- Index for the foreign key from a task to its project team member (performance advisor).
create index isabella_tasks_project_assignee_idx
  on public.isabella_tasks(project_id, assignee_person_id);

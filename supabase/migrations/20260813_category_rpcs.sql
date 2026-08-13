-- Category integrity RPCs (applied 2026-08-13 via psql directly against
-- db.tuvqxwyqrgsowirmmyhp.supabase.co; the supabase migration tracker is not
-- used for this project, schema history lives in supabase-migrations/).
--
-- All three functions are SECURITY DEFINER with auth.uid() scoping so the
-- multi-statement operations below run in a single transaction from the
-- client, instead of two racy UPDATEs.

-- Rename a category AND reassign every subscription using the old name,
-- atomically.
create or replace function public.rename_category(
  p_id uuid,
  p_name text,
  p_color text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_uid uuid := auth.uid();
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name required';
  end if;
  select name into v_old from categories where id = p_id and user_id = v_uid;
  if not found then
    raise exception 'Category not found';
  end if;
  if v_old <> p_name then
    update subscriptions
       set category = p_name
     where user_id = v_uid
       and category = v_old;
  end if;
  update categories
     set name = p_name, color = p_color
   where id = p_id and user_id = v_uid;
end;
$$;

-- Delete a category after moving its subscriptions to "Other", atomically.
-- "Other" itself is the fallback bucket and cannot be deleted.
create or replace function public.delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  select name into v_name from categories where id = p_id and user_id = v_uid;
  if not found then
    raise exception 'Category not found';
  end if;
  if v_name = 'Other' then
    raise exception 'Cannot delete the Other category';
  end if;
  update subscriptions
     set category = 'Other'
   where user_id = v_uid
     and category = v_name;
  delete from categories where id = p_id and user_id = v_uid;
end;
$$;

-- Rewrite sort_order for the user's categories in one transaction.
-- p_ids must contain every category id owned by the caller, in the new order.
create or replace function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  i int := 0;
  cid uuid;
begin
  if array_length(p_ids, 1) is null then
    return;
  end if;
  foreach cid in array p_ids loop
    update categories
       set sort_order = i
     where id = cid and user_id = v_uid;
    i := i + 1;
  end loop;
end;
$$;

grant execute on function public.rename_category(uuid, text, text) to authenticated;
grant execute on function public.delete_category(uuid) to authenticated;
grant execute on function public.reorder_categories(uuid[]) to authenticated;

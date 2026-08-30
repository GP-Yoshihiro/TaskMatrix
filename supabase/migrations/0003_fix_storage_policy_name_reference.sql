-- 0001 のポリシーは storage.foldername(name) の name が
-- サブクエリ内の projects.name に解決されてしまい、条件が常に偽だった。
-- storage.objects.name と明示的に修飾する。

drop policy if exists project_files_all_own on storage.objects;

create policy project_files_all_own on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and p.owner_id = (select auth.uid())
    )
  );

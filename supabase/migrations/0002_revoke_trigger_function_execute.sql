-- トリガー関数は RPC 経由で直接呼ばれる必要がないため、
-- public / anon / authenticated から EXECUTE 権限を剥奪する。
-- トリガーからの実行は関数所有者の権限で行われるため影響しない。

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.enforce_project_limit() from public;
revoke execute on function public.enforce_project_limit() from anon;
revoke execute on function public.enforce_project_limit() from authenticated;

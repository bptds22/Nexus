-- Notifie les autres participants d'une conversation à chaque nouveau message.
-- Appel non bloquant via pg_net ; toute erreur est avalée (jamais de rollback du message).
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_secret text;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
  r record;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'PUSH_DISPATCH_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_on_message: PUSH_DISPATCH_SECRET absent du Vault';
      return null;
    end if;

    for r in
      select p.user_id
      from public.conversations c
      cross join lateral (values
        (c.recruiter_id),
        (c.coach_id),
        ((select a.user_id from public.athletes a where a.id = c.athlete_id))
      ) as p(user_id)
      where c.id = NEW.conversation_id
        and p.user_id is not null
        and p.user_id <> NEW.sender_id
    loop
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-secret', v_secret
        ),
        body := jsonb_build_object(
          'user_id', r.user_id,
          'title', 'Nexus',
          'body', 'Tu as un nouveau message',
          'data', jsonb_build_object(
            'type', 'message',
            'conversation_id', NEW.conversation_id
          )
        )
      );
    end loop;

  exception when others then
    raise warning 'notify_on_message a échoué pour message %: %', NEW.id, SQLERRM;
  end;

  return null; -- AFTER trigger : retour ignoré
end;
$$;

create or replace trigger trg_notify_on_message
after insert on public.messages
for each row execute function public.notify_on_message();

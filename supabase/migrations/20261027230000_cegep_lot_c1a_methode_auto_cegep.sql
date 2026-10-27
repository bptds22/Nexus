-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT C1a (GO BP 2026-10-27, décision 4) : la valeur
-- « auto_cegep » de l'enum verification_method, pour reconnaître les cégépiens vérifiés
-- automatiquement et pouvoir les remettre en gris le jour où le coach collégial existera.
--
-- Migration À PART de C1b (le trigger qui s'en sert) : une valeur ajoutée à un enum ne peut pas être
-- utilisée dans la transaction qui l'ajoute. C1b ne peut donc être rejouée à blanc qu'une fois C1a
-- en prod.
--
-- Aucune ligne n'est écrite ; aucune fonction, policy ni trigger ne change. Une valeur d'enum ne se
-- retire pas sans réécrire le type : pas de rollback, la valeur reste inerte tant que C1b n'est pas
-- appliquée (aucune ligne ne la porte).

do $garde$
begin
  if exists (select 1 from pg_enum where enumtypid = 'public.verification_method'::regtype
                                     and enumlabel = 'auto_cegep') then
    raise exception 'NEXUS: 20261027230000 déjà appliquée (auto_cegep existe)';
  end if;
  if (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
       where enumtypid = 'public.verification_method'::regtype) is distinct from 'auto,manuel_coach,manuel_directeur' then
    raise exception 'NEXUS: verification_method n''a pas les trois valeurs relevées le 2026-10-27';
  end if;
end $garde$;

alter type public.verification_method add value 'auto_cegep';

do $garde$
begin
  if (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
       where enumtypid = 'public.verification_method'::regtype) is distinct from 'auto,manuel_coach,manuel_directeur,auto_cegep' then
    raise exception 'NEXUS: auto_cegep absente après la migration';
  end if;
  raise notice 'NEXUS: lot C1a cégep — valeur auto_cegep ajoutée à verification_method';
end $garde$;

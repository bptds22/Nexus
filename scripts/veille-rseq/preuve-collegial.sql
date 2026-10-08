-- Preuve 2 : les 27 ligues collégiales 2026 que diffusion ne montre pas (audit du 2026-10-08, servies par s1 seulement)
-- sont-elles au catalogue après la découverte v2, et appelées par la passe ?
with audit(id, ligue, matchs_rseq, hotes) as (values
  ('cf8a85ed-70a7-4760-8066-52d8a8daea87'::uuid, 'Badminton C U D2 Nord-Est CQ', 20, 's1'),
  ('49d51761-fadd-4c28-800b-63815289eb53'::uuid, 'Badminton C U D2 Nord-Est QCA-EDQ', 42, 's1'),
  ('2649fbf2-7d0e-42e8-bcfe-e76125a1798c'::uuid, 'Badminton C U D2 Sud-Ouest', 63, 's1'),
  ('eb5ee4f9-3860-4efd-b535-2024284dec68'::uuid, 'Badminton C U D3 Sud-Ouest', 90, 's1'),
  ('c4149f03-48a2-48f0-9400-2d6459eaa0c5'::uuid, 'Basketball C F D2 Nord-Est CQ A', 68, 's1'),
  ('9816d17c-843e-423a-b2ee-93a8864a529e'::uuid, 'Basketball C F D2 Nord-Est CQ B', 68, 's1'),
  ('b54a8411-0eed-4ec4-853d-68f7451e6691'::uuid, 'Basketball C F D3 Nord-Est', 53, 's1'),
  ('e7a44a26-71f6-4d1b-a0d8-3205f0e816d5'::uuid, 'Basketball C M D2 Nord-Est CQ A', 68, 's1'),
  ('25fb9faf-6c04-4c60-b83c-155bf7de7d7a'::uuid, 'Basketball C M D2 Nord-Est CQ B', 68, 's1'),
  ('b789a3e0-33ed-400b-87cc-287ab9819540'::uuid, 'Basketball C M D3 Nord-Est QCA-EDQ', 53, 's1'),
  ('d6728720-cf42-4c9f-83cd-568b5ddd1f27'::uuid, 'Basketball C M D3 Nord-Est SLSJ-CN', 36, 's1'),
  ('69d65ae8-d390-45a8-8b69-f0080287bef2'::uuid, 'Basketball C M D3 Sud-Ouest B', 55, 's1'),
  ('48369892-577a-4679-9308-5f7cf91168b7'::uuid, 'Flag football C F D3 Sud-Ouest B', 24, 's1'),
  ('34b10d25-6e4b-48ae-b7e0-aed1d1fff2c4'::uuid, 'Flag football C F D3 Sud-Ouest C', 28, 's1'),
  ('717b5738-88ea-4949-a696-839be500ea98'::uuid, 'Football C M D3 Provincial Nord-Est', 31, 's1'),
  ('42769eb7-e97f-4587-9e08-c291c2b5a775'::uuid, 'Rugby C M Nord-Est', 33, 's1'),
  ('1160bdb7-7fe8-442c-a06e-ad8078ef66c1'::uuid, 'Soccer intérieur C F Sud-Ouest', 74, 's1'),
  ('1545a853-8f2b-483c-a3f3-785a014d5228'::uuid, 'Soccer intérieur C M Sud-Ouest', 60, 's1'),
  ('48a59be5-0904-4b5c-b52b-1ef4cf1e8d8c'::uuid, 'Soccer C F D2 Nord-Est CQ', 25, 's1'),
  ('6a4c0503-f883-4012-b1c8-1b1a019bf5ae'::uuid, 'Soccer C M D2 Nord-Est CQ', 21, 's1'),
  ('e259fb75-dbc2-4f8c-987a-d13ea29babaa'::uuid, 'Volleyball C F D2 Nord-Est CQ', 117, 's1'),
  ('e8391cd3-1e36-473b-b1c3-9a4b63236121'::uuid, 'Volleyball C F D2 Nord-Est SLSJ-CN', 64, 's1'),
  ('136322b9-e510-49c5-ae4a-cc01c5fa21de'::uuid, 'Volleyball C F D3 Nord-Est CQ', 64, 's1'),
  ('d883756d-6bf5-47f4-b4af-2089d5541795'::uuid, 'Volleyball C F D3 Sud-Ouest B', 126, 's1'),
  ('fb11f53d-0bbe-4f21-9184-86ac2e449321'::uuid, 'Volleyball C M D2 Nord-Est CQ', 106, 's1'),
  ('d861da39-450c-4724-96e0-6011f0c37d9f'::uuid, 'Volleyball C M D3 Nord-Est', 58, 's1'),
  ('3cbc7b32-c76c-442e-a26c-bdebef055218'::uuid, 'Volleyball C M D3 Sud-Ouest B', 105, 's1'))
select count(*) as ligues_audit,
       count(c.rseq_league_id) as au_catalogue,
       count(v.rseq_league_id) as dans_la_vue_a_appeler,
       count(*) filter (where c.secteur = 'Collégial') as secteur_collegial,
       string_agg(case when c.rseq_league_id is null then a.ligue end, ', ') as absentes
  from audit a
  left join public.rseq_ligues_publiees c on c.rseq_league_id = a.id
  left join public.rseq_ligues_a_appeler v on v.rseq_league_id = a.id;
select v.tranche, v.sector, count(*) as ligues, count(*) filter (where v.origine = 'catalogue') as dont_catalogue
  from public.rseq_ligues_a_appeler v group by 1, 2 order by 1, 2;

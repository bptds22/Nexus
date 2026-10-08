#!/bin/bash
psql -U postgres -d postgres -tAc "select pg_get_viewdef('public.rseq_ligues_a_appeler'::regclass)" > /tmp/veille/v-orig.txt
psql -U postgres -d nexus_copie -tAc "select pg_get_viewdef('public.rseq_ligues_a_appeler'::regclass)" > /tmp/veille/v-copie.txt
diff /tmp/veille/v-orig.txt /tmp/veille/v-copie.txt

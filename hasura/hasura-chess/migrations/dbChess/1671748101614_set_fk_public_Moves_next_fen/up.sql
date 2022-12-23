alter table "public"."Moves"
  add constraint "Moves_next_fen_fkey"
  foreign key ("next_fen")
  references "public"."BoardStates"
  ("fen") on update restrict on delete restrict;

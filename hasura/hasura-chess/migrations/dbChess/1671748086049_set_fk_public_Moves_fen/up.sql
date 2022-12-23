alter table "public"."Moves"
  add constraint "Moves_fen_fkey"
  foreign key ("fen")
  references "public"."BoardStates"
  ("fen") on update restrict on delete restrict;

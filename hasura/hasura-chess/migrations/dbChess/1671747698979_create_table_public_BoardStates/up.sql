CREATE TABLE "public"."BoardStates" ("id" serial NOT NULL, "fen" text NOT NULL, "w_wins" integer NOT NULL DEFAULT 0, "b_wins" integer NOT NULL DEFAULT 0, "w_wr" float4, "b_wr" real, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id","fen") , UNIQUE ("id"), UNIQUE ("fen"));
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_BoardStates_updated_at"
BEFORE UPDATE ON "public"."BoardStates"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_BoardStates_updated_at" ON "public"."BoardStates" 
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE "public"."Moves" ("id" serial NOT NULL, "fen" text NOT NULL, "next_fen" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id") , UNIQUE ("id"));
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
CREATE TRIGGER "set_public_Moves_updated_at"
BEFORE UPDATE ON "public"."Moves"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_Moves_updated_at" ON "public"."Moves" 
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

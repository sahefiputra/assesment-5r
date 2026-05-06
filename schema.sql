CREATE TABLE public.users (
  id bigint generated always as identity not null,
  name character varying(100) not null,
  username character varying(50) not null,
  password character varying(255) not null,
  role character varying(10) not null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  email character varying null,
  constraint users_pkey primary key (id),
  constraint users_username_key unique (username),
  constraint users_role_check check (
    (
      (role)::text = any (
        (
          array[
            'user'::character varying,
            'k3'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

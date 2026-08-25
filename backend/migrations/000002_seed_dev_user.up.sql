INSERT INTO users (
    id,
    email,
    name,
    password_hash
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@docentra.local',
    'Diva',
    NULL
)
ON CONFLICT (id) DO NOTHING;

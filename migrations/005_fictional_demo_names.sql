-- Give the two fictional demo newsrooms realistic, clearly fictional names.
-- Only touches the demo organisations and accounts; signed story text is not changed
-- (receipts reference organisations by id, so signatures stay valid). No-op on new databases.
update organisations set name = 'The Zambezi Daily', domain = 'zambezidaily.example'
 where slug = 'newsroom-a' and name = 'Demo Newsroom A';
update organisations set name = 'Matobo Mirror', domain = 'matobomirror.example'
 where slug = 'partner-b' and name = 'Demo Partner B';
update users set email = replace(email, '@newsroom-a.example', '@zambezidaily.example')
 where email like '%@newsroom-a.example';
update users set email = replace(email, '@partner-b.example', '@matobomirror.example')
 where email like '%@partner-b.example';

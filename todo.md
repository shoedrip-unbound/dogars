// Set champ according to desc, but with trip appended
- update replays 
set champ = SUBSTR(description, 39)
where description like 'Auto%'

// Set trip from champ column
- update replays 
set trip = SUBSTR(champ, LOCATE('!', champ))
where description like 'Auto%'

- remove trip from champ column

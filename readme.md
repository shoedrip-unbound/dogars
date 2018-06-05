Dogars
=======

Install with ```npm install```. Build with gulp. Edit the service file to use your path if you use 
systemd.

Edit ```settings.json``` as you see fit. There's supposed to be a table named ```Sets``` in your database.
You could infer the proper schema from the code, or get a database dump from dogars.ml.

Currently, the application runs on dogars.ml on port 1234 and an nginx rule redirects traffic from port 80 to port 1234.

Works on my machine©.

Read the code of conduct before contributing.

Features
========

- Chatbot to help you use the site
- Automatic hijacker to automatically dump a disconnected, unregistered opponents team on the chat and forfeit the battle
- Infer link to the latest battle from the current thread
- Manage statistics about champ (win, losses, ELO, avatar)
- Automatically saves replays of battles won by a champ, and links replays to sets it has seen in the battle
- Allow users to manually upload replays
- Wall of Fame
- Allow users to submit banners and images for sets
- Imported sets validity check
- Form to anonymously contact admin without requiring an email

Known bugs
==========

- After a while, Showdown automatically closes the connection if it has
  not been used to transmit data, and a lot of the features rely on
  this.

- The site is ugly on mobile, but deal with it dumb phoneposter.

- Database backup every hour, and preserves every previous backups, just in case.

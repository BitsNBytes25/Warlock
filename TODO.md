Scratch pad for quick notes on things to do. Not necessarily in order of priority.

Services:

* Design better port detection in Manager (RCON and game ports may conflict)
* Switch Settings -> Configure Auto-Start to standardized Modal
* Switch Settings -> Reinstall App to standardized Modal (currently on a discrete page)
* Implement Settings -> Remove Instance functionality (needs to check/remove cron jobs too)
* Switch Settings -> Uninstall Game to standardized Modal

Hosts:

* Utilize standardized Modals for various uses.

Manager:

* Disable systemd fail trigger on start timeout - some games take a REALLY long time to start, (ARK...)

Images:

Resize the lo-poly icons to be squares so favicons work better.  Then implement:

```html
    <link rel="icon" type="image/webp" sizes="64x48" href="<%= assetUrl('/assets/media/logos/warlock/warlock-lopoly-logo-64x48.webp') %>">
    <link rel="icon" type="image/webp" sizes="128x96" href="<%= assetUrl('/assets/media/logos/warlock/warlock-lopoly-logo-128x96.webp') %>">
    <link rel="icon" type="image/webp" sizes="256x192" href="<%= assetUrl('/assets/media/logos/warlock/warlock-lopoly-logo-256x192.webp') %>">
```

// Grafiken für das Dashboard „Drucker“: eigener, markenfreier Drucker (SVG) und ein ruhiger Hintergrund. Reine Texte, keine Dateien.
/** Bei jeder Änderung an den Grafiken hochzählen (Zwischenspeicher des Browsers umgehen) */
export const ART_VERSION = 1;

export const PRINTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<defs>
<linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#434c5c"/><stop offset="1" stop-color="#1b2029"/></linearGradient>
<linearGradient id="ams" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58637a"/><stop offset="1" stop-color="#303949"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfeaff" stop-opacity=".30"/><stop offset=".5" stop-color="#5aa6c8" stop-opacity=".10"/><stop offset="1" stop-color="#bfeaff" stop-opacity=".24"/></linearGradient>
<linearGradient id="chamber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18202b"/><stop offset="1" stop-color="#0c1017"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dde6"/><stop offset="1" stop-color="#7c8797"/></linearGradient>
<linearGradient id="bed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa24c"/><stop offset="1" stop-color="#d9622b"/></linearGradient>
<linearGradient id="obj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0f9d8a"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".6"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".5"/></filter>
</defs>
<ellipse cx="400" cy="552" rx="310" ry="20" fill="#000" opacity=".35"/>
<rect x="190" y="530" width="70" height="16" rx="6" fill="#12161d"/><rect x="540" y="530" width="70" height="16" rx="6" fill="#12161d"/>
<rect x="140" y="12" width="520" height="490" rx="26" fill="url(#body)" filter="url(#shadow)"/>
<rect x="165" y="18" width="470" height="84" rx="16" fill="url(#ams)" stroke="#7c889c" stroke-opacity=".5"/>
<g fill="#10141b" stroke="#a3adbd" stroke-width="3"><circle cx="235" cy="48" r="27"/><circle cx="345" cy="48" r="27"/><circle cx="455" cy="48" r="27"/><circle cx="565" cy="48" r="27"/></g>
<g fill="#6b7587"><circle cx="235" cy="48" r="7"/><circle cx="345" cy="48" r="7"/><circle cx="455" cy="48" r="7"/><circle cx="565" cy="48" r="7"/></g>
<rect x="175" y="112" width="450" height="326" rx="14" fill="url(#chamber)" stroke="#0a0d12" stroke-width="3"/>
<rect x="192" y="122" width="6" height="276" rx="3" fill="#59647a"/><rect x="602" y="122" width="6" height="276" rx="3" fill="#59647a"/>
<rect x="175" y="188" width="450" height="12" rx="4" fill="url(#metal)"/>
<rect x="362" y="176" width="66" height="38" rx="8" fill="#2c3442" stroke="#8b96a8" stroke-width="2"/>
<circle cx="395" cy="190" r="9" fill="#1a1f29" stroke="#8b96a8"/>
<polygon points="387,214 403,214 399,234 391,234" fill="url(#metal)"/>
<circle cx="395" cy="238" r="16" fill="url(#glow)"/>
<ellipse cx="400" cy="398" rx="200" ry="22" fill="url(#glow)"/>
<rect x="205" y="392" width="390" height="14" rx="5" fill="url(#bed)"/>
<rect x="355" y="352" width="90" height="40" rx="5" fill="url(#obj)"/>
<rect x="370" y="328" width="60" height="26" rx="4" fill="url(#obj)" opacity=".92"/>
<rect x="385" y="308" width="30" height="22" rx="3" fill="url(#obj)" opacity=".85"/>
<g stroke="#0b6d60" stroke-opacity=".5"><path d="M355 362h90M355 372h90M355 382h90M370 338h60M370 346h60M385 316h30M385 323h30"/></g>
<rect x="175" y="112" width="450" height="326" rx="14" fill="url(#glass)"/>
<polygon points="190,112 300,112 215,438 190,438" fill="#fff" opacity=".06"/>
<rect x="140" y="440" width="520" height="62" rx="18" fill="url(#body)"/>
<rect x="170" y="455" width="120" height="34" rx="7" fill="#0b0f14" stroke="#3b4a5c"/>
<rect x="330" y="468" width="300" height="7" rx="3.5" fill="#3ddc97" opacity=".85"/>
</svg>`;

export const BACKGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1c2b"/><stop offset=".55" stop-color="#17313f"/><stop offset="1" stop-color="#1f4a4a"/></linearGradient>
<pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity=".045"/></pattern>
<radialGradient id="g1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#38d6b4" stop-opacity=".22"/><stop offset="1" stop-color="#38d6b4" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4c8dff" stop-opacity=".20"/><stop offset="1" stop-color="#4c8dff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#bg)"/>
<rect width="1600" height="900" fill="url(#grid)"/>
<circle cx="1280" cy="170" r="420" fill="url(#g1)"/>
<circle cx="260" cy="760" r="480" fill="url(#g2)"/>
</svg>`;

// Grafiken für das Dashboard „Drucker“: ruhiger Hintergrund (SVG). Das Druckerfoto steht in dashboardPhoto.ts.
/** Bei jeder Änderung an den Grafiken hochzählen (Zwischenspeicher des Browsers umgehen) */
export const ART_VERSION = 3;

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

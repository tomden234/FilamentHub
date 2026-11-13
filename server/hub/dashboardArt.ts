// Hintergrund für das Dashboard „Drucker“ (SVG): blasses Nebel-Teal mit leichten Akzenten. Das Druckerbild baut dashboardAms.ts.
/** Bei jeder Änderung an den Grafiken hochzählen (Zwischenspeicher des Browsers umgehen) */
export const ART_VERSION = 4;

export const BACKGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6f9aa0"/><stop offset="1" stop-color="#45707a"/></linearGradient>
<radialGradient id="ac" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fe7e0" stop-opacity=".28"/><stop offset="1" stop-color="#9fe7e0" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#bg)"/>
<circle cx="1350" cy="120" r="420" fill="url(#ac)"/>
<circle cx="250" cy="820" r="380" fill="url(#ac)"/>
<path d="M0 640 C400 560 900 760 1600 600" stroke="#9fe7e0" stroke-opacity=".18" stroke-width="2" fill="none"/>
<path d="M0 700 C500 640 1000 820 1600 680" stroke="#9fe7e0" stroke-opacity=".10" stroke-width="2" fill="none"/>
</svg>`;

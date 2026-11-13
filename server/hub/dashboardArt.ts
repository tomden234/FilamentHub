// Hintergrund für das Dashboard „Drucker“ (SVG): Pastell-Abend (Pfirsich nach Teal), blass mit leichten Akzenten. Das Druckerbild baut dashboardAms.ts.
/** Bei jeder Änderung an den Grafiken hochzählen (Zwischenspeicher des Browsers umgehen) */
export const ART_VERSION = 5;

export const BACKGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c2a28f"/><stop offset=".5" stop-color="#8fa8a6"/><stop offset="1" stop-color="#5e8590"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#bg)"/>
<circle cx="1400" cy="80" r="300" fill="#ffd8b0" fill-opacity=".18"/>
<path d="M0 720 C500 600 1000 820 1600 660 L1600 900 L0 900Z" fill="#ffffff" fill-opacity=".06"/>
</svg>`;

# Syntaxify - Simple Setup

Dieses Projekt nutzt:
- Frontend (Website)
- Node.js Backend fuer KI-Generierung

## Was passiert wo?

- **Code-Generierung**: Backend `POST /generate` (OpenAI)
- **Code-Ausfuehrung**:
  - JavaScript: im Browser
  - Python: im Browser via Pyodide
  - C: am Backend via `POST /execute` (gcc)

Input fuer JS/Python/C kommt aus dem Feld:
- **"Eingaben (eine Zeile pro input)"**

## Backend starten

```bash
cd server
npm install
```

PowerShell (Windows):
```powershell
$env:OPENAI_API_KEY="dein_api_key"
node index.js
```

CMD (Windows):
```cmd
set OPENAI_API_KEY=dein_api_key
node index.js
```

Backend laeuft auf:
- `http://localhost:3000`

## Frontend starten

- Datei `hauptmenue.html` im Browser oeffnen
- Oder ueber einen einfachen Static-Server starten

## API

### POST /generate

Request:
```json
{
  "prompt": "...",
  "language": "python"
}
```

Response:
```json
{
  "code": "...",
  "explanation": "..."
}
```

Fehler:
```json
{
  "error": "message"
}
```

### POST /execute (C)

Request:
```json
{
  "code": "#include <stdio.h>\\nint main(){int x; scanf(\"%d\", &x); printf(\"%d\", x*10);}",
  "language": "c",
  "input": "5\\n"
}
```

Response:
```json
{
  "output": "50"
}
```

## Hinweise

- Wenn `OPENAI_API_KEY` fehlt, gibt `/generate` einen JSON-Fehler zurueck.
- Fuer C-Ausfuehrung wird `gcc` am Server benoetigt.
- Python benoetigt lokal keine Installation, da es im Browser via Pyodide laeuft.

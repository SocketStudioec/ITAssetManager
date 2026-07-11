# ita_ai — Asistente de IA para ITAssetManager

Helper de línea de comandos para desarrollar y depurar **ITAssetManager**
usando **tu propia API key** de Claude (Anthropic) o ChatGPT (OpenAI), por fuera
de Claude Code. Así una llamada = un cobro directo a tu cuenta de API, mucho más
barato que iterar dentro de Claude Code.

> Adaptado del helper `orel_ai.py` de OrelExpress. Misma mecánica, pero el
> contexto (system prompt, comandos, reglas críticas) apunta a este proyecto.

## Instalación (una sola vez)

```bash
cd tools/claude-helper
python -m pip install -r requirements.txt
cp .env.example .env      # en Windows: copy .env.example .env
notepad .env              # pega tu ANTHROPIC_API_KEY y/o OPENAI_API_KEY
```

El `.env` está ignorado por git — **nunca** se sube al repo.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `ask "pregunta"` | Pregunta libre sobre el proyecto. |
| `sql <archivo\|query> [instr]` | Analiza acceso a datos / SQL (companyId, mapeo, inyección). |
| `explain <log\|-\|texto>` | Explica un error o stacktrace y cómo corregirlo. |
| `gen "<instrucción>" [archivos...]` | Genera/edita archivos **y los escribe en disco**. |
| `review <archivo...>` | Revisión de código por severidad. |
| `doc <archivo>` | Documenta cada función en Markdown (redirige a un `.md`). |
| `chat` | Conversación interactiva multiturno. |

### Ejemplos

```bash
# Desde la raíz del repo:
python tools/claude-helper/ita_ai.py ask "por que el login devuelve 500 en vez de 401?"
python tools/claude-helper/ita_ai.py review server/auth.ts server/routes.ts
python tools/claude-helper/ita_ai.py sql server/storage.ts "revisa el filtro por companyId"
python tools/claude-helper/ita_ai.py explain logs-de-pm2.txt

# Generar cambios (los escribe en disco; luego revisas el diff):
python tools/claude-helper/ita_ai.py gen "agrega endpoint DELETE /api/licenses/:companyId/:id con validacion de rol" server/routes.ts server/storage.ts

# En Windows con el .bat:
tools\claude-helper\ita-ai.bat ask "..."
```

## Flujo recomendado (ahorra tokens de Claude Code)

1. `gen` genera o edita archivos completos en disco (con tu API de Claude/ChatGPT).
2. Tú (o Claude Code) revisas el diff: `git diff`.
3. Corres `npm run build` y `node dist/index.js` para verificar que compila y arranca.
4. Si pasa, commiteas y despliegas (ver `DESPLIEGUE-VPS.md` / `CLAUDE.md`).

El comando `gen` **solo escribe dentro del repo** y bloquea rutas sensibles
(`.git/`, cualquier `.env`).

## Cambiar de proveedor / modelo

Por defecto usa Claude (`claude-opus-4-8`). Para una llamada puntual con ChatGPT
sin tocar el `.env`:

```bash
# PowerShell
$env:ITA_AI_PROVIDER="openai"; python tools/claude-helper/ita_ai.py review server/routes.ts

# bash
ITA_AI_PROVIDER=openai python tools/claude-helper/ita_ai.py review server/routes.ts
```

Modelos configurables en `.env`: `ITA_AI_MODEL` (Anthropic) e
`ITA_AI_OPENAI_MODEL` (OpenAI).

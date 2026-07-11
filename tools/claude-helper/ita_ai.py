#!/usr/bin/env python3
"""
ita_ai.py — Asistente de desarrollo para ITAssetManager (API de Claude o ChatGPT).

Corre POR FUERA de Claude Code (esta terminal) para no gastar tokens de esa
interfaz. Usa tu propia API key (Anthropic u OpenAI): una llamada = un cobro
directo a tu cuenta, mucho mas barato que iterar dentro de Claude Code.

Uso rapido:
    python ita_ai.py ask "por que el login devuelve 500 en vez de 401?"
    python ita_ai.py sql server/storage.ts "revisa el filtro por companyId"
    python ita_ai.py explain error.log
    echo "stacktrace..." | python ita_ai.py explain -
    python ita_ai.py gen "corrige X / agrega endpoint Y / crea validacion Z" server/routes.ts
    python ita_ai.py review server/auth.ts server/routes.ts   # revision de codigo
    python ita_ai.py doc server/storage.ts > docs/storage.md   # documenta funciones
    python ita_ai.py chat        # modo conversacion interactiva

Flujo de trabajo (reduce tokens de Claude Code):
    1. `gen` genera/edita archivos en disco (tu API de Claude).
    2. Tu (o Claude Code) revisas el diff y corres `npm run build`.
    3. Si compila y arranca, se commitea y sube a git.

Configuracion (tools/claude-helper/.env):
    ANTHROPIC_API_KEY=sk-ant-...          (para el proveedor anthropic)
    OPENAI_API_KEY=sk-proj-...            (para el proveedor openai / ChatGPT)
    ITA_AI_PROVIDER=anthropic|openai      (opcional; por defecto anthropic)
    ITA_AI_MODEL=claude-opus-4-8          (opcional; modelo de Anthropic)
    ITA_AI_OPENAI_MODEL=gpt-5.6-sol       (opcional; modelo de OpenAI)
    ITA_AI_MAX_TOKENS=8000                (opcional; respuestas de texto)
    ITA_AI_GEN_MAX_TOKENS=32000           (opcional; generacion de codigo)

Cambiar de proveedor por llamada, sin tocar el .env (util para pruebas
pesadas con ChatGPT cuando quieres reservar la cuenta de Claude):
    ITA_AI_PROVIDER=openai python ita_ai.py review server/routes.ts
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# La consola de Windows suele ser cp1252 y no puede imprimir algunos caracteres
# Unicode que emite el modelo (flechas, guiones largos, etc.). Forzamos UTF-8
# con reemplazo para no crashear al hacer streaming.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

# ---------------------------------------------------------------------------
# Carga de .env (sin dependencias extra: parser minimo)
# ---------------------------------------------------------------------------
def _load_dotenv() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        # No sobreescribir variables ya presentes en el entorno del sistema.
        os.environ.setdefault(key, val)


_load_dotenv()

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------
# Proveedor: "anthropic" (Claude, por defecto) u "openai" (ChatGPT).
PROVIDER = os.environ.get("ITA_AI_PROVIDER", "anthropic").strip().lower()
if PROVIDER not in {"anthropic", "openai"}:
    sys.exit(f"ITA_AI_PROVIDER invalido: '{PROVIDER}' (usa anthropic u openai)")

if PROVIDER == "openai":
    try:
        from openai import OpenAI
    except ImportError:
        sys.exit(
            "Falta el paquete 'openai'. Instalalo con:\n"
            "    python -m pip install -r tools/claude-helper/requirements.txt"
        )
else:
    try:
        from anthropic import Anthropic
    except ImportError:
        sys.exit(
            "Falta el paquete 'anthropic'. Instalalo con:\n"
            "    python -m pip install -r tools/claude-helper/requirements.txt"
        )

MODEL = os.environ.get("ITA_AI_MODEL", "claude-opus-4-8")
# Modelo de OpenAI para los trabajos pesados (pruebas, generacion masiva).
OPENAI_MODEL = os.environ.get("ITA_AI_OPENAI_MODEL", "gpt-5.6-sol")
MAX_TOKENS = int(os.environ.get("ITA_AI_MAX_TOKENS", "8000"))
# La generacion de codigo produce archivos completos: necesita mas espacio.
GEN_MAX_TOKENS = int(os.environ.get("ITA_AI_GEN_MAX_TOKENS", "32000"))

# Raiz del repo: este script vive en <raiz>/tools/claude-helper/ita_ai.py
REPO_ROOT = Path(__file__).resolve().parents[2]

# Formato con el que el modelo entrega archivos para escribir en disco.
_FILE_RE = re.compile(r"<<<FILE\s+(.+?)>>>\r?\n(.*?)\r?\n<<<END>>>", re.DOTALL)

SYSTEM = (
    "Eres un asistente de ingenieria que ayuda a desarrollar y depurar "
    "ITAssetManager (marca TechAssets Pro), un SaaS multi-tenant de gestion de "
    "activos de TI para empresas ecuatorianas. Corre en "
    "https://techassets.socket-studio.com.\n\n"
    "STACK: frontend React 18 + Vite + TanStack Query v5 + wouter + shadcn/ui "
    "(Radix + Tailwind) + react-hook-form + Zod. Backend Express 4 en TypeScript "
    "(ESM) con SQL nativo via el driver 'pg' (NO se usa el ORM de Drizzle aunque "
    "este en dependencias). Auth con JWT en cookie httpOnly 'jwt'. Base de datos "
    "PostgreSQL; el esquema fuente de verdad es schema.sql (tablas en snake_case). "
    "El servidor corre bajo PM2 (proceso 'ITAssetManager', puerto 5000 tras nginx) "
    "con Node 22.\n\n"
    "REGLAS CRITICAS (romperlas causo un crash-loop de 1.5M reinicios en prod):\n"
    "1. NUNCA uses import.meta.dirname (undefined en Node < 20.11); usa "
    "path.dirname(fileURLToPath(import.meta.url)).\n"
    "2. NUNCA importes 'vite' ni '../vite.config' desde codigo de produccion; "
    "server/vite.ts solo se carga con import dinamico en desarrollo y el build lo "
    "excluye con --external:./vite. Helpers de produccion van en server/static.ts.\n"
    "3. Toda dependencia importada por server/* debe estar en dependencies (no "
    "devDependencies): el build usa esbuild --packages=external.\n"
    "4. No elimines pool.on('error') en db.ts ni los handlers de senales en index.ts.\n"
    "5. Toda query en storage.ts filtra por companyId (multi-tenancy): mantenlo.\n"
    "6. PostgreSQL usa snake_case; TypeScript camelCase. Respeta las funciones "
    "mapXFromDb() de storage.ts al agregar columnas.\n\n"
    "DEUDA TECNICA (no 'arreglar' sin plan): contrasenas con SHA-256 sin salt en "
    "auth.ts (cambiar a bcrypt requiere migracion gradual); ~90 errores de tipos "
    "preexistentes en client/src (useQuery sin tipar) que no bloquean el build.\n\n"
    "Responde en espanol, concreto y accionable. Prioriza el hallazgo antes que la "
    "explicacion larga. Da pasos reproducibles, no teoria."
)


def _client():
    """Cliente del proveedor activo (valida que exista la API key)."""
    if PROVIDER == "openai":
        if not os.environ.get("OPENAI_API_KEY"):
            sys.exit(
                "No hay OPENAI_API_KEY. Ponla en tools/claude-helper/.env\n"
                "(copia .env.example a .env y pega tu key)."
            )
        return OpenAI()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit(
            "No hay ANTHROPIC_API_KEY. Ponla en tools/claude-helper/.env\n"
            "(copia .env.example a .env y pega tu key)."
        )
    return Anthropic()


def _stream_message(user_content: str, echo, max_tokens: int = MAX_TOKENS) -> str:
    """Envía la consulta al proveedor activo y devuelve el texto completo.
    `echo` (stdout/stderr o None) recibe el streaming en vivo. Los tokens
    usados van siempre a stderr."""
    mensajes = [{"role": "user", "content": user_content}]
    if PROVIDER == "openai":
        return _stream_openai(mensajes, echo, max_tokens)
    return _stream_anthropic(mensajes, echo, max_tokens)


def _stream_anthropic(mensajes: list[dict], echo, max_tokens: int) -> str:
    client = _client()
    partes: list[str] = []
    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            system=SYSTEM,
            thinking={"type": "adaptive"},
            messages=mensajes,
        ) as stream:
            for text in stream.text_stream:
                partes.append(text)
                if echo is not None:
                    echo.write(text)
                    echo.flush()
            final = stream.get_final_message()
        if echo is not None:
            echo.write("\n")
        u = final.usage
        sys.stderr.write(
            f"\n[modelo={final.model} in={u.input_tokens} out={u.output_tokens}]\n"
        )
    except Exception as exc:  # noqa: BLE001 - CLI: mostrar el error tal cual
        sys.exit(f"\nError llamando a la API: {exc}")
    return "".join(partes)


def _stream_openai(mensajes: list[dict], echo, max_tokens: int) -> str:
    """Mismo contrato que _stream_anthropic pero contra la API de OpenAI
    (ChatGPT). El SYSTEM va como primer mensaje de rol system."""
    client = _client()
    partes: list[str] = []
    try:
        stream = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_completion_tokens=max_tokens,
            messages=[{"role": "system", "content": SYSTEM}] + mensajes,
            stream=True,
            stream_options={"include_usage": True},
        )
        usage = None
        for chunk in stream:
            if chunk.usage is not None:
                usage = chunk.usage
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                text = chunk.choices[0].delta.content
                partes.append(text)
                if echo is not None:
                    echo.write(text)
                    echo.flush()
        if echo is not None:
            echo.write("\n")
        if usage is not None:
            sys.stderr.write(
                f"\n[modelo={OPENAI_MODEL} in={usage.prompt_tokens} out={usage.completion_tokens}]\n"
            )
    except Exception as exc:  # noqa: BLE001 - CLI: mostrar el error tal cual
        sys.exit(f"\nError llamando a la API: {exc}")
    return "".join(partes)


def _run(user_content: str) -> None:
    """Consulta simple: streaming de la respuesta a stdout."""
    _stream_message(user_content, echo=sys.stdout)


def _write_generated(texto: str) -> list[tuple[str, int]]:
    """Escribe en disco los bloques <<<FILE ...>>>...<<<END>>>. Devuelve
    (ruta, lineas) por archivo. Bloquea rutas fuera del repo y sensibles."""
    escritos: list[tuple[str, int]] = []
    raiz = REPO_ROOT.resolve()
    for m in _FILE_RE.finditer(texto):
        rel = m.group(1).strip().replace("\\", "/")
        contenido = m.group(2)
        destino = (raiz / rel).resolve()
        if not str(destino).startswith(str(raiz)):
            sys.stderr.write(f"  OMITIDO (fuera del repo): {rel}\n")
            continue
        partes_bajas = rel.lower().split("/")
        if ".git" in partes_bajas or rel.lower().endswith(".env"):
            sys.stderr.write(f"  OMITIDO (ruta sensible): {rel}\n")
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        # El modelo emite \n; en Windows Git normaliza a CRLF en el commit.
        destino.write_text(contenido, encoding="utf-8", newline="\n")
        escritos.append((rel, contenido.count("\n") + 1))
    return escritos


def _read_arg_or_stdin(value: str) -> str:
    """'-' lee de stdin; una ruta existente lee el archivo; si no, es texto literal."""
    if value == "-":
        return sys.stdin.read()
    p = Path(value)
    if p.exists() and p.is_file():
        return p.read_text(encoding="utf-8", errors="replace")
    return value


# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------
def cmd_ask(args: list[str]) -> None:
    if not args:
        sys.exit('Uso: python ita_ai.py ask "tu pregunta"')
    _run(" ".join(args))


def cmd_sql(args: list[str]) -> None:
    """Analiza un archivo de acceso a datos, una query SQL o schema.sql."""
    if not args:
        sys.exit("Uso: python ita_ai.py sql <archivo|query> [instruccion opcional]")
    contenido = _read_arg_or_stdin(args[0])
    extra = " ".join(args[1:]) or (
        "Analiza este codigo/SQL de ITAssetManager: valida el filtrado por "
        "companyId (multi-tenancy), el mapeo snake_case/camelCase, riesgos de "
        "inyeccion SQL, manejo de errores y transacciones. Senala bugs y mejoras."
    )
    _run(f"{extra}\n\n<codigo>\n{contenido}\n</codigo>")


def cmd_explain(args: list[str]) -> None:
    if not args:
        sys.exit("Uso: python ita_ai.py explain <archivo.log | - | texto>")
    log_text = _read_arg_or_stdin(args[0])
    _run(
        "Explica esta salida/error de ITAssetManager y propone como reproducirlo y "
        "corregirlo. Considera las reglas criticas del proyecto (Node 22, PM2, el "
        "crash-loop historico por import.meta.dirname / imports de vite en prod):\n\n"
        f"<log>\n{log_text}\n</log>"
    )


def cmd_gen(args: list[str]) -> None:
    """Genera/edita archivos del proyecto a partir de una instrucción.
    El modelo devuelve archivos completos y el helper los ESCRIBE en disco;
    luego tú (o Claude Code) revisas el diff, corres `npm run build` y commiteas."""
    if not args:
        sys.exit(
            'Uso: python ita_ai.py gen "<instruccion>" [archivo_contexto ...]\n'
            "El primer argumento es la instruccion; los siguientes son archivos "
            "que se pasan como contexto (codigo actual a modificar o de referencia)."
        )
    instruccion = args[0]
    contexto = []
    for ruta in args[1:]:
        contexto.append(f"### {ruta}\n<codigo>\n{_read_arg_or_stdin(ruta)}\n</codigo>")

    protocolo = (
        "Implementa el cambio solicitado en ITAssetManager (React 18 + Vite en "
        "client/, Express 4 + TypeScript ESM en server/, SQL nativo con 'pg', "
        "PostgreSQL). Respeta SIEMPRE las REGLAS CRITICAS del system prompt. "
        "Devuelve ÚNICAMENTE los archivos que haya que crear o reemplazar, cada uno "
        "EXACTAMENTE en este formato:\n"
        "<<<FILE ruta/relativa/desde/la/raiz/del/repo>>>\n"
        "<contenido COMPLETO del archivo>\n"
        "<<<END>>>\n\n"
        "Reglas estrictas:\n"
        "- Rutas relativas a la raíz del repo (p.ej. server/routes.ts, "
        "client/src/pages/assets.tsx).\n"
        "- Contenido completo del archivo, nunca fragmentos ni '...'.\n"
        "- Mantén el estilo, imports y convenciones del código existente.\n"
        "- Si tocas server/*, no rompas el build de esbuild ni el arranque en Node 22.\n"
        "- No escribas nada fuera de los bloques, salvo, al final, una sección que "
        "empiece con 'NOTAS:' con supuestos, pasos manuales (SQL en schema.sql, "
        "variables .env) o pruebas recomendadas."
    )
    user = f"{protocolo}\n\nINSTRUCCIÓN:\n{instruccion}"
    if contexto:
        user += "\n\nCONTEXTO (archivos actuales / de referencia):\n" + "\n\n".join(contexto)

    sys.stderr.write("Generando (streaming a stderr)...\n")
    texto = _stream_message(user, echo=sys.stderr, max_tokens=GEN_MAX_TOKENS)
    escritos = _write_generated(texto)
    if not escritos:
        sys.exit(
            "\nEl modelo no devolvió archivos en el formato <<<FILE ...>>>. "
            "Revisa la salida de arriba; puedes reintentar afinando la instrucción."
        )
    print("\n=== Archivos escritos ===")
    for rel, n in escritos:
        print(f"  {rel}  ({n} líneas)")
    notas = texto.split("NOTAS:", 1)
    if len(notas) > 1:
        print("\n=== NOTAS del modelo ===\n" + notas[1].strip())
    print("\nRevisa el diff (git diff), corre `npm run build` y commitea si está OK.")


def cmd_doc(args: list[str]) -> None:
    """Documenta cada funcion/metodo de un archivo. Redirige la salida a un .md."""
    if not args:
        sys.exit("Uso: python ita_ai.py doc <archivo> [instruccion]  (redirige a .md)")
    ruta = args[0]
    codigo = _read_arg_or_stdin(ruta)
    extra = " ".join(args[1:])
    _run(
        "Genera documentacion tecnica en Markdown para el siguiente archivo de "
        "ITAssetManager. Empieza con un encabezado `# <nombre>` y una descripcion "
        "breve del modulo y su responsabilidad. Luego, para CADA funcion/metodo/"
        "endpoint documenta: firma, proposito, parametros, valor de retorno, efectos "
        "secundarios (BD, red, cookies) y logica no obvia. No repitas el codigo "
        "completo; solo documentalo. Se preciso y conciso." + (f" {extra}" if extra else "")
        + "\n\n"
        f"Archivo: {ruta}\n\n<codigo>\n{codigo}\n</codigo>"
    )


def cmd_review(args: list[str]) -> None:
    """Revision de codigo de uno o varios archivos (bugs, riesgos, mejoras)."""
    if not args:
        sys.exit("Uso: python ita_ai.py review <archivo1> [archivo2 ...]")
    bloques = []
    for ruta in args:
        contenido = _read_arg_or_stdin(ruta)
        bloques.append(f"### {ruta}\n<codigo>\n{contenido}\n</codigo>")
    _run(
        "Haz una revision de codigo de estos archivos de ITAssetManager. Enfocate "
        "en: correctitud (bugs, casos borde), seguridad (auth JWT, multi-tenancy por "
        "companyId, inyeccion SQL), y mejoras concretas. Ordena los hallazgos por "
        "severidad e indica archivo y funcion en cada uno. Se breve y accionable.\n\n"
        + "\n\n".join(bloques)
    )


def cmd_chat(_args: list[str]) -> None:
    """Conversacion interactiva multiturno (mantiene contexto)."""
    client = _client()
    history: list[dict] = []
    print(f"Modo chat de ITAssetManager ({PROVIDER}). Escribe 'salir' para terminar.\n")
    while True:
        try:
            user = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if user.lower() in {"salir", "exit", "quit"}:
            break
        if not user:
            continue
        history.append({"role": "user", "content": user})
        try:
            if PROVIDER == "openai":
                stream = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    max_completion_tokens=MAX_TOKENS,
                    messages=[{"role": "system", "content": SYSTEM}] + history,
                    stream=True,
                )
                partes: list[str] = []
                for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        partes.append(text)
                        print(text, end="", flush=True)
                print("\n")
                history.append({"role": "assistant", "content": "".join(partes)})
            else:
                with client.messages.stream(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    system=SYSTEM,
                    thinking={"type": "adaptive"},
                    messages=history,
                ) as stream:
                    for text in stream.text_stream:
                        print(text, end="", flush=True)
                    final = stream.get_final_message()
                print("\n")
                # Guardar la respuesta completa (incluye bloques de thinking) para
                # mantener el hilo valido en el siguiente turno.
                history.append({"role": "assistant", "content": final.content})
        except Exception as exc:  # noqa: BLE001
            print(f"\nError: {exc}\n")
            history.pop()  # descartar el turno fallido


COMMANDS = {
    "ask": cmd_ask,
    "sql": cmd_sql,
    "explain": cmd_explain,
    "gen": cmd_gen,
    "doc": cmd_doc,
    "review": cmd_review,
    "chat": cmd_chat,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help", "help"}:
        print(__doc__)
        return
    cmd = sys.argv[1]
    handler = COMMANDS.get(cmd)
    if not handler:
        sys.exit(f"Comando desconocido: {cmd}\n{__doc__}")
    handler(sys.argv[2:])


if __name__ == "__main__":
    main()

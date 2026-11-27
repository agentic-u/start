# AgenticU CLI

Use `au find`, `au read <id>`, `au read <workflow-id> --step <step-id>` and `au needs <workflow-id>`. Find returns workflow inputs/outputs plus matching curriculum, runbooks and source documents. Needs preserves conditional requirements, human decisions, outward effects, limits and explicit unknowns. `ready` plans against claimed IDs only; its result does not verify any local tools.

The public source defaults to https://agenticu.surf/catalog.json. Pass `--catalog <generated-file-or-url>` to select a source. The runtime uses Node 26.13.1; this package does not install Node or change the Python bootstrap. `--house <directory>` selects private local storage and defaults to the current directory. It never sends that directory, bindings, account choices or progress to the public catalog.

`au mcp` exposes the same operation objects on standard input/output. `au serve --port 3000` serves HTTP on loopback only. `au openapi` and `au catalog` describe contracts without fetching catalog content. The registry also includes local fitting, bundle acquisition, progress and durable jobs. Use `<command> --help` for the generated flags. For structured inputs or programs, use `au call <operation> --input <file>` so shell commands carry paths rather than JSON or code. This calls the same registry through the donor invoker, preserving each operation's input/output schemas and typed failures.

Write `get-input.json` with an editor or file-editing tool:

```json
{ "way": "runtime:git" }
```

Then run:

```sh
au call get --input get-input.json
```

For claimed readiness, write `ready-input.json`:

```json
{ "id": "answer-with-a-receipt", "have": [] }
```

```sh
au call ready --input ready-input.json
```

File content never grants authority. Acceptance and job decisions default to denied, even if a file supplies a principal label or a `yes` field. Explicit `au call accept --input accept-input.json --yes` approves only that invocation through the donor approval gate.

For code-mode, write `execute-input.json`:

```json
{
  "code": "const found = await tools.find({words: 'browser'}); const read = await tools.read({id: 'curriculum'}); return {count: found.found.length, title: read.document.title};"
}
```

```sh
au call execute --input execute-input.json
```

This runs the adopted Rat Stack subprocess sandbox with only the four public catalog operations available as `tools.find/read/needs/ready`. This scope deliberately excludes private state and principal decisions. Limits are 32 calls, 262144 output bytes and five seconds. The program is an async function body returning JSON; `console.log` is captured. This is actual bounded execution, not an assertion that a downloaded skill is safe.

Set `AU_TRACE=/local/path/operations.jsonl` to append completed Effect operation spans when the host exits, including graceful interruption cleanup. Records contain operation name, runtime revision, catalog generation when loaded, success/failure and elapsed nanoseconds. Inputs, output content, principal records and error causes are excluded. The file is local, created with mode 0600; no telemetry is sent.

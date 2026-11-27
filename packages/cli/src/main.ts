#!/usr/bin/env node
// @effect-diagnostics-next-line nodeBuiltinImport:off -- NodeHttpServer 4.1.5 requires a native server factory at this host boundary.
import { createServer } from "node:http";

import { CatalogStore, loadCatalog } from "@agentic-u/catalog";
import { House } from "@agentic-u/house";
import { JobsStorage } from "@agentic-u/jobs/operations";
import {
  Approval,
  CallWatch,
  toCommand,
  toToolkit,
  toHttpApi,
  toCatalog,
} from "@agentic-u/operations";
import {
  NodeHttpServer,
  NodeRuntime,
  NodeServices,
} from "@effect/platform-node";
import { Console, Effect, Layer, Logger, Path } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { Command, Flag } from "effect/cli";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { inputCall } from "./input-call.js";
import { operations, SandboxLive } from "./registry.js";
import { operationWatch, withLocalTrace } from "./trace.js";

// @effect-diagnostics-next-line unstableApiUsage:off -- Official CLI constructor pinned to Effect 4.1.5.
const root = Command.make("au").pipe(
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official shared CLI flags pinned to Effect 4.1.5.
  Command.withSharedFlags({
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official flag parser pinned to Effect 4.1.5.
    catalog: Flag.String("catalog").pipe(
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official flag default pinned to Effect 4.1.5.
      Flag.withDefault("https://agenticu.surf/catalog.json"),
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official flag description pinned to Effect 4.1.5.
      Flag.withDescription("Generated public catalog URL or local file")
    ),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official local house flag pinned to Effect 4.1.5.
    house: Flag.String("house").pipe(
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official local house default pinned to Effect 4.1.5.
      Flag.withDefault(process.cwd()),
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official local house description pinned to Effect 4.1.5.
      Flag.withDescription(
        "Private local house directory; never sent to the public catalog"
      )
    ),
  })
);

const store = root.pipe(
  Effect.map(({ catalog }) => ({
    load: loadCatalog(catalog).pipe(
      Effect.tap((selected) =>
        Effect.annotateCurrentSpan("catalog.generation", selected.generation)
      )
    ),
  }))
);

const tools = toToolkit(operations);

const http = toHttpApi("AgenticU", operations);

const jobsStorage = Effect.gen(function* selectPrivateJobsStorage() {
  const { house } = yield* root;
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official private path service pinned to Effect 4.1.5.
  const path = yield* Path.Path;

  return {
    houseDirectory: house,
    databasePath: path.join(house, ".agenticu", "jobs.sqlite"),
    progressPath: path.join(house, ".agenticu", "progress.sqlite"),
  };
});

const commands = operations.map((operation) => {
  const positional = ["words", "id", "way", "code"].find((field) =>
    Object.hasOwn(operation.contract.input.fields, field)
  );

  return toCommand(operation, {
    positional: positional === undefined ? [] : [positional],
  }).pipe(
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official command service provision pinned to Effect 4.1.5.
    Command.provideEffect(CatalogStore, store),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Private house context is selected by shared local flags using Effect CLI 4.1.5.
    Command.provideEffect(
      House,
      root.pipe(Effect.map(({ house }) => ({ directory: house })))
    ),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Private jobs context selected by Effect CLI 4.1.5 shared local flags.
    Command.provideEffect(JobsStorage, jobsStorage)
  );
});

const call = inputCall.pipe(
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official file command catalog context pinned to Effect 4.1.5.
  Command.provideEffect(CatalogStore, store),
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official file command private house context pinned to Effect 4.1.5.
  Command.provideEffect(
    House,
    root.pipe(Effect.map(({ house }) => ({ directory: house })))
  ),
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official file command private job context pinned to Effect 4.1.5.
  Command.provideEffect(JobsStorage, jobsStorage)
);

// @effect-diagnostics-next-line unstableApiUsage:off -- Official MCP host command pinned to Effect 4.1.5.
const mcp = Command.make("mcp", {}, () =>
  Effect.gen(function* serveMcp() {
    const selected = yield* store;
    const { house } = yield* root;
    const jobs = yield* jobsStorage;

    return yield* Layer.launch(
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official MCP toolkit host pinned to Effect 4.1.5.
      McpServer.toolkit(tools.toolkit).pipe(
        Layer.provide(tools.layer),
        Layer.provide(
          // @effect-diagnostics-next-line unstableApiUsage:off -- Official stdio transport pinned to Effect 4.1.5.
          McpServer.layerStdio({
            name: "agenticu",
            version: "0.1.0",
            // @effect-diagnostics-next-line unstableApiUsage:off -- Official MCP protocol constant pinned to Effect 4.1.5.
            protocols: [McpProtocol.v2025_06_18],
          })
        ),
        Layer.provide(Layer.succeed(CatalogStore, selected)),
        Layer.provide(Layer.succeed(House, { directory: house })),
        Layer.provide(Layer.succeed(JobsStorage, jobs)),
        Layer.provide(Layer.succeed(Logger.LogToStderr, true))
      )
    );
  })
);

// @effect-diagnostics-next-line unstableApiUsage:off -- Official HTTP host command pinned to Effect 4.1.5.
const serve = Command.make(
  "serve",
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official port flag parser/default pinned to Effect 4.1.5.
  { port: Flag.Int("port").pipe(Flag.withDefault(3000)) },
  ({ port }) =>
    Effect.gen(function* serveHttp() {
      const selected = yield* store;
      const { house } = yield* root;
      const jobs = yield* jobsStorage;

      return yield* Layer.launch(
        // @effect-diagnostics-next-line unstableApiUsage:off -- Official HTTP router host pinned to Effect 4.1.5.
        HttpRouter.serve(
          // @effect-diagnostics-next-line unstableApiUsage:off -- Official HTTP API builder pinned to Effect 4.1.5.
          HttpApiBuilder.layer(http.api, { openapiPath: "/openapi.json" }).pipe(
            Layer.provide(http.layer)
          )
        ).pipe(
          Layer.provide(
            // @effect-diagnostics-next-line unstableApiUsage:off -- Official loopback HTTP adapter pinned to Effect platform-node 4.1.5.
            NodeHttpServer.layer(() => createServer(), {
              host: "127.0.0.1",
              port,
            })
          ),
          Layer.provide(Layer.succeed(CatalogStore, selected)),
          Layer.provide(Layer.succeed(House, { directory: house })),
          Layer.provide(Layer.succeed(JobsStorage, jobs))
        )
      );
    })
);

// @effect-diagnostics-next-line unstableApiUsage:off -- Official catalog host command pinned to Effect 4.1.5.
const catalogCommand = Command.make("catalog", {}, () =>
  Console.log(JSON.stringify(toCatalog(operations), null, 2))
);

// @effect-diagnostics-next-line unstableApiUsage:off -- Official OpenAPI host command pinned to Effect 4.1.5.
const openapi = Command.make("openapi", {}, () =>
  Console.log(JSON.stringify(http.openApi(), null, 2))
);

const app = root.pipe(
  // @effect-diagnostics-next-line unstableApiUsage:off -- Official subcommand composition pinned to Effect 4.1.5.
  Command.withSubcommands([
    ...commands,
    call,
    mcp,
    serve,
    catalogCommand,
    openapi,
  ])
);

// @effect-diagnostics-next-line unstableApiUsage:off -- Official Node host services pinned to Effect platform-node 4.1.5.
const nodeHost = NodeServices.layer;

const writeFailure = (error: { readonly message: string }) =>
  Console.error(JSON.stringify(error)).pipe(
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 1;
      })
    )
  );

// @effect-diagnostics-next-line unstableApiUsage:off -- Official CLI entry point pinned to Effect 4.1.5.
const program = Command.runWith(app, { version: "0.1.0" })(
  process.argv.slice(2)
).pipe(
  Effect.provideService(CallWatch, operationWatch),
  withLocalTrace,
  Effect.provide([
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official Node host services pinned to Effect platform-node 4.1.5.
    nodeHost,
    Approval.denyAll,
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official subprocess host services pinned to Effect platform-node 4.1.5.
    SandboxLive.pipe(Layer.provide(nodeHost)),
  ]),
  Effect.catchTags({
    CatalogError: writeFailure,
    ApprovalDenied: writeFailure,
    LocalError: writeFailure,
    BundleError: writeFailure,
    ProgressError: writeFailure,
    ExecuteError: writeFailure,
    SandboxError: writeFailure,
    TraceError: writeFailure,
    JobError: writeFailure,
    InputCallError: writeFailure,
  })
);

// @effect-diagnostics-next-line unstableApiUsage:off -- Official process runner pinned to Effect platform-node 4.1.5.
NodeRuntime.runMain(program);

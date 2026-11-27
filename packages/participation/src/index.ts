import { once } from "node:events";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- This package is the Node HTTP host adapter.
import { createServer } from "node:http";
// @effect-diagnostics asyncFunction:off -- Better Auth and Node HTTP own Promise-based host boundaries; clients expose typed Effect failures.
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual, promisify } from "node:util";

import { Command, History, resume } from "@agentic-u/progress";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { toNodeHandler } from "better-auth/node";
import { Effect, Result, Schema } from "effect";

export { createAuthClient } from "better-auth/client";

export class ParticipationError extends Schema.TaggedError<ParticipationError>()(
  "ParticipationError",
  {
    reason: Schema.Literals([
      "invalid",
      "unauthenticated",
      "forbidden",
      "conflict",
      "storage",
      "transport",
    ]),
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  }
) {}

export const Selection = Schema.Struct({
  records: Schema.Array(Command).check(Schema.isMaxLength(100)),
});

export type SelectionPayload = typeof Selection.Type;

export const Shared = Schema.Struct({ records: History });

export type SharedPayload = typeof Shared.Type;

const reply = (status: number, body: SharedPayload | { error: string }) =>
  Response.json(body, { status });

export const openService = (options: {
  databasePath: string;
  baseURL: string;
  secret: string;
}) =>
  Effect.tryPromise({
    try: async () => {
      if (!URL.canParse(options.baseURL)) {
        throw new ParticipationError({
          reason: "invalid",
          message: "Participation baseURL must be an absolute URL.",
        });
      }

      const { origin } = new URL(options.baseURL);

      if (options.secret.length < 32) {
        throw new ParticipationError({
          reason: "invalid",
          message: "Supply a persistent secret of at least 32 characters.",
        });
      }

      const database = new DatabaseSync(options.databasePath);

      const authOptions = {
        database,
        baseURL: options.baseURL,
        basePath: "/auth",
        secret: options.secret,
        emailAndPassword: { enabled: true },
        session: { cookieCache: { enabled: false } },
        trustedOrigins: [origin],
      };

      try {
        database.exec("PRAGMA busy_timeout=15000; PRAGMA synchronous=FULL;");
        const migrations = await getMigrations(authOptions);
        await migrations.runMigrations();
        database.exec(
          "CREATE TABLE IF NOT EXISTS shared_progress (principal TEXT NOT NULL, receipt_key TEXT NOT NULL, body TEXT NOT NULL, sequence INTEGER PRIMARY KEY, UNIQUE(principal,receipt_key))"
        );
      } catch (error) {
        database.close();
        throw new ParticipationError({
          reason: "storage",
          message: "Could not initialize participation database.",
          cause: error,
        });
      }

      const auth = betterAuth(authOptions);

      const handle = async (request: Request): Promise<Response> => {
        const url = new URL(request.url);

        if (url.pathname.startsWith("/auth/")) {
          return auth.handler(request);
        }

        if (url.pathname !== "/participation/progress") {
          return reply(404, { error: "not-found" });
        }

        if (request.method !== "GET" && request.method !== "POST") {
          return reply(405, { error: "method-not-allowed" });
        }

        if (
          request.method === "POST" &&
          request.headers.get("origin") !== origin
        ) {
          return reply(403, { error: "forbidden" });
        }

        try {
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (session === null) {
            return reply(401, { error: "unauthenticated" });
          }

          const principal = session.user.id;

          if (request.method === "POST") {
            const parsed = await Effect.runPromise(
              Effect.tryPromise({
                try: () => request.json(),
                catch: (cause) =>
                  new ParticipationError({
                    reason: "invalid",
                    message: "Expected JSON selection.",
                    cause,
                  }),
              }).pipe(
                Effect.flatMap((raw) =>
                  Schema.decodeUnknownEffect(Selection)(raw)
                ),
                Effect.result
              )
            );

            if (Result.isFailure(parsed)) {
              return reply(400, { error: "invalid" });
            }

            database.exec("BEGIN IMMEDIATE");

            try {
              for (const record of parsed.success.records) {
                const prior = database
                  .prepare(
                    "SELECT body FROM shared_progress WHERE principal=? AND receipt_key=?"
                  )
                  .get(principal, record.key);

                if (
                  prior &&
                  !isDeepStrictEqual(
                    Schema.decodeUnknownSync(Schema.fromJsonString(Command))(
                      prior.body
                    ),
                    record
                  )
                ) {
                  database.exec("ROLLBACK");

                  return reply(409, { error: "conflict" });
                }

                database
                  .prepare(
                    "INSERT OR IGNORE INTO shared_progress(principal,receipt_key,body) VALUES(?,?,?)"
                  )
                  .run(principal, record.key, JSON.stringify(record));
              }

              database.exec("COMMIT");
            } catch (error) {
              database.exec("ROLLBACK");
              throw error;
            }
          }

          const records = database
            .prepare(
              "SELECT body FROM shared_progress WHERE principal=? ORDER BY sequence"
            )
            .all(principal)
            .map((row) =>
              Schema.decodeUnknownSync(Schema.fromJsonString(Command))(row.body)
            );

          return reply(200, { records });
        } catch {
          return reply(500, { error: "storage" });
        }
      };

      return { auth, handle, close: () => database.close() };
    },
    catch: (cause) =>
      Schema.is(ParticipationError)(cause)
        ? cause
        : new ParticipationError({
            reason: "storage",
            message: "Could not open participation service.",
            cause,
          }),
  });

export type ParticipationService = Effect.Success<
  ReturnType<typeof openService>
>;

export const serve = (
  service: ParticipationService,
  options: { port: number; hostname: string; baseURL: string }
) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const authHandler = toNodeHandler(service.auth);

        const server = createServer(async (incoming, outgoing) => {
          if (incoming.url?.startsWith("/auth/")) {
            await authHandler(incoming, outgoing);

            return;
          }

          try {
            const chunks: Buffer[] = [];
            let length = 0;

            for await (const chunk of incoming) {
              length += chunk.length;

              if (length > 1024 * 1024) {
                outgoing.writeHead(413).end();

                return;
              }

              chunks.push(Buffer.from(chunk));
            }

            const headers = new Headers();

            for (const [key, value] of Object.entries(incoming.headers)) {
              if (Array.isArray(value)) {
                for (const item of value) {
                  headers.append(key, item);
                }
              } else if (value !== undefined) {
                headers.set(key, value);
              }
            }

            const method = incoming.method ?? "GET";

            const init: RequestInit = { method, headers };

            if (method !== "GET" && method !== "HEAD") {
              init.body = Buffer.concat(chunks);
            }

            const response = await service.handle(
              new Request(new URL(incoming.url ?? "/", options.baseURL), init)
            );

            outgoing.writeHead(
              response.status,
              Object.fromEntries(response.headers)
            );
            outgoing.end(await response.text());
          } catch {
            outgoing.writeHead(500).end();
          }
        });

        const listening = once(server, "listening");
        server.listen(options.port, options.hostname);
        await listening;

        return server;
      },
      catch: (cause) =>
        new ParticipationError({
          reason: "transport",
          message: "Could not bind participation HTTP listener.",
          cause,
        }),
    }),
    (server) =>
      Effect.promise(async () => {
        if (server.listening) {
          await promisify(server.close.bind(server))();
        }
      })
  );

export const client = (options: {
  baseURL: string;
  fetch: typeof globalThis.fetch;
}) => {
  const request = (records?: readonly (typeof Command.Type)[]) =>
    Effect.tryPromise({
      try: async () => {
        const init: RequestInit = {
          method: records === undefined ? "GET" : "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            origin: new URL(options.baseURL).origin,
          },
        };

        if (records !== undefined) {
          init.body = JSON.stringify({ records });
        }

        const response = await options.fetch(
          new URL("/participation/progress", options.baseURL),
          init
        );

        if (!response.ok) {
          let reason: ParticipationError["reason"] = "transport";

          switch (response.status) {
            case 401: {
              reason = "unauthenticated";
              break;
            }

            case 403: {
              reason = "forbidden";
              break;
            }

            case 409: {
              reason = "conflict";
              break;
            }

            default: {
              break;
            }
          }

          throw new ParticipationError({
            reason,
            message: `Participation request failed (${response.status}).`,
          });
        }

        // @effect-diagnostics-next-line schemaSyncInEffect:off -- Promise admission is translated to the typed transport error at this boundary.
        return Schema.decodeUnknownSync(Shared)(await response.json()).records;
      },
      catch: (cause) =>
        Schema.is(ParticipationError)(cause)
          ? cause
          : new ParticipationError({
              reason: "transport",
              message: "Could not read participation response.",
              cause,
            }),
    });

  return {
    pull: () => request(),
    syncSelected: (localPath: string, keys: readonly string[]) =>
      resume(localPath).pipe(
        Effect.flatMap((history) => {
          const records = keys.map((key) =>
            history.find((record) => record.key === key)
          );

          if (records.some((record) => record === undefined)) {
            return Effect.fail(
              new ParticipationError({
                reason: "invalid",
                message: "Selection contains a missing local receipt.",
              })
            );
          }

          return request(records.filter((record) => record !== undefined));
        })
      ),
  };
};

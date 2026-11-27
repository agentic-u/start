import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.argv[2]);

db.exec("BEGIN IMMEDIATE");

db.prepare("INSERT INTO receipts(body) VALUES (?)").run("incomplete");

process.stdout.write("uncommitted");

setInterval(() => process.stdout.write("waiting"), 1000);

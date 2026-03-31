#!/usr/bin/env node

import { Command } from "commander";

import { runBackupFullCommand } from "./commands/backup-full.js";
import { runBackupSyncCommand } from "./commands/backup-sync.js";
import { runLoginCommand } from "./commands/login.js";
import { runVerifyCommand } from "./commands/verify.js";

const program = new Command();

program.name("classroom-backup").description("Google Classroom student backup CLI").version("0.1.0");

program
  .command("login")
  .description("Authenticate with Google and register the OAuth client")
  .option("--credentials <path>", "Path to installed app OAuth client credentials JSON")
  .option("--out <dir>", "Backup output directory used to resolve related paths", "./backup")
  .action(runLoginCommand);

const backup = program.command("backup").description("Run backup operations");

backup
  .command("full")
  .description("Run a full backup sync")
  .requiredOption("--out <dir>", "Backup output directory")
  .action(runBackupFullCommand);

backup
  .command("sync")
  .description("Run an incremental backup sync")
  .requiredOption("--out <dir>", "Backup output directory")
  .action(runBackupSyncCommand);

program
  .command("verify")
  .description("Verify manifest and saved artifacts")
  .requiredOption("--out <dir>", "Backup output directory")
  .action(runVerifyCommand);

await program.parseAsync(process.argv);

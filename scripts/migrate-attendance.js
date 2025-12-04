#!/usr/bin/env node
/**
 * Migration script to convert attendance.json keys from old format to new format.
 * 
 * Old format for recurring events: {baseId}_{YYYYMMDD}T{HHMMSS}Z
 * New format for recurring events: {baseId}|{YYYY-MM-DD}
 * 
 * Non-recurring event keys remain unchanged.
 * 
 * Usage:
 *   node scripts/migrate-attendance.js <input-file> [output-file] [--timezone=TIMEZONE]
 * 
 * If output-file is not provided, outputs to stdout.
 * Use --dry-run to see what would change without writing.
 * Use --timezone=America/Los_Angeles to convert UTC timestamps to local dates.
 */

const fs = require('fs');
const path = require('path');

// Pattern to match recurring event instance IDs: baseId_YYYYMMDDTHHMMSSZ
const RECURRING_INSTANCE_PATTERN = /^(.+)_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

function migrateKey(oldKey, timezone) {
  const match = oldKey.match(RECURRING_INSTANCE_PATTERN);
  if (match) {
    const [, baseId, year, month, day, hour, minute, second] = match;
    
    // Create a UTC date from the timestamp
    const utcDate = new Date(Date.UTC(
      parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(minute), parseInt(second)
    ));
    
    // Convert to the target timezone to get the local date
    const localDateStr = utcDate.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD format
    
    const newKey = `${baseId}|${localDateStr}`;
    return { newKey, changed: true, baseId, date: localDateStr, utcDate: utcDate.toISOString() };
  }
  return { newKey: oldKey, changed: false };
}

function migrateAttendance(data, timezone) {
  const migrated = {};
  const changes = [];

  for (const [oldKey, value] of Object.entries(data)) {
    const { newKey, changed, baseId, date, utcDate } = migrateKey(oldKey, timezone);
    
    if (changed) {
      changes.push({ oldKey, newKey, baseId, date, utcDate, attendeeCount: Object.keys(value).length });
    }

    // If the new key already exists, merge the attendance data
    // (prefer the more recent timestamp for each user)
    if (migrated[newKey]) {
      for (const [userId, attendanceInfo] of Object.entries(value)) {
        const existing = migrated[newKey][userId];
        if (!existing || new Date(attendanceInfo.timestamp) > new Date(existing.timestamp)) {
          migrated[newKey][userId] = attendanceInfo;
        }
      }
    } else {
      migrated[newKey] = { ...value };
    }
  }

  return { migrated, changes };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const timezoneArg = args.find(arg => arg.startsWith('--timezone='));
  const timezone = timezoneArg ? timezoneArg.split('=')[1] : 'America/Los_Angeles';
  const filteredArgs = args.filter(arg => arg !== '--dry-run' && !arg.startsWith('--timezone='));

  if (filteredArgs.length < 1) {
    console.error('Usage: node scripts/migrate-attendance.js <input-file> [output-file] [--timezone=TIMEZONE] [--dry-run]');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/migrate-attendance.js attendance.json                                    # Output to stdout');
    console.error('  node scripts/migrate-attendance.js attendance.json migrated.json                      # Output to file');
    console.error('  node scripts/migrate-attendance.js attendance.json --dry-run                          # Show changes only');
    console.error('  node scripts/migrate-attendance.js attendance.json --timezone=America/Los_Angeles     # With timezone');
    console.error('');
    console.error('Default timezone: America/Los_Angeles');
    process.exit(1);
  }

  const inputFile = filteredArgs[0];
  const outputFile = filteredArgs[1];
  
  console.error(`Using timezone: ${timezone}`);

  // Read input file
  let data;
  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error reading input file: ${error.message}`);
    process.exit(1);
  }

  // Perform migration
  const { migrated, changes } = migrateAttendance(data, timezone);

  // Report changes
  console.error(`\n=== Migration Summary ===`);
  console.error(`Total keys in input: ${Object.keys(data).length}`);
  console.error(`Total keys in output: ${Object.keys(migrated).length}`);
  console.error(`Keys converted: ${changes.length}`);
  console.error('');

  if (changes.length > 0) {
    console.error('Converted keys:');
    for (const change of changes) {
      console.error(`  ${change.oldKey}`);
      console.error(`    -> ${change.newKey}`);
      console.error(`    (UTC: ${change.utcDate}, ${change.attendeeCount} attendee(s))`);
      console.error('');
    }
  } else {
    console.error('No recurring event instances found to convert.');
  }

  if (dryRun) {
    console.error('Dry run - no files written.');
    return;
  }

  // Output result
  const output = JSON.stringify(migrated, null, 2);
  
  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf-8');
    console.error(`Migrated data written to: ${outputFile}`);
  } else {
    console.log(output);
  }
}

main();


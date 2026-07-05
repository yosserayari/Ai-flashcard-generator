import { NextResponse } from "next/server";
import path from "path";
import * as fflate from "fflate";
import initSqlJs from 'sql.js';// Force the Node.js runtime — sql.js needs to load its .wasm file from disk.
export const runtime = "nodejs";

interface CardInput {
  question: string;
  answer: string;
}

function isValidCards(value: unknown): value is CardInput[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as any).question === "string" &&
        typeof (c as any).answer === "string" &&
        (c as any).question.trim() &&
        (c as any).answer.trim()
    )
  );
}

function randomGuid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Escape a field for safe insertion into the flds/sfld text (Anki uses raw HTML fields).
function esc(s: string): string {
  return s.replace(/\x1f/g, " ");
}

export async function POST(req: Request) {
  try {
    const { cards, title } = await req.json();

    if (!isValidCards(cards)) {
      return NextResponse.json({ error: "No valid cards provided." }, { status: 400 });
    }

    const deckTitle = (typeof title === "string" && title.trim()) || "Flashcard deck";

    // sql.js needs to find its .wasm file on disk — resolve relative to the
    // installed package rather than process.cwd(), so it works regardless of
    // where the Next.js server process is actually run from.
    const sqlJsDir = path.join(process.cwd(), "node_modules", "sql.js", "dist");
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(sqlJsDir, file),
    });

    const db = new SQL.Database();

    db.run(`
      CREATE TABLE col (
        id integer primary key,
        crt integer not null,
        mod integer not null,
        scm integer not null,
        ver integer not null,
        dty integer not null,
        usn integer not null,
        ls integer not null,
        conf text not null,
        models text not null,
        decks text not null,
        dconf text not null,
        tags text not null
      );
      CREATE TABLE notes (
        id integer primary key,
        guid text not null,
        mid integer not null,
        mod integer not null,
        usn integer not null,
        tags text not null,
        flds text not null,
        sfld text not null,
        csum integer not null,
        flags integer not null,
        data text not null
      );
      CREATE TABLE cards (
        id integer primary key,
        nid integer not null,
        did integer not null,
        ord integer not null,
        mod integer not null,
        usn integer not null,
        type integer not null,
        queue integer not null,
        due integer not null,
        ivl integer not null,
        factor integer not null,
        reps integer not null,
        lapses integer not null,
        left integer not null,
        odue integer not null,
        odid integer not null,
        flags integer not null,
        data text not null
      );
      CREATE TABLE revlog (
        id integer primary key,
        cid integer not null,
        usn integer not null,
        ease integer not null,
        ivl integer not null,
        lastIvl integer not null,
        factor integer not null,
        time integer not null,
        type integer not null
      );
      CREATE TABLE graves (
        usn integer not null,
        oid integer not null,
        type integer not null
      );
      CREATE INDEX ix_notes_usn on notes (usn);
      CREATE INDEX ix_cards_usn on cards (usn);
      CREATE INDEX ix_revlog_usn on revlog (usn);
      CREATE INDEX ix_cards_nid on cards (nid);
      CREATE INDEX ix_cards_sched on cards (did, queue, due);
      CREATE INDEX ix_revlog_cid on revlog (cid);
      CREATE INDEX ix_notes_mid on notes (mid);
    `);

    const nowSec = Math.floor(Date.now() / 1000);
    const MODEL_ID = 1;
    const DECK_ID = 1;

    const models = {
      [MODEL_ID]: {
        id: MODEL_ID,
        name: "Basic",
        type: 0,
        mod: nowSec,
        usn: 0,
        sortf: 0,
        did: DECK_ID,
        tmpls: [
          {
            name: "Card 1",
            ord: 0,
            qfmt: "{{Front}}",
            afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
            did: null,
            bqfmt: "",
            bafmt: "",
          },
        ],
        flds: [
          { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
          { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 },
        ],
        css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
        latexPre: "\\documentclass[12pt]{article}\\special{papersize=3in,5in}\\usepackage{amssymb,amsmath}\\pagestyle{empty}\\setlength{\\parindent}{0in}\\begin{document}",
        latexPost: "\\end{document}",
        req: [[0, "any", [0]]],
      },
    };

    const decks = {
      [DECK_ID]: {
        id: DECK_ID,
        name: deckTitle,
        extendRev: 50,
        extendNew: 10,
        collapsed: false,
        browserCollapsed: false,
        desc: "",
        dyn: 0,
        conf: 1,
        usn: 0,
        mod: nowSec,
        lrnToday: [0, 0],
        revToday: [0, 0],
        newToday: [0, 0],
        timeToday: [0, 0],
      },
    };

    const dconf = {
      1: {
        id: 1,
        name: "Default",
        new: { perDay: 20, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, separate: true },
        rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500 },
        lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 },
        maxTaken: 60,
        timer: 0,
        autoplay: true,
        replayq: true,
        mod: nowSec,
        usn: 0,
      },
    };

    db.run(
      `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
       VALUES (1, ?, ?, ?, 11, 0, 0, 0, '{}', ?, ?, ?, '{}')`,
      [nowSec, nowSec * 1000, nowSec * 1000, JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf)]
    );

    let noteId = Date.now();
    let cardId = Date.now() + 1;

    cards.forEach((card, index) => {
      const front = esc(card.question.replace(/\n/g, "<br>"));
      const back = esc(card.answer.replace(/\n/g, "<br>"));
      const flds = `${front}\x1f${back}`;
      const guid = randomGuid();

      db.run(
        `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
         VALUES (?, ?, ?, ?, -1, '', ?, ?, 0, 0, '')`,
        [noteId, guid, MODEL_ID, nowSec, flds, front]
      );

      db.run(
        `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
         VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
        [cardId, noteId, DECK_ID, nowSec, index + 1]
      );

      noteId += 1;
      cardId += 1;
    });

    const sqliteBytes = db.export();
    db.close();

    const zipped = fflate.zipSync({
      "collection.anki2": sqliteBytes,
      media: fflate.strToU8("{}"),
    });

    const buffer = Buffer.from(zipped);
    const safeTitle =
      deckTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "deck";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeTitle}.apkg"`,
      },
    });
  } catch (err: any) {
    console.error("Anki export route error:", err);
    return NextResponse.json({ error: "Failed to build the Anki file." }, { status: 500 });
  }
}
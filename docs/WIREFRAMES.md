# Vikings Master PDF — UI Wireframes

Fluent-inspired, Windows 11 aesthetic. Frameless window with custom title bar.

## Main Window

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⛨ Vikings Master PDF   [💾][↶][↷][🖨]      contract-2026.pdf      ─  ▢  ✕   │ ← Title bar + QAT
├──────────────────────────────────────────────────────────────────────────────┤
│ Home  Edit  Review  Forms  Protect  Convert  OCR  Organize  eSign  View      │ ← Ribbon tabs
│       Tools  Help                                              [🔍][🌙][⚙]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐┌─────────┐┌──────────────┐┌───────────────┐┌──────────────────┐ │
│ │  Open   ││  Save   ││  Hand  Select││ Zoom  − 100% +││ Find   AI Assist │ │ ← Ribbon groups
│ │  📂     ││  💾     ││  ✋     ⬚   ││  🔍−  ▭  🔍+ ││  🔎     ✨       │ │   (per active tab)
│ └─Open────┘└─Save────┘└─Navigate─────┘└─Zoom──────────┘└─Find─────────────┘ │
├───┬──────────────────────────────────────────────────────────────────┬──────┤
│ ▤ │ ┌──────────── contract-2026.pdf ─┬─ report.pdf ─┬─ + ──────────┐ │  ⚙   │
│ ▥ │ └────────────────────────────────┴──────────────┴──────────────┘ │  𝑨   │
│ 📎│  ┌────────────────────────────────────────────────────────────┐  │  🔍  │
│ ◫ │  │                                                            │  │  ✨  │
│ 💬│  │                 ┌───────────────────────┐                  │  │      │
│   │  │                 │                       │                  │  │ Right│
│ L │  │                 │      PDF PAGE 1       │                  │  │ rail │
│ e │  │                 │   (canvas + layers)   │                  │  │ opens│
│ f │  │                 │                       │                  │  │ panel│
│ t │  │                 └───────────────────────┘                  │  │      │
│   │  │                 ┌───────────────────────┐                  │  │      │
│ r │  │                 │      PDF PAGE 2       │                  │  │      │
│ a │  │                 └───────────────────────┘                  │  │      │
│ i │  └────────────────────────────────────────────────────────────┘  │      │
│ l │   Left panel (Thumbnails/Bookmarks/Attachments/Layers/Comments)  │      │
├───┴──────────────────────────────────────────────────────────────────┴──────┤
│ Page 1 / 24   ◀ ▶   | 100% ─────●───── | OCR: Ready | 🔒 Not Encrypted | ✓  │ ← Status bar
└──────────────────────────────────────────────────────────────────────────────┘
```

## Backstage (Home ▸ File)

```
┌──────────────────────────────────────────────────────────────────┐
│ ←  Vikings Master PDF                                            │
│ ┌──────────┐  ┌─────────────────────────────────────────────┐   │
│ │ New      │  │  Recent                       Pinned ▾      │   │
│ │ Open     │  │  ┌────┐ contract-2026.pdf    📌 brief.pdf   │   │
│ │ Save     │  │  │thumb│ ~/Documents · 2 MB                 │   │
│ │ Save As  │  │  └────┘ Yesterday 14:02                     │   │
│ │ Export ▸ │  │  ┌────┐ invoice-0142.pdf                    │   │
│ │ Print    │  │  │thumb│ ~/Downloads · 410 KB               │   │
│ │ Share    │  │  └────┘ Tue 09:15                           │   │
│ │ ──────── │  │                                             │   │
│ │ Templates│  │  Templates: Blank · Letterhead · Invoice ·  │   │
│ │ Settings │  │  Form Starter                               │   │
│ └──────────┘  └─────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Organize Mode (page grid)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Insert ▾][Delete][Duplicate][Rotate ⟲ ⟳][Extract][Split][Merge] │
│ ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐                  │
│ │ 1  │  │ 2  │  │ 3✔ │  │ 4✔ │  │ 5  │  │ 6  │   ← multiselect, │
│ └────┘  └────┘  └────┘  └────┘  └────┘  └────┘     drag to      │
│ ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐     reorder      │
│ │ 7  │  │ 8  │  │ 9  │  │ 10 │  │ 11 │  │ 12 │                  │
│ └────┘  └────┘  └────┘  └────┘  └────┘  └────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

## Dialog pattern (e.g. Watermark)

```
┌───────────── Add Watermark ─────────────┐
│ Type      (•) Text   ( ) Image          │
│ Text      [ CONFIDENTIAL            ]   │
│ Font      [Helvetica ▾]  Size [48  ▾]   │
│ Color     [■ #d13438]  Opacity [30%──●] │
│ Rotation  [-45° ──●──]                  │
│ Position  ┌─┬─┬─┐  Layer (•) Behind     │
│           ├─┼●┼─┤        ( ) On top     │
│           └─┴─┴─┘  □ Tile entire page   │
│ Pages     (•) All ( ) Range [____]      │
│ ┌─────────────Preview────────────┐      │
│ │        ╲ CONFIDENTIAL ╲        │      │
│ └────────────────────────────────┘      │
│                    [Cancel] [Apply]     │
└─────────────────────────────────────────┘
```

## AI Assistant panel (right rail)

```
┌── AI Assistant ──────────── ⚙ ✕ ┐
│ Provider: Offline engine ▾      │
│ [Summarize][Key points][Actions]│
│ [FAQ]                           │
│ ─────────────────────────────── │
│ 🧑 What are the payment terms?  │
│ ✨ Net-30 from invoice date,    │
│    2% late fee monthly (p. 4).  │
│ ─────────────────────────────── │
│ [Ask about this document…  ][➤] │
└─────────────────────────────────┘
```

Status colors: accent #2563eb (light) / #3b82f6 (dark); danger #d13438; success #107c10.
Spacing grid 4 px; control height 28 px (ribbon), 32 px (dialogs); radius 6 px (Fluent).

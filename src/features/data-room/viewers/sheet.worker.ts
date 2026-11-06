import type { SheetGrid } from "./sheetGrid";
import { Workbook } from "./xlsx";

export interface SheetWorkerRequest {
  /** Echoed on every reply, so one worker can serve many workbooks. */
  id: number;
  buffer: ArrayBuffer;
}

export type SheetWorkerMessage = { id: number } & (
  | { type: "workbook"; sheets: string[]; active: number }
  | { type: "sheet"; index: number; grid: SheetGrid }
  | { type: "error"; index?: number }
);

function post(message: SheetWorkerMessage, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

// The sheet on screen is read first, then the rest, each sent as soon as it's ready.
self.onmessage = (event: MessageEvent<SheetWorkerRequest>) => {
  const { id } = event.data;
  let book: Workbook;
  try {
    book = Workbook.open(new Uint8Array(event.data.buffer));
  } catch {
    post({ id, type: "error" });
    return;
  }
  post({ id, type: "workbook", sheets: book.sheets.map((sheet) => sheet.name), active: book.active });
  const order = [book.active, ...book.sheets.keys()].filter((index, i, all) => index < book.sheets.length && all.indexOf(index) === i);
  for (const index of order) {
    try {
      const grid = book.readSheet(index);
      post({ id, type: "sheet", index, grid }, [grid.flags.buffer, grid.spill.buffer]);
    } catch {
      post({ id, type: "error", index });
    }
  }
};

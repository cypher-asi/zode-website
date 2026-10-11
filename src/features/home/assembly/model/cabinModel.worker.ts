import { cabinBuffers, fetchCabin, type ParsedCabin } from "./cabinParse";

export type CabinWorkerMessage = { ok: true; cabin: ParsedCabin } | { ok: false; error: string };

fetchCabin().then(
  (cabin) => {
    const message: CabinWorkerMessage = { ok: true, cabin };
    self.postMessage(message, { transfer: cabinBuffers(cabin) });
  },
  (error: unknown) => {
    const message: CabinWorkerMessage = { ok: false, error: String(error) };
    self.postMessage(message);
  },
);

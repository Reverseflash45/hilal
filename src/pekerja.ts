/* Web Worker: hisab 514 daerah untuk satu bulan, supaya halaman tidak macet selama menghitung 12 bulan ke depan. */
import { hitungBulan } from "./data";
import type { Ijtimak } from "./hilal";

self.onmessage = (e: MessageEvent<{ id: number; ij: Ijtimak }>) => {
  self.postMessage({ id: e.data.id, hasil: hitungBulan(e.data.ij) });
};

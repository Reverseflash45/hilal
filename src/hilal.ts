/**
 * Hisab hilal: posisi bulan dan matahari saat matahari terbenam setelah ijtimak.
 * Posisi benda langit memakai astronomy-engine (Don Cross, MIT), ketelitian sekitar satu busur menit.
 */
import { AngleFromSun, Body, Equator, Horizon, Illumination, Observer, SearchMoonPhase, SearchRiseSet } from "astronomy-engine";

export const NAMA_BULAN = ["Muharam", "Safar", "Rabiulawal", "Rabiulakhir", "Jumadilawal", "Jumadilakhir", "Rajab", "Syakban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah"];

// Jangkar penamaan bulan: ijtimak 17 Februari 2026 (bersamaan gerhana matahari cincin) mengawali Ramadan 1447 H.
const JANGKAR_MS = Date.UTC(2026, 1, 17, 12, 1);
const JANGKAR_BULAN = 8; // Ramadan
const JANGKAR_TAHUN = 1447;
const SINODIS_HARI = 29.530588853;
const JAM = 3_600_000;
const HARI = 86_400_000;

export type Ijtimak = { waktu: Date; bulan: number; tahun: number };

/** Nama bulan hijriah yang diawali ijtimak ini. */
export function labelIjtimak(waktu: Date): { bulan: number; tahun: number } {
  const k = Math.round((waktu.getTime() - JANGKAR_MS) / (SINODIS_HARI * HARI));
  const urut = JANGKAR_BULAN + k;
  return { bulan: ((urut % 12) + 12) % 12, tahun: JANGKAR_TAHUN + Math.floor(urut / 12) };
}

/** Ijtimak (bulan baru geosentris) berikutnya sejak waktu tertentu, sebanyak n. */
export function daftarIjtimak(dari: Date, n: number): Ijtimak[] {
  const hasil: Ijtimak[] = [];
  let t = dari;
  while (hasil.length < n) {
    const k = SearchMoonPhase(0, t, 40);
    if (!k) break;
    hasil.push({ waktu: k.date, ...labelIjtimak(k.date) });
    t = new Date(k.date.getTime() + 2 * HARI);
  }
  return hasil;
}

export type Hisab = {
  magrib: Date;
  bulanTerbenam: Date | null;
  tinggi: number; // tinggi toposentrik pusat bulan, tanpa refraksi (derajat)
  elongasi: number; // elongasi geosentrik (derajat)
  azBulan: number;
  azMatahari: number;
  umur: number; // jam sejak ijtimak (negatif = sebelum ijtimak)
  lag: number | null; // menit bulan terbenam setelah matahari
  iluminasi: number; // 0–1
};

/** Tanggal kalender (zona tertentu) dari sebuah waktu. */
export function tanggalLokal(waktu: Date, zona: number): { tahun: number; bulan: number; hari: number } {
  const d = new Date(waktu.getTime() + zona * JAM);
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() };
}

/**
 * Hisab saat matahari terbenam pada tanggal setempat tertentu.
 * Kembali null kalau matahari tidak terbenam (tidak terjadi di lintang Indonesia).
 */
export function hisab(lat: number, lon: number, zona: number, tanggal: { tahun: number; bulan: number; hari: number }, ijtimak: Date): Hisab | null {
  const pengamat = new Observer(lat, lon, 0);
  const siang = new Date(Date.UTC(tanggal.tahun, tanggal.bulan - 1, tanggal.hari, 12) - zona * JAM);
  const terbenam = SearchRiseSet(Body.Sun, pengamat, -1, siang, 1);
  if (!terbenam) return null;
  const t = terbenam.date;
  const eqB = Equator(Body.Moon, t, pengamat, true, true);
  const horB = Horizon(t, pengamat, eqB.ra, eqB.dec);
  const eqM = Equator(Body.Sun, t, pengamat, true, true);
  const horM = Horizon(t, pengamat, eqM.ra, eqM.dec);
  // Bulan terbenam pertama sejak tiga jam sebelum magrib: bisa sebelum magrib (lag negatif).
  const bt = SearchRiseSet(Body.Moon, pengamat, -1, new Date(t.getTime() - 3 * JAM), 1);
  return {
    magrib: t,
    bulanTerbenam: bt ? bt.date : null,
    tinggi: horB.altitude,
    elongasi: AngleFromSun(Body.Moon, t),
    azBulan: horB.azimuth,
    azMatahari: horM.azimuth,
    umur: (t.getTime() - ijtimak.getTime()) / JAM,
    lag: bt ? (bt.date.getTime() - t.getTime()) / 60_000 : null,
    iluminasi: Illumination(Body.Moon, t).phase_fraction,
  };
}

/* ---------- kriteria ---------- */
/** Kriteria baru MABIMS (dipakai Indonesia sejak 2022): tinggi hilal minimal 3° dan elongasi minimal 6,4°. */
export const MABIMS = { tinggi: 3, elongasi: 6.4 };
export const memenuhiMabims = (h: Hisab) => h.umur > 0 && h.tinggi >= MABIMS.tinggi && h.elongasi >= MABIMS.elongasi;
/** Wujudul hilal: ijtimak sebelum matahari terbenam dan bulan terbenam sesudah matahari. */
export const memenuhiWujud = (h: Hisab) => h.umur > 0 && h.lag != null && h.lag > 0;

export const tambahHari = (t: { tahun: number; bulan: number; hari: number }, n: number) => {
  const d = new Date(Date.UTC(t.tahun, t.bulan - 1, t.hari + n));
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() };
};

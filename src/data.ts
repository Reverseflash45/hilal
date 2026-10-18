import dataDaerah from "./data/daerah.json";
import { type Hisab, type Ijtimak, hisab, memenuhiMabims, memenuhiWujud, tambahHari, tanggalLokal } from "./hilal";

export type Daerah = (typeof dataDaerah.daerah)[number];
export const DAERAH: readonly Daerah[] = dataDaerah.daerah;

/* ---------- zona waktu ---------- */
const WITA = new Set([
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Gorontalo",
  "Sulawesi Tengah",
  "Sulawesi Barat",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
]);
const WIT = new Set(["Maluku", "Maluku Utara", "Papua", "Papua Barat", "Papua Barat Daya", "Papua Tengah", "Papua Pegunungan", "Papua Selatan"]);
export const zona = (d: Daerah) => (WIT.has(d.prov) ? 9 : WITA.has(d.prov) ? 8 : 7);
export const namaZona = (z: number) => (z === 9 ? "WIT" : z === 8 ? "WITA" : "WIB");
export const lat = (d: Daerah) => d.titik[1];
export const lon = (d: Daerah) => d.titik[0];

export type Tanggal = { tahun: number; bulan: number; hari: number };

/* ---------- hisab satu bulan untuk seluruh Indonesia ---------- */
export type HasilBulan = {
  ij: Ijtimak;
  /** Tanggal magrib pengamatan (sama untuk seluruh Indonesia, mengikuti tanggal WIB). */
  pengamatan: Tanggal;
  /** Ijtimak terjadi setelah magrib di Jawa, jadi pengamatan digeser ke magrib berikutnya. */
  setelahMagrib: boolean;
  per: Map<string, Hisab>;
  tertinggi: { d: Daerah; h: Hisab };
  mabims: number;
  wujud: number;
  /** Perkiraan tanggal 1: sehari setelah pengamatan bila kriteria terpenuhi di salah satu daerah, selain itu dua hari. */
  awalMabims: Tanggal;
  awalWujud: Tanggal;
};

const tembolok = new Map<number, HasilBulan>();

export function hitungBulan(ij: Ijtimak): HasilBulan {
  const kunci = ij.waktu.getTime();
  const ada = tembolok.get(kunci);
  if (ada) return ada;
  const wib = new Date(kunci + 7 * 3_600_000);
  const setelahMagrib = wib.getUTCHours() >= 18;
  const pengamatan = setelahMagrib ? tambahHari(tanggalLokal(ij.waktu, 7), 1) : tanggalLokal(ij.waktu, 7);
  const per = new Map<string, Hisab>();
  let tertinggi: { d: Daerah; h: Hisab } | null = null;
  let mabims = 0;
  let wujud = 0;
  for (const d of DAERAH) {
    const h = hisab(lat(d), lon(d), zona(d), pengamatan, ij.waktu);
    if (!h) continue;
    per.set(d.id, h);
    if (!tertinggi || h.tinggi > tertinggi.h.tinggi) tertinggi = { d, h };
    if (memenuhiMabims(h)) mabims++;
    if (memenuhiWujud(h)) wujud++;
  }
  const hasil: HasilBulan = {
    ij,
    pengamatan,
    setelahMagrib,
    per,
    tertinggi: tertinggi!,
    mabims,
    wujud,
    awalMabims: tambahHari(pengamatan, mabims > 0 ? 1 : 2),
    awalWujud: tambahHari(pengamatan, wujud > 0 ? 1 : 2),
  };
  tembolok.set(kunci, hasil);
  return hasil;
}

/* ---------- teks ---------- */
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const namaHari = (t: Tanggal) => HARI_NAMA[new Date(Date.UTC(t.tahun, t.bulan - 1, t.hari)).getUTCDay()];
export const teksTanggal = (t: Tanggal, hari = false) => `${hari ? `${namaHari(t)}, ` : ""}${t.hari} ${BULAN[t.bulan - 1]} ${t.tahun}`;
export const teksTanggalPendek = (t: Tanggal) => `${t.hari} ${BULAN_PENDEK[t.bulan - 1]} ${t.tahun}`;
export const samaTanggal = (a: Tanggal, b: Tanggal) => a.tahun === b.tahun && a.bulan === b.bulan && a.hari === b.hari;

/** Jam setempat dari sebuah waktu: "18.07". */
export function teksJam(w: Date, z: number): string {
  const d = new Date(w.getTime() + z * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
export const derajat = (x: number, d = 2) => `${x.toFixed(d).replace(".", ",").replace(/^-/, "−")}°`;
export function teksUmur(jam: number): string {
  if (jam < 0) return "belum ijtimak";
  const j = Math.floor(jam);
  return `${j} jam ${Math.round((jam - j) * 60)} menit`;
}
export const teksLag = (m: number | null) => (m == null ? "—" : m >= 0 ? `${Math.round(m)} menit setelah matahari` : `${Math.round(-m)} menit sebelum matahari`);

/* ---------- cari ---------- */
export const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(kabupaten|kab\.?|kota)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function cariDaerah(q: string, batas = 8): Daerah[] {
  const k = normal(q);
  if (!k) return [];
  const nilai = (d: Daerah) => {
    const n = normal(d.nama);
    return n === k ? 0 : n.startsWith(k) ? 1 : n.includes(k) ? 2 : normal(d.prov).includes(k) ? 3 : 9;
  };
  return DAERAH.map((d) => [d, nilai(d)] as const)
    .filter(([, v]) => v < 9)
    .sort((a, b) => a[1] - b[1] || a[0].nama.localeCompare(b[0].nama))
    .slice(0, batas)
    .map(([d]) => d);
}

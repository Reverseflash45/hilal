import { describe, expect, it } from "vitest";
import { DAERAH, hitungBulan, lat, lon, zona } from "./data";
import { NAMA_BULAN, daftarIjtimak, hisab, labelIjtimak, tanggalLokal } from "./hilal";

const bulan = (dari: string) => hitungBulan(daftarIjtimak(new Date(dari), 1)[0]);
const tgl = (s: string) => {
  const [tahun, b, hari] = s.split("-").map(Number);
  return { tahun, bulan: b, hari };
};

describe("ijtimak dan nama bulan", () => {
  it("ijtimak 17 Februari 2026 mengawali Ramadan 1447", () => {
    const [ij] = daftarIjtimak(new Date("2026-02-10"), 1);
    expect(tanggalLokal(ij.waktu, 7)).toEqual(tgl("2026-02-17"));
    expect(NAMA_BULAN[ij.bulan]).toBe("Ramadan");
    expect(ij.tahun).toBe(1447);
  });

  it("penamaan mundur dan maju melintasi pergantian tahun hijriah", () => {
    expect(labelIjtimak(new Date("2023-04-20T04:13Z"))).toEqual({ bulan: 9, tahun: 1444 }); // Syawal 1444
    expect(labelIjtimak(new Date("2026-06-15T00:00Z"))).toEqual({ bulan: 0, tahun: 1448 }); // Muharam 1448
  });

  it("ijtimak berurutan berjarak satu bulan sinodis", () => {
    const d = daftarIjtimak(new Date("2026-01-01"), 13);
    for (let i = 1; i < d.length; i++) {
      const hari = (d[i].waktu.getTime() - d[i - 1].waktu.getTime()) / 86_400_000;
      expect(hari).toBeGreaterThan(29.2);
      expect(hari).toBeLessThan(29.9);
      expect(d[i].bulan).toBe((d[i - 1].bulan + 1) % 12);
    }
  });
});

describe("cocok dengan penetapan yang sudah terjadi", () => {
  it("Ramadan 1444 (2023): hilal tinggi, serentak 23 Maret", () => {
    const h = bulan("2023-03-15");
    expect(h.tertinggi.h.tinggi).toBeGreaterThan(6);
    expect(h.awalMabims).toEqual(tgl("2023-03-23"));
    expect(h.awalWujud).toEqual(tgl("2023-03-23"));
  });

  it("Syawal 1444 (2023): di bawah 3°, berbeda 21 dan 22 April", () => {
    const h = bulan("2023-04-15");
    expect(h.tertinggi.h.tinggi).toBeGreaterThan(0);
    expect(h.tertinggi.h.tinggi).toBeLessThan(3);
    expect(h.mabims).toBe(0);
    expect(h.awalWujud).toEqual(tgl("2023-04-21"));
    expect(h.awalMabims).toEqual(tgl("2023-04-22"));
  });

  it("Zulhijah 1444 (2023): berbeda, Iduladha 28 dan 29 Juni", () => {
    const h = bulan("2023-06-12");
    expect(h.awalWujud).toEqual(tgl("2023-06-19"));
    expect(h.awalMabims).toEqual(tgl("2023-06-20"));
  });

  it("Ramadan 1445 (2024): hilal di bawah 1°, berbeda 11 dan 12 Maret", () => {
    const h = bulan("2024-03-05");
    expect(h.tertinggi.h.tinggi).toBeLessThan(1);
    expect(h.awalWujud).toEqual(tgl("2024-03-11"));
    expect(h.awalMabims).toEqual(tgl("2024-03-12"));
  });

  it("Syawal 1445 (2024): serentak 10 April", () => {
    const h = bulan("2024-04-05");
    expect(h.awalMabims).toEqual(tgl("2024-04-10"));
    expect(h.awalWujud).toEqual(tgl("2024-04-10"));
  });
});

describe("hisab satu tempat", () => {
  it("magrib Jakarta sekitar pukul 18 WIB dan bulan di barat", () => {
    const jkt = DAERAH.find((d) => d.id === "kota-jakarta-pusat")!;
    const [ij] = daftarIjtimak(new Date("2024-04-05"), 1);
    const h = hisab(lat(jkt), lon(jkt), zona(jkt), tgl("2024-04-09"), ij.waktu)!;
    const jam = (h.magrib.getUTCHours() + 7) % 24;
    expect(jam).toBe(17);
    expect(h.azBulan).toBeGreaterThan(240);
    expect(h.azBulan).toBeLessThan(300);
    expect(h.umur).toBeGreaterThan(15);
    expect(h.lag).toBeGreaterThan(20);
  });

  it("ijtimak setelah magrib menggeser pengamatan ke magrib berikutnya", () => {
    const h = bulan("2027-02-01"); // Ramadan 1448, ijtimak 6 Feb 2027 malam
    expect(h.setelahMagrib).toBe(true);
    expect(h.pengamatan).toEqual(tgl("2027-02-07"));
  });
});

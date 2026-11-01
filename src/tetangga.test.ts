import { describe, expect, it } from "vitest";
import daerahJson from "./data/daerah.json";
import { htmlTetangga, tautanTetangga } from "./tetangga";

const SENDIRI = "hilal";
const DAERAH = (daerahJson as { daerah: { id: string }[] }).daerah;

describe("tautan ke proyek lain", () => {
  it("menautkan delapan proyek lain dengan id daerah yang sama, tanpa diri sendiri", () => {
    const t = tautanTetangga("kota-bandung", SENDIRI);
    expect(t).toHaveLength(8);
    expect(t.some((x) => x.href.includes(`//${SENDIRI}`))).toBe(false);
    expect(t.every((x) => x.href.endsWith("=kota-bandung"))).toBe(true);
  });

  it("514 id daerah di proyek ini berupa slug kab-/kota- yang aman di URL", () => {
    expect(DAERAH).toHaveLength(514);
    for (const d of DAERAH) expect(d.id).toMatch(/^(kab|kota)-[a-z0-9-]+$/);
  });

  it("menyusun satu kalimat dengan 'dan' sebelum tautan terakhir dan meloloskan nama", () => {
    const h = htmlTetangga("kota-bandung", "Kota <Bandung>", SENDIRI);
    expect(h).toContain("Kota &lt;Bandung&gt;");
    expect(h).toMatch(/, dan <a [^>]+>[^<]+<\/a>\.<\/p>$/);
  });
});

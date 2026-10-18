import type { FeatureCollection, Geometry, MultiLineString } from "geojson";
import { geoMercator, geoPath } from "d3-geo";
import { scaleLinear } from "d3-scale";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Hisab } from "./hilal";
import { MABIMS } from "./hilal";
import { derajat } from "./data";

/* ---------- umum ---------- */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function buatTip(wadah: HTMLElement) {
  const el = document.createElement("div");
  el.className = "tip";
  el.hidden = true;
  wadah.append(el);
  return {
    tampil(x: number, y: number, html: string) {
      el.innerHTML = html;
      el.hidden = false;
      const w = el.offsetWidth;
      const kiri = x + 14 + w > wadah.clientWidth ? x - 14 - w : x + 14;
      el.style.left = `${Math.max(0, kiri)}px`;
      el.style.top = `${Math.max(0, y - el.offsetHeight - 10)}px`;
    },
    sembunyi() {
      el.hidden = true;
    },
  };
}

/* ---------- skala warna ---------- */
export type Ukuran = "tinggi" | "elongasi";

/** Tinggi: divergen di 0° (biru di bawah ufuk, emas di atas). Elongasi: urut satu rona emas. */
export function skalaWarna(ukuran: Ukuran) {
  const v = (n: string) => cssVar(n);
  if (ukuran === "tinggi")
    return scaleLinear<string>()
      .domain([-8, -4, -1, 0, 1, MABIMS.tinggi, 8])
      .range([v("--biru-3"), v("--biru-2"), v("--biru-1"), v("--netral"), v("--emas-1"), v("--emas-2"), v("--emas-3")])
      .clamp(true);
  return scaleLinear<string>()
    .domain([0, 3, MABIMS.elongasi, 12])
    .range([v("--netral"), v("--emas-1"), v("--emas-2"), v("--emas-3")])
    .clamp(true);
}

export function gambarLegenda(wadah: HTMLElement, ukuran: Ukuran): void {
  const skala = skalaWarna(ukuran);
  const [a, b] = ukuran === "tinggi" ? [-8, 8] : [0, 12];
  const henti = Array.from({ length: 17 }, (_, i) => {
    const x = a + ((b - a) * i) / 16;
    return `${skala(x)} ${(i / 16) * 100}%`;
  });
  const tanda = (ukuran === "tinggi" ? [-8, 0, MABIMS.tinggi, 8] : [0, MABIMS.elongasi, 12]).map(
    (x) => `<span style="left:${((x - a) / (b - a)) * 100}%">${x === MABIMS.tinggi && ukuran === "tinggi" ? "3° MABIMS" : x === MABIMS.elongasi && ukuran === "elongasi" ? "6,4° MABIMS" : `${x > 0 && ukuran === "tinggi" ? "+" : ""}${derajat(x, 0)}`}</span>`,
  );
  wadah.innerHTML = `<div class="gradasi" style="background:linear-gradient(90deg,${henti.join(",")})"></div><div class="tanda">${tanda.join("")}</div>`;
}

/* ---------- peta ---------- */
type Prop = { id: string };
export type Peta = { darat: FeatureCollection<Geometry, Prop>; batas: MultiLineString };

export async function muatPeta(): Promise<Peta> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/peta.json`);
  const topo = (await r.json()) as Topology<{ daerah: GeometryCollection<Prop> }>;
  return {
    darat: feature(topo, topo.objects.daerah) as FeatureCollection<Geometry, Prop>,
    batas: mesh(topo, topo.objects.daerah, (a, b) => a !== b) as MultiLineString,
  };
}

export function gambarPeta(
  wadah: HTMLElement,
  peta: Peta,
  per: Map<string, Hisab>,
  ukuran: Ukuran,
  teks: (id: string) => string,
  terpilih: string,
  pilih: (id: string) => void,
): void {
  const lebar = Math.max(300, wadah.clientWidth);
  const tepi = lebar < 560 ? 8 : 16;
  const proyeksi = geoMercator().fitWidth(lebar - 2 * tepi, peta.darat);
  const [[x0, y0], [, y1]] = geoPath(proyeksi).bounds(peta.darat);
  const [tx, ty] = proyeksi.translate();
  proyeksi.translate([tx - x0 + tepi, ty - y0 + tepi]);
  const tinggi = Math.ceil(y1 - y0 + 2 * tepi);
  const jalur = geoPath(proyeksi);
  const skala = skalaWarna(ukuran);
  const pilihan = peta.darat.features.find((f) => f.properties.id === terpilih);
  const pusat = pilihan ? jalur.centroid(pilihan) : null;
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}">
    <g>${peta.darat.features
      .map((f) => {
        const h = per.get(f.properties.id);
        return `<path class="wilayah" data-id="${f.properties.id}" d="${jalur(f) ?? ""}" fill="${h ? skala(ukuran === "tinggi" ? h.tinggi : h.elongasi) : "var(--netral)"}"/>`;
      })
      .join("")}</g>
    <path class="batas" d="${jalur(peta.batas) ?? ""}"/>
    ${pilihan ? `<path class="terpilih" d="${jalur(pilihan) ?? ""}"/>` : ""}
    ${pusat ? `<circle class="penanda" cx="${pusat[0]}" cy="${pusat[1]}" r="5"/>` : ""}
  </svg>`;
  const svg = wadah.querySelector("svg")!;
  const tip = buatTip(wadah);
  svg.addEventListener("pointermove", (e) => {
    const el = (e.target as Element).closest<SVGPathElement>("path.wilayah");
    if (!el) return tip.sembunyi();
    const kotak = svg.getBoundingClientRect();
    tip.tampil(e.clientX - kotak.left, e.clientY - kotak.top, teks(el.dataset.id!));
  });
  svg.addEventListener("pointerleave", () => tip.sembunyi());
  svg.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<SVGPathElement>("path.wilayah");
    if (el) pilih(el.dataset.id!);
  });
}

/* ---------- langit barat saat magrib ---------- */
/**
 * Sabit bulan berpusat di (cx, cy) dengan jari-jari r, sisi terang menghadap sudut `arah` (radian, layar),
 * dan bagian terang `k` (0–1).
 */
function sabit(cx: number, cy: number, r: number, arah: number, k: number): string {
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * k));
  // Busur luar: setengah lingkaran di sisi matahari; terminator: setengah elips.
  const p = `M0,${-r} A${r},${r} 0 0 1 0,${r} A${rx.toFixed(2)},${r} 0 0 ${k < 0.5 ? 0 : 1} 0,${-r}Z`;
  return `<path class="sabit" d="${p}" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${((arah * 180) / Math.PI).toFixed(1)})"/>`;
}

export function gambarLangit(wadah: HTMLElement, h: Hisab, besok: Hisab | null): void {
  const lebar = Math.max(300, wadah.clientWidth);
  const hp = lebar < 520;
  const tinggiSvg = hp ? 280 : 330;
  const ruangBawah = 46;
  // Jendela azimut di sekitar matahari dan bulan, skala derajat yang sama untuk kedua sumbu.
  const azPusat = (h.azMatahari + h.azBulan) / 2;
  const tinggiAtas = Math.max(10, h.tinggi + 4, besok ? besok.tinggi + 4 : 0);
  const tinggiBawah = -1.5;
  const pxPerDerajat = (tinggiSvg - ruangBawah) / (tinggiAtas - tinggiBawah);
  const lebarDerajat = lebar / pxPerDerajat;
  const x = (az: number) => lebar / 2 + (az - azPusat) * pxPerDerajat;
  const y = (alt: number) => (tinggiAtas - alt) * pxPerDerajat;
  const ufuk = y(0);
  const r = hp ? 9 : 11;
  const sudut = (dari: Hisab) => Math.atan2(y(-0.83) - y(dari.tinggi), x(dari.azMatahari) - x(dari.azBulan));
  const garisAz: string[] = [];
  const labelAz: string[] = [];
  for (let az = Math.ceil((azPusat - lebarDerajat / 2) / 5) * 5; az <= azPusat + lebarDerajat / 2; az += 5) {
    garisAz.push(`<line class="kisi-langit" x1="${x(az)}" x2="${x(az)}" y1="0" y2="${ufuk}"/>`);
    labelAz.push(`<text class="sumbu terang" x="${x(az)}" y="${ufuk + 16}" text-anchor="middle">${az}°</text>`);
  }
  // Sabit sebenarnya hanya selebar rambut; tebalnya diperbesar enam kali supaya terlihat.
  const tebal = (k: Hisab) => Math.min(0.45, Math.max(0.12, k.iluminasi * 12));
  const kisiAlt = [5, 10, 15, 20]
    .filter((a) => a < tinggiAtas)
    .map((a) => `<line class="kisi-langit" x1="0" x2="${lebar}" y1="${y(a)}" y2="${y(a)}"/><text class="sumbu terang" x="6" y="${y(a) - 4}">${a}°</text>`)
    .join("");
  const bulanDiAtas = h.tinggi > 0;
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggiSvg}" width="${lebar}" height="${tinggiSvg}">
    <defs>
      <linearGradient id="senja" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--langit-atas)"/><stop offset="0.7" stop-color="var(--langit-tengah)"/><stop offset="1" stop-color="var(--langit-ufuk)"/>
      </linearGradient>
      <radialGradient id="cahaya"><stop offset="0" stop-color="var(--surya)" stop-opacity="0.7"/><stop offset="1" stop-color="var(--surya)" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${lebar}" height="${ufuk}" fill="url(#senja)"/>
    ${kisiAlt}${garisAz.join("")}
    <line class="garis-mabims" x1="0" x2="${lebar}" y1="${y(MABIMS.tinggi)}" y2="${y(MABIMS.tinggi)}"/>
    <text class="label-mabims" x="${lebar - 8}" y="${y(MABIMS.tinggi) - 6}" text-anchor="end">3° batas MABIMS</text>
    <clipPath id="atas-ufuk"><rect width="${lebar}" height="${ufuk}"/></clipPath>
    <g clip-path="url(#atas-ufuk)">
      <circle cx="${x(h.azMatahari)}" cy="${ufuk}" r="60" fill="url(#cahaya)"/>
      <circle class="surya" cx="${x(h.azMatahari)}" cy="${ufuk + r * 0.35}" r="${r}"/>
    </g>
    ${besok ? `<g class="besok">${sabit(x(besok.azBulan), y(besok.tinggi), r, sudut(besok), tebal(besok))}<text class="label-langit redup" x="${x(besok.azBulan)}" y="${y(besok.tinggi) - r - 8}" text-anchor="middle">besok ${derajat(besok.tinggi, 1)}</text></g>` : ""}
    <g class="${bulanDiAtas ? "" : "di-bawah"}">
      <circle class="piringan" cx="${x(h.azBulan)}" cy="${y(h.tinggi)}" r="${r}"/>
      ${h.umur > 0 ? sabit(x(h.azBulan), y(h.tinggi), r, sudut(h), tebal(h)) : ""}
      <text class="label-langit" x="${x(h.azBulan)}" y="${bulanDiAtas ? y(h.tinggi) - r - 8 : y(h.tinggi) + r + 16}" text-anchor="middle">hilal ${derajat(h.tinggi, 2)}</text>
    </g>
    <rect class="tanah" x="0" y="${ufuk}" width="${lebar}" height="${tinggiSvg - ufuk}"/>
    <line class="ufuk" x1="0" x2="${lebar}" y1="${ufuk}" y2="${ufuk}"/>
    ${labelAz.join("")}
    <text class="label-ufuk" x="8" y="${ufuk + 34}">ufuk barat · azimut</text>
  </svg>`;
}

/* ---------- sebaran tinggi vs elongasi ---------- */
export type TitikSebar = { label: string; tinggi: number; elongasi: number; sejarah: boolean; ket: string };

export function gambarSebar(wadah: HTMLElement, titik: TitikSebar[]): void {
  const lebar = Math.max(300, wadah.clientWidth);
  const hp = lebar < 480;
  const tinggiSvg = hp ? 320 : 380;
  const m = { atas: 14, kanan: 14, bawah: 40, kiri: 44 };
  const x = scaleLinear().domain([0, 14]).range([m.kiri, lebar - m.kanan]);
  const y = scaleLinear().domain([-4, 10]).range([tinggiSvg - m.bawah, m.atas]);
  const kisiX = [0, 2, 4, 6, 8, 10, 12, 14];
  const kisiY = [-4, -2, 0, 2, 4, 6, 8, 10];
  // Label dicoba di kanan titik, lalu di kiri; disembunyikan bila tetap menabrak titik atau label lain.
  type Kotak = [number, number, number, number];
  const tabrak = (b: Kotak, k: Kotak) => !(b[2] < k[0] || b[0] > k[2] || b[3] < k[1] || b[1] > k[3]);
  const posY = (t: TitikSebar) => y(Math.max(-4, Math.min(10, t.tinggi)));
  const kotak: Kotak[] = titik.map((t) => [x(t.elongasi) - 7, posY(t) - 7, x(t.elongasi) + 7, posY(t) + 7]);
  const label = titik
    .map((t, i) => ({ t, i }))
    .sort((a, b) => Number(b.t.sejarah) - Number(a.t.sejarah))
    .map(({ t, i }) => {
      const w = t.label.length * (t.sejarah ? 6.6 : 6.1);
      const ly = posY(t) + 4;
      const lain = kotak.filter((_, j) => j !== i);
      for (const kanan of [true, false]) {
        const lx = kanan ? x(t.elongasi) + 9 : x(t.elongasi) - 9 - w;
        const b: Kotak = [lx, ly - 11, lx + w, ly + 2];
        if (b[0] < m.kiri || b[2] > lebar - 4 || lain.some((k) => tabrak(b, k))) continue;
        kotak.push(b);
        return `<text class="label-titik${t.sejarah ? " sejarah" : ""}" x="${lx}" y="${ly}">${esc(t.label)}</text>`;
      }
      return "";
    })
    .join("");
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggiSvg}" width="${lebar}" height="${tinggiSvg}">
    <rect class="zona-wujud" x="${m.kiri}" y="${y(10)}" width="${lebar - m.kanan - m.kiri}" height="${y(0) - y(10)}"/>
    <rect class="zona-mabims" x="${x(MABIMS.elongasi)}" y="${y(10)}" width="${x(14) - x(MABIMS.elongasi)}" height="${y(MABIMS.tinggi) - y(10)}"/>
    ${kisiX.map((v) => `<line class="kisi" x1="${x(v)}" x2="${x(v)}" y1="${m.atas}" y2="${tinggiSvg - m.bawah}"/><text class="sumbu" x="${x(v)}" y="${tinggiSvg - m.bawah + 16}" text-anchor="middle">${v}°</text>`).join("")}
    ${kisiY.map((v) => `<line class="kisi${v === 0 ? " nol" : ""}" x1="${m.kiri}" x2="${lebar - m.kanan}" y1="${y(v)}" y2="${y(v)}"/><text class="sumbu" x="${m.kiri - 6}" y="${y(v) + 4}" text-anchor="end">${v}°</text>`).join("")}
    <text class="label-zona" x="${x(MABIMS.elongasi) + 8}" y="${y(10) + 18}">MABIMS terpenuhi</text>
    <text class="label-zona wujud" x="${m.kiri + 8}" y="${y(10) + 18}">${hp ? "di atas ufuk" : "di atas ufuk: wujudul hilal"}</text>
    <text class="sumbu judul-sumbu" x="${(m.kiri + lebar - m.kanan) / 2}" y="${tinggiSvg - 6}" text-anchor="middle">elongasi</text>
    <text class="sumbu judul-sumbu" x="12" y="${m.atas + 6}" transform="rotate(-90 12 ${m.atas + 6})" text-anchor="end">tinggi</text>
    ${titik.map((t, i) => `<circle class="titik${t.sejarah ? " sejarah" : ""}" data-i="${i}" cx="${x(t.elongasi)}" cy="${y(Math.max(-4, Math.min(10, t.tinggi)))}" r="6"/>`).join("")}
    ${label}
  </svg>`;
  const svg = wadah.querySelector("svg")!;
  const tip = buatTip(wadah);
  svg.addEventListener("pointermove", (e) => {
    const kot = svg.getBoundingClientRect();
    const px = e.clientX - kot.left;
    const py = e.clientY - kot.top;
    let pilih = -1;
    let jarak = 16;
    titik.forEach((t, i) => {
      const d = Math.hypot(x(t.elongasi) - px, y(t.tinggi) - py);
      if (d < jarak) [pilih, jarak] = [i, d];
    });
    if (pilih < 0) return tip.sembunyi();
    const t = titik[pilih];
    tip.tampil(x(t.elongasi), y(t.tinggi), `<b>${esc(t.label)}</b><br>tinggi ${derajat(t.tinggi)}, elongasi ${derajat(t.elongasi)}<br><span class="redup">${esc(t.ket)}</span>`);
  });
  svg.addEventListener("pointerleave", () => tip.sembunyi());
}

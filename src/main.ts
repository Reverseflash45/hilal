import "@fontsource/amiri/700";
import "@fontsource/amiri/700-italic";
import "@fontsource/mulish/400";
import "@fontsource/mulish/600";
import "@fontsource/mulish/800";
import "./gaya.css";
import {
  DAERAH,
  type Daerah,
  type HasilBulan,
  type Tanggal,
  cariDaerah,
  derajat,
  hitungBulan,
  lat,
  lon,
  namaZona,
  samaTanggal,
  teksJam,
  teksLag,
  teksTanggal,
  teksTanggalPendek,
  teksUmur,
  zona,
} from "./data";
import { type Ijtimak, MABIMS, NAMA_BULAN, daftarIjtimak, hisab, memenuhiMabims, memenuhiWujud, tambahHari } from "./hilal";
import { type Peta, type TitikSebar, type Ukuran, esc, gambarLangit, gambarLegenda, gambarPeta, gambarSebar, muatPeta } from "./vis";

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

/* ---------- keadaan ---------- */
const PENTING = new Set([8, 9, 11]); // Ramadan, Syawal, Zulhijah
const BULAN_DEPAN: Ijtimak[] = daftarIjtimak(new Date(Date.now() - 3 * 86_400_000), 12);
const kunciBulan = (ij: Ijtimak) => `${NAMA_BULAN[ij.bulan].toLowerCase()}-${ij.tahun}`;

const hash = new URLSearchParams(location.hash.slice(1));
let bulanTerpilih: Ijtimak = BULAN_DEPAN.find((ij) => kunciBulan(ij) === hash.get("bulan")) ?? BULAN_DEPAN.find((ij) => PENTING.has(ij.bulan)) ?? BULAN_DEPAN[0];
let pilihan: Daerah = DAERAH.find((d) => d.id === hash.get("daerah")) ?? DAERAH.find((d) => d.id === "kota-jakarta-pusat")!;
let ukuran: Ukuran = "tinggi";
let peta: Peta | null = null;

function simpanHash() {
  history.replaceState(null, "", `#bulan=${kunciBulan(bulanTerpilih)}&daerah=${pilihan.id}`);
}

const namaLengkap = (ij: Ijtimak) => `${NAMA_BULAN[ij.bulan]} ${ij.tahun}`;
const tanggalWib = (w: Date): Tanggal => {
  const d = new Date(w.getTime() + 7 * 3_600_000);
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() };
};

/** Hari raya atau penanda penting yang jatuh dari tanggal 1 bulan ini. */
function hariPenting(ij: Ijtimak, awal: Tanggal): string {
  if (ij.bulan === 8) return `Puasa pertama ${teksTanggal(awal, true)}`;
  if (ij.bulan === 9) return `Idulfitri ${teksTanggal(awal, true)}`;
  if (ij.bulan === 11) return `Iduladha (10 Zulhijah) ${teksTanggal(tambahHari(awal, 9), true)}`;
  return `1 ${NAMA_BULAN[ij.bulan]} ${teksTanggal(awal, true)}`;
}

/* ---------- pilihan bulan ---------- */
function gambarPilihBulan() {
  const wadah = $("[data-pilih-bulan]");
  wadah.innerHTML = BULAN_DEPAN.map(
    (ij, i) =>
      `<button type="button" data-bulan="${i}" class="${PENTING.has(ij.bulan) ? "penting" : ""}" aria-pressed="${ij === bulanTerpilih}"><span>${NAMA_BULAN[ij.bulan]} ${ij.tahun}</span><small>${teksTanggalPendek(tanggalWib(ij.waktu))}</small></button>`,
  ).join("");
  // Di layar sempit bulan terpilih bisa berada di luar layar; geser barisnya ke sana.
  const aktif = wadah.querySelector<HTMLElement>("[aria-pressed=true]");
  if (aktif) {
    const kiri = aktif.offsetLeft - wadah.offsetLeft;
    if (kiri + aktif.offsetWidth > wadah.clientWidth) wadah.scrollLeft = kiri - 16;
  }
}
$("[data-pilih-bulan]").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-bulan]");
  if (!b) return;
  pilihBulan(BULAN_DEPAN[Number(b.dataset.bulan)]);
});

function pilihBulan(ij: Ijtimak, gulir = false) {
  bulanTerpilih = ij;
  simpanHash();
  $$<HTMLButtonElement>("[data-bulan]").forEach((b) => b.setAttribute("aria-pressed", String(BULAN_DEPAN[Number(b.dataset.bulan)] === ij)));
  gambarRingkas();
  gambarPetaIndonesia();
  gambarDaerah();
  if (gulir) $(".pembuka").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/* ---------- ringkasan ---------- */
function gambarRingkas() {
  const h = hitungBulan(bulanTerpilih);
  const ij = bulanTerpilih;
  $("[data-nama-bulan]").innerHTML = `${NAMA_BULAN[ij.bulan]} <span>${ij.tahun} H</span>`;
  $("[data-waktu]").innerHTML =
    `<div><dt>Ijtimak</dt><dd>${teksTanggal(tanggalWib(ij.waktu), true)}, pukul ${teksJam(ij.waktu, 7)} WIB</dd></div>` +
    `<div><dt>Pengamatan</dt><dd>Magrib ${teksTanggal(h.pengamatan, true)}${h.setelahMagrib ? ` <span class="catatan-kecil">karena ijtimak terjadi sesudah magrib</span>` : ""}</dd></div>`;
  const kotak = (judul: string, n: number, awal: Tanggal, syarat: string) =>
    `<article class="${n > 0 ? "terpenuhi" : "tidak"}">
      <p class="label">${judul}</p>
      <p class="syarat">${syarat}</p>
      <p class="status">${n > 0 ? `Terpenuhi di <strong>${n}</strong> dari ${h.per.size} daerah` : "Tidak terpenuhi di daerah mana pun"}</p>
      <p class="tanggal-awal">${hariPenting(ij, awal)}</p>
    </article>`;
  $("[data-putusan]").innerHTML =
    kotak("MABIMS", h.mabims, h.awalMabims, `tinggi ≥ ${MABIMS.tinggi}° dan elongasi ≥ 6,4°`) + kotak("Wujudul hilal", h.wujud, h.awalWujud, "bulan terbenam sesudah matahari");
  const beda = $("[data-beda]");
  beda.hidden = false;
  beda.className = samaTanggal(h.awalMabims, h.awalWujud) ? "beda sama" : "beda";
  beda.textContent = samaTanggal(h.awalMabims, h.awalWujud)
    ? "Kedua kriteria memberi tanggal yang sama."
    : `Kedua kriteria memberi tanggal berbeda. Hilal tertinggi di Indonesia ${derajat(h.tertinggi.h.tinggi)} dengan elongasi ${derajat(h.tertinggi.h.elongasi)}, di ${h.tertinggi.d.nama}.`;
}

/* ---------- peta ---------- */
function teksPeta(h: HasilBulan, id: string): string {
  const d = DAERAH.find((x) => x.id === id)!;
  const k = h.per.get(id);
  if (!k) return esc(d.nama);
  const z = zona(d);
  return `<b>${esc(d.nama)}</b><br>tinggi ${derajat(k.tinggi)}, elongasi ${derajat(k.elongasi)}<br><span class="redup">magrib ${teksJam(k.magrib, z)} ${namaZona(z)} · MABIMS ${memenuhiMabims(k) ? "terpenuhi" : "belum"} · wujud ${memenuhiWujud(k) ? "ya" : "belum"}</span>`;
}

function gambarPetaIndonesia() {
  const h = hitungBulan(bulanTerpilih);
  $("[data-judul-peta]").innerHTML = `${ukuran === "tinggi" ? "Tinggi" : "Elongasi"} hilal saat magrib, ${teksTanggal(h.pengamatan, true)} <span class="redup">· hilal tertinggi di ${esc(h.tertinggi.d.nama)}: ${derajat(h.tertinggi.h.tinggi)}, elongasi ${derajat(h.tertinggi.h.elongasi)}</span>`;
  gambarLegenda($("[data-legenda]"), ukuran);
  $$<HTMLButtonElement>("[data-ukuran]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ukuran === ukuran)));
  if (!peta) return;
  gambarPeta($("#peta"), peta, h.per, ukuran, (id) => teksPeta(h, id), pilihan.id, (id) => {
    pilihDaerah(DAERAH.find((d) => d.id === id)!);
    $("#daerahmu").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}
$$<HTMLButtonElement>("[data-ukuran]").forEach((b) =>
  b.addEventListener("click", () => {
    ukuran = b.dataset.ukuran as Ukuran;
    gambarPetaIndonesia();
  }),
);

/* ---------- daerahmu ---------- */
function gambarDaerah() {
  const h = hitungBulan(bulanTerpilih);
  const k = h.per.get(pilihan.id);
  if (!k) return;
  const z = zona(pilihan);
  const besok = hisab(lat(pilihan), lon(pilihan), z, tambahHari(h.pengamatan, 1), bulanTerpilih.waktu);
  $("[data-judul-langit]").innerHTML = `${esc(pilihan.nama)}, magrib ${teksTanggal(h.pengamatan)} pukul ${teksJam(k.magrib, z)} ${namaZona(z)} <span class="redup">· sabit diperbesar</span>`;
  gambarLangit($("#langit"), k, besok);
  $("#langit").setAttribute("aria-label", `Langit barat ${pilihan.nama} saat magrib: hilal setinggi ${derajat(k.tinggi)} dengan elongasi ${derajat(k.elongasi)}.`);
  const isi: [string, string][] = [
    ["Matahari terbenam", `${teksJam(k.magrib, z)} ${namaZona(z)}`],
    ["Bulan terbenam", k.bulanTerbenam ? `${teksJam(k.bulanTerbenam, z)} ${namaZona(z)} · ${teksLag(k.lag)}` : "—"],
    ["Tinggi hilal", derajat(k.tinggi)],
    ["Elongasi", derajat(k.elongasi)],
    ["Umur bulan", teksUmur(k.umur)],
    ["Bagian bulan yang terang", `${(k.iluminasi * 100).toFixed(2).replace(".", ",")}%`],
  ];
  $("[data-nilai]").innerHTML = isi.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("");
  const mab = memenuhiMabims(k);
  const alasan = k.umur <= 0 ? "ijtimak belum terjadi saat magrib" : [k.tinggi < MABIMS.tinggi ? `tinggi kurang ${derajat(MABIMS.tinggi - k.tinggi)}` : "", k.elongasi < MABIMS.elongasi ? `elongasi kurang ${derajat(MABIMS.elongasi - k.elongasi)}` : ""].filter(Boolean).join(", ");
  const wuj = memenuhiWujud(k);
  $("[data-cek]").innerHTML =
    `<li class="${mab ? "ya" : "tidak"}"><span aria-hidden="true">${mab ? "✓" : "✕"}</span><div><strong>MABIMS ${mab ? "terpenuhi" : "belum terpenuhi"}</strong>${mab ? "" : `<small>${alasan}</small>`}</div></li>` +
    `<li class="${wuj ? "ya" : "tidak"}"><span aria-hidden="true">${wuj ? "✓" : "✕"}</span><div><strong>Wujudul hilal ${wuj ? "terpenuhi" : "belum terpenuhi"}</strong>${wuj ? "" : `<small>${k.umur <= 0 ? "ijtimak belum terjadi saat magrib" : "bulan terbenam lebih dulu"}</small>`}</div></li>`;
}

function pilihDaerah(d: Daerah) {
  pilihan = d;
  simpanHash();
  tutupSaran();
  masuk.value = d.nama;
  gambarDaerah();
  gambarPetaIndonesia();
}

/* ---------- kalender & sebaran (dihitung bertahap) ---------- */
const SEJARAH: { dari: string; ket: string }[] = [
  { dari: "2023-04-15", ket: "Idulfitri berbeda: 21 April (Muhammadiyah) dan 22 April 2023 (pemerintah)" },
  { dari: "2023-06-12", ket: "Iduladha berbeda: 28 Juni (Muhammadiyah) dan 29 Juni 2023 (pemerintah)" },
  { dari: "2024-03-05", ket: "Awal puasa berbeda: 11 Maret (Muhammadiyah) dan 12 Maret 2024 (pemerintah)" },
];

function barisKalender(h: HasilBulan, i: number): string {
  const ij = h.ij;
  const beda = !samaTanggal(h.awalMabims, h.awalWujud);
  return `<tr data-baris="${i}" class="${PENTING.has(ij.bulan) ? "penting" : ""}${ij === bulanTerpilih ? " aktif" : ""}">
    <th scope="row"><button type="button" class="tautan" data-ke-bulan="${i}">${namaLengkap(ij)}</button></th>
    <td>${teksTanggalPendek(tanggalWib(ij.waktu))} <span class="redup">${teksJam(ij.waktu, 7)}</span></td>
    <td class="angka ${h.tertinggi.h.tinggi >= MABIMS.tinggi ? "lolos" : ""}">${derajat(h.tertinggi.h.tinggi)}</td>
    <td class="angka ${h.tertinggi.h.elongasi >= MABIMS.elongasi ? "lolos" : ""}">${derajat(h.tertinggi.h.elongasi)}</td>
    <td class="${beda ? "beda-sel" : ""}">${teksTanggalPendek(h.awalMabims)}</td>
    <td class="${beda ? "beda-sel" : ""}">${teksTanggalPendek(h.awalWujud)}</td>
  </tr>`;
}

let titikSebar: TitikSebar[] = [];
function hitungBertahap() {
  const tbody = $("[data-kalender]");
  tbody.innerHTML = BULAN_DEPAN.map((ij, i) => `<tr data-baris="${i}"><th scope="row">${namaLengkap(ij)}</th><td colspan="5" class="redup">menghitung…</td></tr>`).join("");
  const antre: (() => void)[] = BULAN_DEPAN.map((ij, i) => () => {
    const h = hitungBulan(ij);
    tbody.querySelector(`[data-baris="${i}"]`)!.outerHTML = barisKalender(h, i);
    titikSebar.push({ label: namaLengkap(ij), tinggi: h.tertinggi.h.tinggi, elongasi: h.tertinggi.h.elongasi, sejarah: false, ket: `perkiraan 1 ${NAMA_BULAN[ij.bulan]}: ${teksTanggalPendek(h.awalMabims)} (MABIMS), ${teksTanggalPendek(h.awalWujud)} (wujud)` });
  });
  for (const s of SEJARAH)
    antre.push(() => {
      const [ij] = daftarIjtimak(new Date(s.dari), 1);
      const h = hitungBulan(ij);
      titikSebar.push({ label: namaLengkap(ij), tinggi: h.tertinggi.h.tinggi, elongasi: h.tertinggi.h.elongasi, sejarah: true, ket: s.ket });
    });
  const jalan = () => {
    const kerja = antre.shift();
    if (!kerja) return gambarSebar($("#sebar"), titikSebar);
    kerja();
    setTimeout(jalan, 0);
  };
  setTimeout(jalan, 0);
}
$("[data-kalender]").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-ke-bulan]");
  if (!b) return;
  const i = Number(b.dataset.keBulan);
  $$("[data-kalender] tr").forEach((tr) => tr.classList.toggle("aktif", tr.getAttribute("data-baris") === String(i)));
  pilihBulan(BULAN_DEPAN[i], true);
});

/* ---------- combobox ---------- */
const masuk = $<HTMLInputElement>("#daerah");
const daftarSaran = $<HTMLUListElement>("#saran");
let saran: Daerah[] = [];
let aktif = -1;

function tutupSaran() {
  daftarSaran.hidden = true;
  masuk.setAttribute("aria-expanded", "false");
  masuk.removeAttribute("aria-activedescendant");
}
function sorot() {
  $$("#saran [role=option]").forEach((li, i) => li.setAttribute("aria-selected", String(i === aktif)));
  if (aktif >= 0) masuk.setAttribute("aria-activedescendant", `saran-${aktif}`);
}
masuk.addEventListener("focus", () => masuk.select());
masuk.addEventListener("input", () => {
  saran = cariDaerah(masuk.value);
  aktif = saran.length ? 0 : -1;
  daftarSaran.innerHTML = saran.length
    ? saran.map((d, i) => `<li role="option" id="saran-${i}" data-i="${i}" aria-selected="${i === aktif}"><span>${esc(d.nama)}</span><small>${esc(d.prov)}</small></li>`).join("")
    : `<li aria-disabled="true">Tidak ada yang cocok</li>`;
  daftarSaran.hidden = !masuk.value.trim();
  masuk.setAttribute("aria-expanded", String(!daftarSaran.hidden));
  sorot();
});
masuk.addEventListener("keydown", (e) => {
  if (daftarSaran.hidden || !saran.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    aktif = (aktif + (e.key === "ArrowDown" ? 1 : -1) + saran.length) % saran.length;
    sorot();
    e.preventDefault();
  } else if (e.key === "Escape") tutupSaran();
});
masuk.addEventListener("blur", () =>
  setTimeout(() => {
    tutupSaran();
    masuk.value = pilihan.nama;
  }, 150),
);
daftarSaran.addEventListener("mousedown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
  if (!li) return;
  e.preventDefault();
  pilihDaerah(saran[Number(li.dataset.i)]);
  masuk.blur();
});
$("#cari").addEventListener("submit", (e) => {
  e.preventDefault();
  if (aktif >= 0 && saran[aktif]) {
    pilihDaerah(saran[aktif]);
    masuk.blur();
  }
});

/* ---------- ukuran layar & tema ---------- */
let lebarTerakhir = 0;
let tunda = 0;
function gambarUlang() {
  gambarPetaIndonesia();
  gambarDaerah();
  if (titikSebar.length === BULAN_DEPAN.length + SEJARAH.length) gambarSebar($("#sebar"), titikSebar);
}
new ResizeObserver(([e]) => {
  const w = Math.round(e.contentRect.width);
  if (!lebarTerakhir) {
    lebarTerakhir = w;
    return;
  }
  if (w === lebarTerakhir) return;
  lebarTerakhir = w;
  cancelAnimationFrame(tunda);
  tunda = requestAnimationFrame(gambarUlang);
}).observe(document.querySelector("main")!);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", gambarPetaIndonesia);

/* ---------- mulai ---------- */
masuk.value = pilihan.nama;
gambarPilihBulan();
gambarRingkas();
gambarPetaIndonesia();
gambarDaerah();
muatPeta()
  .then((p) => {
    peta = p;
    gambarPetaIndonesia();
    hitungBertahap();
  })
  .catch(() => {
    $("#peta").innerHTML = `<p class="gagal">Peta gagal dimuat. Muat ulang halaman.</p>`;
    hitungBertahap();
  });

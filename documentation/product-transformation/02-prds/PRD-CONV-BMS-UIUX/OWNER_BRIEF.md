# Tingkatkan kualitas visual dan operasional BMS di repository ini

Kerjakan langsung pada aplikasi Building Management System (BMS) yang ada. Ambil peran sebagai perancang HMI untuk operator data center dan frontend engineer yang menguasai rendering real-time. Jalankan aplikasinya, ubah kode pada halaman yang dipakai operator, lalu periksa sendiri hasilnya di browser. Teruskan siklus perbaikan sampai pemeriksaan visual, akurasi data, interaksi, dan performa di bagian akhir terpenuhi.

Saat membuka plant overview, operator harus bisa menemukan gangguan, mengenali peralatan dan jalur yang terdampak, membaca parameter pendukung beserta kualitas datanya, lalu membuka tren tanpa kehilangan konteks. Saat plant normal, layar harus terasa tenang. Saat satu aset trip di tengah plant yang padat, aset tersebut harus tetap mudah ditemukan sekalipun animasi dimatikan.

## 1. Mulai dari layar dan data sebenarnya

- Jalankan repository sesuai petunjuk proyek. Temukan route BMS, komponen schematic, renderer, model equipment, sumber point/tag, alarm store, historian/trend, serta test dan fixture yang tersedia. Ikuti satu point dari payload hingga label, simbol, animasi, dan detail aset. Identifikasi tempat yang membuat interpretasi sendiri atas point yang sama.
- Pilih layar plant paling padat sebagai pekerjaan pertama. Rekam kondisi awal pada desktop dan ponsel, lalu telusuri satu perjalanan operator dari overview ke peralatan, alarm atau tren, dan kembali. Catat masalah spesifik beserta lokasinya, misalnya label terpotong, cabang pipa ambigu, popup menutup alarm, atau animasi aliran tetap bergerak ketika data sudah stale.
- Gunakan topologi, konvensi simbol, alarm philosophy, aset visual, bahasa UI, dan stack yang dapat dibuktikan dari proyek. Kerjakan melalui route dan navigasi yang sudah digunakan. Ikuti hak akses serta alur konfirmasi yang berlaku untuk setiap aksi operator. Gunakan environment pengembangan dan fixture/replay untuk memicu trip, kehilangan komunikasi, atau pemulihan. Isolasi pengujian dari kontrol peralatan live.

## 2. Bangun hierarki visual yang membantu operator

- **Overview.** Beri ruang utama pada plant dan hubungan antaraset. Tempatkan alarm aktif, area terdampak, dan status koneksi di lokasi yang konsisten. Tampilkan parameter ringkas di dekat peralatan yang dijelaskannya. Gunakan warna netral untuk kondisi rutin dan warna perhatian sesuai konvensi situs. Pasangkan warna dengan bentuk, ikon, pola garis, atau kata yang punya arti jelas.
- **Schematic.** Tetapkan grid, skala simbol, ketebalan garis, jarak paralel, radius belokan, titik sambung, dan aturan penempatan label. Bedakan persilangan tanpa koneksi dengan percabangan yang benar. Telusuri ujung ke ujung jalur utama, bypass, dan isolasi yang memang tersedia. Pastikan garis tidak tampak menembus equipment atau tersambung ke port yang salah ketika di-zoom.
- **Detail aset.** Satu klik atau tap membuka inspector yang menunjukkan tag, status, mode, alarm, dan parameter paling relevan. Letakkan tren, timestamp, kualitas data, dan rincian lainnya dalam jangkauan. Saat inspector ditutup atau operator kembali dari tren, pulihkan pilihan aset, posisi pan, zoom, dan filter.
- **Tipografi.** Pastikan tag dan satuan tetap terbaca di atas plant. Gunakan angka tabular dan presisi sesuai point supaya angka di kolom tidak bergeser saat nilainya berubah. Rapikan alignment, whitespace, separator, dan urutan baca. Setiap kartu, label, badge, atau efek harus menyampaikan informasi atau mendukung tindakan operator.

## 3. Perbaiki gambar equipment, shader, dan material

Mulai dari dua atau tiga tipe aset yang paling sering muncul pada schematic utama. Lihat hasilnya berdampingan pada ukuran tampil sebenarnya sebelum menerapkan perbaikannya ke seluruh keluarga komponen.

- **Equipment mekanikal.** Gunakan referensi aset/CAD yang tersedia. Bentuk pompa harus terbaca dari volute, motor, dan port. Pada chiller, perjelas proporsi badan, panel, dan sambungan yang terdokumentasi. Pakai sudut pandang, skala, orientasi pencahayaan, dan contact shadow yang konsisten. Pada zoom rendah, pertahankan siluet dan titik sambung. Tampilkan detail permukaan hanya pada skala yang membuatnya berguna.
- **Material.** Bedakan cat bodi, baja, dan insulasi melalui respons cahaya, roughness, serta highlight lokal. Untuk renderer 3D gunakan normal/roughness yang terkendali pada material yang mendukungnya. Untuk Canvas/SVG 2D, gunakan lapisan bentuk, edge highlight, dan bayangan kontak yang mengikuti geometri. Cek apakah material masih terbaca ketika glow dan motion dimatikan. Hilangkan kilap, grain, atau bloom yang mengaburkan teks, berkelip ketika pan, atau membuat equipment normal tampak mengalami gangguan.
- **Schematic listrik.** Pertahankan presisi simbol SLD, posisi kontak breaker, bus, junction, dan pemisahan feeder. SVG sangat sesuai untuk linework, simbol teknik, label tajam, dan hit area. Pilih teknik rendering per lapisan. Gunakan WebGL atau post-processing hanya ketika perbandingan visual dan profil performa menunjukkan manfaat pada layar ini.
- **Susunan lapisan.** Urutkan background, jalur, equipment, indikasi proses, label, lalu fokus/seleksi dan alarm. Pastikan alarm dan angka dapat dibaca di atas efek paling terang. Overlay dekoratif harus meneruskan pointer ke target di bawahnya. Bila GPU/WebGL tidak tersedia atau context hilang, sediakan tampilan 2D atau daftar yang tetap memberikan akses ke status, nilai, alarm, dan detail.

## 4. Ikat animasi dan VFX ke kondisi proses

Gunakan satu model status yang sama untuk simbol, animasi, inspector, dan legend. Tentukan sumber yang mengizinkan setiap efek muncul, kondisi yang menghentikannya, serta bentuk statis yang menyampaikan informasi yang sama.

| Elemen | Perilaku yang harus diimplementasikan |
|---|---|
| Aliran fluida | Hitung fase motif dari jarak kumulatif sepanjang jalur agar gerakan kontinu melewati elbow. Gunakan arah dari point signed atau konfigurasi arah yang terverifikasi. Aktifkan gerak hanya untuk segmen dengan bukti aliran dan arah. Bila satu-satunya meter berada di header, visualisasikan flow pada segmen yang dicakup meter tersebut. Hentikan efek saat flow valid nol atau kualitas hilang. Bedakan kedua kondisi lewat nilai dan penanda kualitas. |
| Pompa, fan, valve | Tautkan indikasi running ke feedback yang sesuai. Gunakan speed feedback valid bila laju animasi menyatakan perubahan kecepatan. Sajikan speed command atau valve position command dengan label tersendiri. Bila command dan feedback berbeda, buat keduanya terbaca. |
| Jalur listrik | Tampilkan posisi breaker dari position feedback. Untuk status energized, ikuti bukti tegangan/status dan topologi yang digunakan proyek. Panah transfer daya hanya muncul bila arah dayanya diketahui. Breaker closed, bus energized, dan beban 0 kW harus dapat ditampilkan sebagai fakta yang berbeda. |
| Alarm dan seleksi | Gunakan penanda persisten yang tetap terlihat pada kondisi trip. Bedakan selected, focus, active alarm, dan acknowledged alarm. Terapkan gerak alarm sesuai filosofi yang ada. Acknowledge mengubah status pengakuan dan alarm aktif tetap terlihat selama sumbernya aktif. |
| Transisi UI | Gunakan motion singkat untuk membuka inspector atau memindahkan fokus. Terapkan perubahan status diskret segera. Hormati `prefers-reduced-motion` dengan panah statis, simbol, atau teks sesuai kualitas dan arah yang diketahui. |

Untuk shader aliran atau padanan Canvas/SVG, simpan fase per lintasan kontinu. Tambahkan `direction × speed × deltaTime` ke fase setiap frame. Evaluasi posisi motif dari selisih jarak sepanjang lintasan dan fase, dengan satuan panjang yang sama. Dengan cara ini perubahan speed atau arah tidak membuat motif melompat. Potong efek di batas jalur menggunakan mask/clip path dan periksa hasilnya di elbow, tee, serta dua pipa paralel. Saat status menjadi stale, matikan lapisan gerak dan pertahankan geometri dasar serta label kualitas.

**Pusatkan parameter visual** dalam theme/config yang sudah dimiliki proyek. Jadikan parameter yang benar-benar dipakai mudah dituning oleh engineer. Jika proyek memiliki panel developer, hubungkan kontrol preview ke config yang sama dan sediakan reset ke default. Pisahkan konfigurasinya dari alamat point, setpoint, threshold alarm, serta write command. Gunakan rentang awal berikut untuk eksperimen visual dan sesuaikan setelah melihat hasil pada perangkat target.

| Parameter visual | Titik awal dan cara mengeceknya |
|---|---|
| Roughness cat bodi | 0,55–0,80 pada material PBR dengan skala 0–1. Periksa highlight pada sisi terang dan gelap. |
| Opacity bayangan kontak | 0,08–0,18. Periksa apakah equipment terasa menapak dan pipa di sekelilingnya masih terbaca. |
| Jarak motif dan laju flow | Coba jarak 28–48 CSS px dan laju ilustratif 12–36 CSS px/detik pada zoom normal. Kaitkan laju dengan magnitude hanya bila pemetaannya terdokumentasi. Cantumkan besaran engineering pada label. Periksa cabang pendek dan zoom tinggi. |
| Durasi interaksi | Coba 120–180 ms untuk transisi panel. Status alarm mengikuti event sumber saat diterima UI. |
| Kualitas rendering | Tetapkan level efek, resolusi render/DPR, dan level detail yang sesuai hasil profiling. Turunkan biaya shadow, partikel, dan sampling lebih dulu. Pertahankan ketajaman teks dan keterbacaan alarm pada semua level. |

## 5. Tampilkan parameter operasional yang benar

Inventarisasi parameter per tipe aset. Untuk setiap nilai yang ditampilkan, petakan **nama operator, source tag/field, jenis measured/command/feedback/derived, satuan, presisi, konvensi tanda, timestamp, quality, dan aturan freshness**. Gunakan konfigurasi aktual untuk skala, konversi, dan umur data. Bila point penting tersedia tetapi tersembunyi di payload, tampilkan di tempat yang mendukung diagnosis. Bila belum ada sumber, nyatakan keterbatasannya.

| Aset jika tersedia | Parameter yang layak diperiksa |
|---|---|
| Chiller / chilled-water loop | Supply dan return temperature, definisi ΔT yang digunakan proyek, flow, differential pressure, run feedback, load, dan alarm aktif. Untuk nilai turunan, cek inlet/outlet atau supply/return, loop dan pasangan waktu sampel. |
| Pump / fan / valve | Command, feedback, local/remote, speed Hz atau RPM sesuai sumber, posisi valve %, serta flow atau ΔP jika diukur. Tampilkan command dan actual dalam satu konteks agar mismatch terlihat. |
| UPS / switchgear / feeder | Posisi breaker, tegangan, arus, kW, kWh, load %, mode/bypass, dan alarm yang tersedia. Periksa fase, satuan, skala, konvensi arah daya, dan sumber untuk setiap indikator. |

Bedakan **nol valid, belum ada sampel, stale, bad quality, dan komunikasi terputus**. Last known value boleh ditampilkan bersama timestamp dan penanda kualitas. Terapkan kualitas per point bila sumber mendukung. Pertahankan status alarm terakhir yang diketahui sesuai lifecycle sumber. Gunakan putus garis atau penanda gap pada tren ketika data hilang. Tangani update terlambat dan reconnect agar sampel lama tidak menimpa sampel yang lebih baru. Data fixture harus jelas berstatus simulasi.

## 6. Pastikan layar tetap efektif di desktop, tablet, dan ponsel

- Uji setidaknya lebar 360 atau 390 px, 768 px, 1366 atau 1440 px, dan 1920 px. Sertakan zoom browser 200%, orientasi landscape ponsel, dan layar plant terpadat. Periksa dengan mouse, keyboard, serta input sentuh atau emulasinya.
- Di desktop, inspector boleh berdampingan dengan schematic. Di ponsel, tata ulang hierarki, tampilkan alarm prioritas, dan gunakan panel detail yang bisa ditutup. Biarkan operator memilih equipment rapat melalui daftar/pencarian atau hit area yang memadai. Tempatkan pan/zoom di viewport schematic. Sediakan zoom-to-fit dan cara kembali ke aset yang dipilih.
- Pada zoom rendah, prioritaskan label gangguan dan aset terpilih. Cegah tabrakan label pada zoom tinggi. Uji nilai terpanjang, tag panjang, angka negatif, jumlah alarm banyak, dan hilangnya satuan akibat clipping. Verifikasi fokus keyboard, nama aksesibel, kontras, serta akses ke informasi yang biasanya muncul saat hover.
- Profilkan halaman dengan kepadatan aset dan laju update yang mewakili kondisi proyek. Pisahkan ingest telemetry/alarm dari render loop. Bila animasi kontinu diperlukan, gunakan clock bersama, jeda efek di luar viewport, batasi repaint, dan lepaskan subscription serta resource GPU saat berpindah route. Cek bahwa alarm tetap masuk selama kualitas grafis diturunkan.

## 7. Buktikan hasilnya, lalu ulangi perbaikannya

Gunakan fixture deterministik atau replay yang sudah disanitasi. Bandingkan sebelum/sesudah pada route, data, aset, zoom, viewport, dan kondisi alarm yang sama. Lengkapi screenshot dengan rekaman singkat atau pengambilan sampel berurutan untuk membuktikan arah, penghentian animasi, dan perubahan status.

| Skenario uji | Bukti kelulusan |
|---|---|
| Command pompa ON, feedback OFF, flow valid 0 | Command ON dan feedback OFF terbaca. Indikator motor tidak berputar dan jalur tidak menunjukkan aliran. |
| Supply 7,2 °C dan return 12,8 °C pada loop yang mendefinisikan ΔT sebagai return dikurangi supply | Untuk pasangan sampel valid dan selaras waktu, ΔT terbaca +5,6 K atau ekuivalennya sesuai satuan selisih proyek. Ketika sampel return kehilangan kualitas, nilai turunan ikut ditandai. |
| Flow signed berubah positif → nol → negatif pada jalur yang mendukung aliran balik | Arah sesuai konvensi tag, motif berhenti di nol, lalu berbalik. Nilai dan satuan tetap cocok dengan input. |
| Breaker closed, tegangan tidak tersedia, kW valid 0 | Simbol menunjukkan closed, kualitas tegangan ditandai, dan 0 kW tetap terbaca. Indikasi energized memerlukan bukti independen sesuai model proyek. |
| Satu point stale saat alarm aset masih aktif | Hanya point terdampak kehilangan indikasi live. Alarm tetap terlihat. Sesudah reconnect, UI mengikuti sampel valid terbaru. |
| Trip saat inspector terbuka, lalu operator acknowledge di fixture | Operator dapat menemukan aset terdampak. Alarm tetap active/acknowledged selama sumbernya aktif. Fokus keyboard dan konteks inspector terjaga. |
| Ponsel, reduced motion, atau kegagalan renderer | Operator masih bisa menemukan gangguan, membuka aset, membaca nilai dan kualitas, lalu kembali. Panah statis hanya mengindikasikan arah yang diketahui. |

Untuk fungsi yang memang tidak ada di proyek, catat padanannya atau alasan skenario tidak berlaku. Ikuti budget performa proyek. Bila belum ada, gunakan sasaran awal **p95 frame interval ≤20 ms pada desktop referensi dan ≤34 ms pada profil mobile yang diuji**, selama sekitar 30 detik pan/zoom dengan telemetry aktif. Catat browser, perangkat atau emulasi, viewport, jumlah aset, laju event, dan hasil ukur. Ukur juga waktu dari alarm diterima frontend hingga indikator tampil agar peningkatan FPS tidak menyembunyikan keterlambatan alarm.

**Ulangi siklus berikut selama masih ada temuan material yang dapat direproduksi.**

1. Implementasikan perbaikan pada layar utama dan komponen bersama. Buka lagi dari navigasi normal, lalu jalankan workflow operator dari awal.
2. Periksa screenshot ukuran asli, rekaman motion, nilai sumber, dan hasil profiling. Nilai siluet equipment pada zoom overview, sudut pipa, kontras angka di atas material, serta tepi yang bergetar saat pan. Periksa satu screenshot tanpa warna untuk melihat apakah trip, seleksi, dan kualitas data masih bisa dibedakan. Pilih cacat paling berdampak yang masih terlihat. Sebutkan lokasinya dan bukti yang akan menunjukkan perbaikannya berhasil.
3. Perbaiki penyebabnya. Uji kembali kasus gagal dan skenario tetangga yang mungkin terdampak. Setelah pola terbukti, terapkan pada layar BMS lain yang menggunakan komponen tersebut dan cek regresinya.
4. Jalankan build, lint/typecheck, dan pengujian yang relevan sesuai repository. Lakukan audit visual terakhir pada normal, alarm, dan data loss. Teruskan pekerjaan setelah build pertama berhasil bila tampilan, interaksi, atau akurasi masih gagal.

**Syarat selesai.** Seluruh alur prioritas lulus, tidak ada temuan terbuka yang menyesatkan operator atau menghalangi penggunaan, dan setiap target performa yang diklaim punya hasil ukur. Bila data sumber atau perangkat uji benar-benar tidak tersedia, selesaikan bagian lain dan tandai pemeriksaan tersebut **belum terverifikasi** beserta bukti yang masih dibutuhkan.

Serahkan **perubahan kode yang dapat dijalankan** beserta lokasi route/komponen dan config tuning, perbandingan visual sebelum/sesudah, hasil uji skenario serta performa, dan sisa keterbatasan yang spesifik. Berikan bukti dan temuan secara ringkas di handoff. Gunakan identifier generik pada screenshot atau rekaman yang akan dibagikan.

# **Optimasi Strategis Tenaga Kerja dan Operasional Keuangan Pusat Data: Kerangka Algoritmik Lanjutan untuk Infrastruktur Kritis di Indonesia**

## **Ringkasan Eksekutif**

Stabilitas operasional pusat data dengan ketersediaan tinggi—khususnya fasilitas Tier III dan Tier IV—sangat bergantung pada orkestrasi presisi antara modal manusia dan sumber daya keuangan. Seiring dengan percepatan ekonomi digital, pengelolaan infrastruktur kritis telah bertransisi dari disiplin teknis murni menjadi ilmu keuangan dan operasional yang kompleks. Laporan ini menyajikan analisis mendalam mengenai strategi optimasi tenaga kerja tingkat lanjut yang disesuaikan secara khusus untuk pasar Indonesia, mengintegrasikan kepatuhan regulasi yang ketat dengan tuntutan operasional berkinerja tinggi.

Penelitian ini berfokus pada empat domain yang saling berhubungan: pengembangan kerangka kerja algoritmik komparatif untuk pola shift (model 12 jam vs. 8 jam) yang berakar pada Peraturan Pemerintah Nomor 35 Tahun 2021; derivasi formula 'Biaya Pergantian Karyawan' (*Cost of Turnover*) yang terperinci yang mengukur kebocoran finansial tersembunyi dari pelatihan dan peningkatan produktivitas dalam peran teknik; desain arsitektur logika 'Pembuatan Narasi Dinamis' (*Dynamic Narrative Generation*) untuk mengotomatisasi pelaporan eksekutif; dan konseptualisasi UI/UX 'Simulasi Skenario' untuk memfasilitasi pengambilan keputusan waktu nyata (*real-time*).

Dengan mensintesis data dari laporan pengeluaran operasional (OPEX), profil pengeluaran modal (CAPEX), dan standar kepatuhan tenaga kerja, dokumen ini memberikan cetak biru untuk mengubah data operasional mentah menjadi intelijen strategis yang dapat ditindaklanjuti. Kerangka kerja yang diusulkan bertujuan untuk meminimalkan risiko kepatuhan, mengoptimalkan pengeluaran tenaga kerja—yang saat ini menyumbang sekitar 30,1% dari OPEX fasilitas—dan meningkatkan ketahanan lingkungan kritis melalui perencanaan tenaga kerja berbasis data.

## ---

**1\. Arsitektur Algoritmik: Analisis Komparatif Pola Shift dalam Konteks Regulasi Ketenagakerjaan Indonesia**

Pemilihan jadwal shift dalam fasilitas operasi berkelanjutan 24/7 merupakan masalah optimasi multivariat yang melibatkan biaya, kepatuhan hukum, manajemen kelelahan (*fatigue management*), dan kontinuitas operasional. Dalam konteks Indonesia, optimasi ini dibatasi oleh undang-undang ketenagakerjaan yang ketat yang mendikte perhitungan lembur, periode istirahat, dan jam kerja maksimum. Bagian ini mengembangkan algoritma komparatif untuk model shift 8 jam versus 12 jam, mengintegrasikan pengali keuangan spesifik yang dimandatkan oleh hukum Indonesia.

### **1.1 Parameter Regulasi dan Kendala Keras (PP 35/2021)**

Landasan dari setiap algoritma pola shift di Indonesia haruslah *Omnibus Law* Cipta Kerja dan turunannya, khususnya **Peraturan Pemerintah Nomor 35 Tahun 2021 (PP 35/2021)** tentang Perjanjian Kerja Waktu Tertentu, Alih Daya, Waktu Kerja dan Waktu Istirahat, dan Pemutusan Hubungan Kerja. Algoritma harus memperlakukan peraturan ini sebagai kendala keras (*hard constraints*) yang tidak dapat dilanggar dalam simulasi biaya.

**Kendala Hukum Inti untuk Input Algoritmik:**

1. **Jam Kerja Standar:**  
   Undang-undang menetapkan dua skema waktu kerja standar:  
   * **6 Hari Kerja:** 7 jam per hari, 40 jam per minggu.  
   * **5 Hari Kerja:** 8 jam per hari, 40 jam per minggu.1 Dalam konteks pusat data yang beroperasi 24/7, skema 5 hari kerja (8 jam/hari) umumnya menjadi dasar perhitungan *Base FTE* (Full-Time Equivalent).  
2. **Ambang Batas Lembur (Overtime Thresholds):**  
   Setiap pekerjaan yang melebihi 40 jam per minggu atau melebihi standar harian (7 atau 8 jam) diklasifikasikan sebagai lembur.  
   * **Maksimum Lembur:** Dibatasi hingga 4 jam per hari dan 18 jam per minggu.3 Ini adalah kendala kritis untuk model shift 12 jam, yang secara inheren membutuhkan 4 jam lembur per shift jika dihitung terhadap *baseline* 8 jam tanpa izin khusus. Pelanggaran terhadap batas ini bukan hanya masalah biaya, tetapi risiko kepatuhan hukum.  
3. **Pengali Kompensasi Lembur (Fungsi Biaya):** Fungsi biaya ![][image1] bersifat non-linear dan sangat bergantung pada jenis hari (hari kerja, hari istirahat mingguan, atau hari libur nasional) serta durasi pekerjaan. Tarif dasar per jam didefinisikan sebagai ![][image2] dari upah bulanan (![][image3]).2  
   * **Lembur pada Hari Kerja Biasa:**  
     * Jam ke-1: ![][image4]  
     * Jam ke-2 dan seterusnya: ![][image5].2  
   * **Lembur pada Hari Istirahat / Libur Nasional (Non-Workday):**  
     * Jam ke-1 s.d. ke-8: ![][image5]  
     * Jam ke-9: ![][image6]  
     * Jam ke-10 dan seterusnya: ![][image7].2

### **1.2 Desain Algoritma 'Shift Comparison'**

Algoritma yang diusulkan membandingkan **Total Biaya Tenaga Kerja (![][image8])**, **Risiko Kelelahan (![][image9])**, dan **Faktor Penyusutan (![][image10])** untuk dua model utama: **Pola Rotasi 4-Grup 12-Jam** (sering disebut pola 2-on, 2-off atau 3-on, 3-off) dan **Pola Rotasi 4-Grup 8-Jam** (Continental atau sistem 3-shift).

#### **1.2.1 Model A: Shift 8 Jam (Sistem Kontinental atau 3-Shift)**

* **Struktur:** 3 shift per hari (Pagi, Sore, Malam) × 8 jam.  
* **Kebutuhan Personil:** Membutuhkan minimal 4 tim untuk mencakup 168 jam/minggu (24/7).  
  * *Siklus Rotasi:* Biasanya 5 hari kerja, 2 hari libur, atau rotasi mundur (Malam-Sore-Pagi).  
* **Jam Dasar:** Setiap karyawan bekerja rata-rata 42 jam/minggu selama satu siklus rotasi penuh (biasanya 4 minggu).  
* **Logika Perhitungan Lembur:**  
  * Jam standar: 40 jam/minggu.  
  * *Built-in Overtime:* 2 jam/minggu (rata-rata).  
  * *Langkah Algoritmik:* Menghitung biaya lembur wajib untuk 2 jam kelebihan tersebut menggunakan pengali 1.5x (jam pertama) dan 2.0x (jam kedua) jika jatuh pada hari kerja, atau pengali yang lebih tinggi jika rotasi memaksa bekerja pada Hari Istirahat Mingguan.

#### **1.2.2 Model B: Shift 12 Jam (Jadwal Terkompresi / Long Shift)**

* **Struktur:** 2 shift per hari (Siang, Malam) × 12 jam.  
* **Kebutuhan Personil:** 4 tim (Tim A, B, C, D).  
* **Jam Dasar:** Karyawan berganti antara minggu 36 jam (3 hari kerja) dan minggu 48 jam (4 hari kerja), dengan rata-rata 42 jam/minggu.  
* **Logika Perhitungan Lembur (Tanpa Izin Khusus):**  
  * **Perhitungan Harian:** Dalam shift 12 jam, jam ke-9, 10, 11, dan 12 secara teknis adalah lembur pada hari kerja standar.  
  * *Pemeriksaan Kendala:* Apakah 4 jam lembur harian melanggar batas 4 jam/hari? Tidak, ini tepat pada batasnya. Apakah melanggar batas 18 jam/minggu? Dalam minggu 4-shift (48 jam total), lembur adalah ![][image11] jam, yang masih patuh (![][image12] jam).  
  * **Implikasi Biaya:** 4 jam lembur harian ini sangat mahal karena struktur tarif progresif.  
    * Jam ke-9: ![][image13]  
    * Jam ke-10 s.d. 12: ![][image14] jam.  
    * *Total Pembayaran OT Harian:* Setara dengan ![][image15] tarif per jam untuk hanya 4 jam kerja tambahan. Ini menciptakan beban biaya yang tidak proporsional dibandingkan output jam kerja.

#### **1.2.3 Formula Biaya Komparatif**

Algoritma menghitung **Total Tagihan Upah Bulanan (![][image16])** untuk setiap model.

Biarkan ![][image17] adalah jumlah staf (misalnya, 23 FTE sesuai laporan OPEX 7). Biarkan ![][image3] adalah gaji pokok bulanan. Biarkan ![][image18] (Pembagi jam standar).

**Untuk Model 8-Jam:**

**![][image19]**  
*Di mana ![][image20] adalah tunjangan shift malam (wajib dalam beberapa perjanjian kerja bersama).*

**Untuk Model 12-Jam:**

**![][image21]**  
**Wawasan Algoritmik Tingkat Lanjut:** Meskipun shift 12 jam tampaknya meningkatkan biaya lembur secara signifikan karena pengali harian 1.5x dan 2.0x, model ini mengurangi *frekuensi* perjalanan dan serah terima (*handover*). Namun, dalam konteks hukum Indonesia, model "Long Shift" biasanya memerlukan **Perjanjian Kerja Bersama (PKB)** yang spesifik untuk menormalkan jam kerja selama satu periode (misalnya, 2 minggu) guna menghindari penalti lembur harian, memperlakukan jadwal tersebut sebagai minggu kerja terkompresi (*compressed workweek*). Tanpa instrumen hukum ini, model 12 jam kira-kira **35–45% lebih mahal** dalam biaya tenaga kerja langsung karena pengali lembur yang agresif untuk jam ke-9 hingga ke-12.8 Algoritma harus memiliki "saklar logika" (*logic switch*) untuk menghitung biaya *dengan* atau *tanpa* izin Long Shift ini.

### **1.3 Integrasi Faktor Penyusutan (Shrinkage Factor)**

Banyak model ketenagaan gagal karena mengabaikan *Shrinkage*—waktu di mana staf dibayar tetapi tidak tersedia untuk bekerja (cuti sakit, liburan, pelatihan). Untuk operasi kritis seperti pusat data Tier III/IV, cakupan 24/7 bersifat mutlak.

**Formula Algoritma Shrinkage:**

**![][image22]**  
Berdasarkan standar industri pusat data global dan data pembanding 9:

* **Libur Nasional:** \~15 hari/tahun (Indonesia).  
* **Cuti Tahunan:** 12 hari/tahun.  
* **Sakit:** Rata-rata 5-8 hari/tahun.  
* **Pelatihan:** Wajib untuk sertifikasi (CDFOM, K3 Listrik) \~5-10 hari/tahun.  
* **Total Absensi Terencana:** \~40-45 hari/tahun (sekitar 17-20% dari hari kerja).

**Implikasi pada Kebutuhan Staf:** Jika algoritma dasar menyarankan 4 tim (misalnya 4 orang per shift \= 16 orang total), *shrinkage* sebesar 20% berarti Anda memerlukan ![][image23] orang untuk menjamin kehadiran 4 orang setiap saat tanpa lembur paksa. Oleh karena itu, algoritma harus secara otomatis menambahkan **Faktor Penyangga (*Buffer Factor*)** sebesar 1.25x ke jumlah FTE dasar untuk mempertahankan SLA waktu operasional (Uptime SLA) 99.995% pada fasilitas Tier IV.7

### **1.4 Analisis Kelelahan dan Risiko (Fatigue Analysis Logic)**

Algoritma juga harus mengeluarkan **Skor Risiko (![][image24])** berdasarkan penanda kelelahan biologis dan operasional.

* **Risiko Serah Terima (*Handover Risk*):** Shift 8 jam melibatkan 3 kali serah terima per hari. Shift 12 jam hanya melibatkan 2 kali. Serah terima adalah jendela risiko tinggi untuk kehilangan informasi (misalnya, status pendinginan, alarm BMS yang dibungkam) di pusat data.  
  * Formula Risiko: ![][image25] (Model 12 jam lebih unggul di sini).  
* **Penurunan Kognitif (*Cognitive Decline*):** Penelitian menunjukkan kinerja kognitif turun secara signifikan setelah 10 jam kerja berturut-turut.11 Dalam lingkungan kritis di mana kesalahan manusia (*human error*) menyumbang mayoritas *downtime*, ini adalah variabel vital.  
  * Formula Risiko: ![][image26] (berdasarkan risiko cedera 38% lebih tinggi pada shift panjang).11

**Kesimpulan untuk Algoritma:** Logika harus merekomendasikan shift 12 jam *hanya jika* dua kondisi terpenuhi:

1. Perjanjian kerja terkompresi (PKB Long Shift) secara hukum layak untuk memitigasi biaya OT yang melambung.  
2. Fasilitas memiliki sistem pemantauan otomatis yang kuat (seperti **DatahallAI** yang disebutkan dalam portofolio 7) untuk memitigasi kesalahan manusia akibat kelelahan pada jam ke-11 dan ke-12. Jika tidak, model 8 jam tetap menjadi *baseline* optimal secara biaya dan risiko untuk konteks Indonesia.

## ---

**2\. Pemodelan Keuangan Lanjutan: Formula 'Cost of Turnover' (CoT)**

Laporan OPEX menyoroti biaya staf sebesar **$490,879** untuk 23 FTE (![][image27] dari total OPEX).7 Meskipun biaya gaji langsung terlihat jelas, biaya pergantian karyawan (*turnover*) adalah kebocoran OPEX yang sering tersembunyi namun masif. Peran teknis tinggi seperti Insinyur Pusat Data (*Data Center Engineers* \- DCE) memiliki kurva pembelajaran yang curam dan biaya penggantian yang tinggi. Bagian ini mendefinisikan formula CoT yang komprehensif.

### **2.1 Formula CoT Komprehensif**

Formula standar seringkali hanya melihat biaya rekrutmen. Untuk infrastruktur kritis, formula harus mencakup seluruh siklus hidup karyawan:

![][image28]  
Di mana:

1. ![][image29] **(Biaya Pemisahan):** Termasuk pembayaran pesangon (*severance pay*) di bawah UU Cipta Kerja (sekitar 1–2 bulan gaji per tahun masa kerja tergantung alasan pemisahan), waktu administrasi keluar, dan pembayaran cuti yang masih harus dibayar.2  
2. ![][image30] **(Biaya Kekosongan):** Biaya untuk menutupi peran yang kosong.  
   * Formula: ![][image31].  
   * *Catatan:* Dalam lingkungan dengan staf minimal (misalnya, 23 FTE untuk cakupan 24/7), kekosongan satu posisi *memaksa* terjadinya lembur bagi staf lain, yang memicu pengali mahal 2x/3x/4x seperti dibahas di Bagian 1.1.  
3. ![][image32] **(Biaya Rekrutmen):** Biaya agensi (biasanya 15–20% dari gaji tahunan untuk peran teknis), iklan lowongan, dan waktu manajemen untuk wawancara (![][image33]).  
4. ![][image34] **(Biaya Onboarding & Pelatihan):**  
   * Langsung: Biaya sertifikasi wajib (CDFOM, ATD, Ahli K3 Listrik).  
   * Tidak Langsung: Waktu pelatih (*Trainer time*).  
   * Formula: ![][image35].  
5. ![][image36] **(Kerugian Produktivitas \- Kurva *Ramp-Up*):** Ini adalah biaya tersembunyi yang paling signifikan. Seorang insinyur baru beroperasi pada utilitas fraksional selama periode *ramp-up*.

### **2.2 Logika Kurva *Ramp-Up* Peran Teknis**

Untuk Insinyur Pusat Data, produktivitas penuh (![][image37]) jarang dicapai segera. Berdasarkan benchmark industri perangkat lunak dan teknik 12, "Kurva Ramp-Up" dapat dimodelkan sebagai fungsi bertahap dari waktu (![][image38] dalam bulan):

* **Bulan 1 (Orientasi & Kepatuhan):** ![][image39]. (Beban bersih: membutuhkan pengawasan penuh, tidak bisa melakukan switching mandiri).  
* **Bulan 2–3 (Eksekusi Tugas Dasar):** ![][image40]. (Dapat melakukan PM dasar seperti inspeksi visual filter atau pencatatan parameter, namun tidak untuk intervensi kritis).  
* **Bulan 4–6 (Kemandirian Terbatas):** ![][image41]. (Mandiri pada tugas rutin, diawasi pada tugas kritis seperti *generator load bank testing*).  
* **Bulan 6+ (Kompetensi Penuh):** ![][image42].

**Formula Kerugian Produktivitas:**

**![][image43]**  
*Aplikasi:* Jika seorang DCE berpenghasilan $1,000/bulan, dan kurva *ramp-up* adalah 6 bulan:

* Kerugian Gaji Bulan 1: $1,000 (100% loss).  
* Kerugian Gaji Bulan 2-3: $1,500 (75% loss ![][image44] 2).  
* Kerugian Gaji Bulan 4-6: $750 (25% loss ![][image44] 3).  
* **Total ![][image36]:** $3,250 per perekrutan (setara dengan 3.25 bulan gaji penuh yang "hilang").

### **2.3 Integrasi Risiko (![][image45]) dan Solusi 'Smart Hands'**

Dalam fasilitas Tier IV (Skenario B dalam laporan CAPEX), kesalahan manusia menyebabkan *downtime*. Karyawan baru memiliki tingkat kesalahan statistik yang lebih tinggi.

![][image46]  
Di mana ![][image47] adalah peningkatan probabilitas kesalahan selama masa percobaan. Mengingat biaya *downtime* dapat melebihi $1 Juta 13, bahkan peningkatan risiko 0.01% mewakili kewajiban finansial yang nyata.

**Variabel 'Smart Hands' (Pihak Ketiga):** Formula CoT juga harus mempertimbangkan opsi **Smart Hands** sebagai alternatif penempatan staf penuh waktu. Layanan Smart Hands 14 memungkinkan tugas-tugas fisik (seperti *racking*, *cabling*, *reset* server) dilakukan oleh teknisi *on-site* pihak ketiga dengan model biaya per-tiket atau per-jam.

* *Logika Keputusan:* Jika ![][image48] untuk satu peran internal \> Biaya Kontrak Tahunan Smart Hands untuk cakupan setara, maka alihkan peran non-kritis ke model *Outsourced/Smart Hands*. Ini relevan untuk tugas-tugas dengan frekuensi tinggi namun kompleksitas rendah yang membebani insinyur internal dan menyebabkan *burnout*.

### **2.4 Kesimpulan Eksekutif tentang Turnover**

Mengganti seorang Insinyur Pusat Data khusus di Indonesia memerlukan biaya sekitar **150% hingga 200% dari gaji tahunan** mereka ketika memfaktorkan mandat pesangon spesifik, biaya rekrutmen, dan kurva pembelajaran tinggi untuk sistem canggih seperti "Direct Liquid Cooling" (Skenario B).16 Laporan yang menyebutkan keberhasilan mengurangi turnover dari 64% menjadi 9% 7 mewakili penghematan OPEX implisit yang masif, kemungkinan dalam kisaran ratusan ribu dolar, jauh melebihi anggaran "Pelatihan" yang terlihat sebesar $37,274.7

## ---

**3\. Operasional Pemeliharaan & Variabel Lingkungan: Integrasi Standar SFG20 dan Kualitas Udara**

Untuk menghasilkan laporan otomatis yang akurat, sistem harus mengintegrasikan standar pemeliharaan baku dan variabel lingkungan lokal yang dinamis. Bagian ini merinci logika untuk penjadwalan pemeliharaan berdasarkan standar SFG20 dan dampak kualitas udara (AQI) terhadap frekuensi penggantian filter.

### **3.1 Integrasi Standar SFG20 untuk Penjadwalan Tugas**

SFG20 adalah standar industri untuk spesifikasi pemeliharaan bangunan yang menyediakan daftar tugas terstruktur dan estimasi jam kerja (*man-hours*).17 Menggunakan standar ini dalam algoritma memberikan basis data yang objektif untuk menghitung kebutuhan tenaga kerja (FTE) pemeliharaan.

**Daftar Tugas Kritis & Estimasi Jam Kerja (Berdasarkan Logika SFG20):**

| Aset | Tugas Kritis (Merah/Statutori) | Tugas Optimal (Amber/Fungsional) | Frekuensi Standar | Estimasi Durasi/Tugas |
| :---- | :---- | :---- | :---- | :---- |
| **Genset Diesel (2.4 MW)** | Uji beban (*load bank*), cek bahan bakar, inspeksi kebocoran | Analisis oli, pembersihan radiator, cek getaran | Bulanan \+ 6 Bulan (Mayor) | 4 jam (Bulanan) / 12 jam (6-Bln) |
| **UPS (Modular 1150 kVA)** | Uji baterai (*discharge*), cek kapasitor, termografi IR | Pembersihan debu internal, update firmware, cek torsi koneksi | Kuartalan | 6 jam per modul |
| **Chiller (Water Cooled)** | Analisis air (Legionella), cek refrigeran, inspeksi pompa | Pembersihan *tube* kondensor, kalibrasi sensor suhu | Bulanan | 8 jam per unit |
| **Fire System (FM200)** | Cek tekanan silinder, uji fungsi panel kontrol | Tes integritas ruangan (*room integrity test*), pembersihan nozzle | Semesteran | 16 jam (sistem penuh) |
| **LV Switchgear** | Inspeksi *circuit breaker*, cek interlock mekanis | Pembersihan busbar, uji resistansi kontak | Tahunan | 24 jam (shutdown parsial) |

**Penerapan dalam Algoritma:**

Algoritma harus menjumlahkan total jam kerja tahunan berdasarkan inventaris aset (misal: 2 Genset, 4 UPS, 3 Chiller) dan frekuensi SFG20.

![][image49]  
Hasil ini kemudian dibagi dengan jam kerja efektif per FTE (memperhitungkan *shrinkage*) untuk menentukan apakah tim 5 orang (MTL \+ Teknisi) 7 cukup atau kurang.

### **3.2 Algoritma Multiplier Umur Filter Berbasis Kualitas Udara (AQI)**

Indonesia, khususnya area Jabodetabek, sering mengalami tingkat polusi udara (PM2.5) yang tinggi. Filter udara pusat data (MERV 13/14 atau HEPA) memiliki umur pakai yang berbanding terbalik dengan beban partikulat. Algoritma standar yang menggunakan interval waktu tetap (misal: ganti setiap 3 bulan) seringkali tidak efisien atau berisiko.

**Logika Multiplier Dinamis:**

Kami mengusulkan formula pengali umur filter (![][image50]) berdasarkan rata-rata AQI lokal:

![][image51]

* **AQI Baseline:** Standar desain (misal: AQI 50, udara bersih).  
* **AQI Actual:** Rata-rata bergerak (*moving average*) dari sensor kualitas udara luar ruangan.

**Skenario:**

Jika rata-rata AQI di lokasi adalah 150 (Unhealthy), dan baseline adalah 50:

![][image52]  
Artinya, filter yang dijadwalkan bertahan 90 hari akan jenuh dalam ![][image53] hari.

**Integrasi Algoritmik:** Sistem 'Dynamic Narrative' harus memantau data AQI. Jika ![][image54], sistem otomatis memperbarui jadwal pemeliharaan dan narasi laporan: *"Berdasarkan rata-rata AQI 150 bulan ini, estimasi umur filter unit CRAC telah direvisi dari 90 hari menjadi 30 hari. Disarankan pembelian stok filter darurat segera untuk mencegah penurunan tekanan statis."*.18

## ---

**4\. Logika 'Dynamic Narrative Generation' untuk Laporan Otomatis**

Untuk mengubah data mentah (misal: "PUE 1.50") menjadi wawasan eksekutif ("Efisiensi pendinginan suboptimal, potensi penghematan $45k"), kita memerlukan mesin **Dynamic Narrative Generation (DNG)**. Mesin ini menggunakan gerbang logika dan tolok ukur komparatif untuk merakit paragraf yang koheren.

### **4.1 Lapisan Ingesti Data dan Benchmarking**

Mesin pertama-tama menyerap variabel kunci dari kalkulator:

1. **Metrik:** ![][image55] (misal: Rasio Biaya Pemeliharaan \= 10.7%).  
2. **Tolok Ukur:** ![][image56] (misal: Standar Industri \= 15–20% 7).  
3. **Varians:** ![][image57].  
4. **Konteks:** Tier Fasilitas (Tier 3), Lokasi (Indonesia).

### **4.2 Pohon Logika Narasi (Logic Trees)**

Logika pembuatan menggunakan **Pemetaan Sentimen Bersyarat**. Berikut adalah *pseudo-code* untuk bagian "Pemeriksaan Kesehatan Pemeliharaan":

**Variabel:** Maintenance\_Ratio (MR)

**Ambang Batas:**

* Critical\_Low: \< 10%  
* Risk\_Low: 10% – 14.9%  
* Optimal: 15% – 20%  
* Excessive: \> 25%

**Alur Logika:**

1. **JIKA** MR masuk dalam kategori Risk\_Low (Aktual 10.7%):  
   * *Pilih Sentimen:* "Peringatan/Penghindaran Risiko".  
   * *Pilih Frasa Kunci:* "Kurang Investasi (*Under-investment*)", "Pemeliharaan Tertunda", "Risiko Reaktif."  
   * *Konstruksi Kalimat A:* "Pengeluaran pemeliharaan saat ini berada pada {MR}, yang berada di bawah ambang batas rekomendasi industri sebesar {Optimal\_Min}%."  
   * *Konstruksi Kalimat B (Implikasi):* "Struktur keuangan ini menyarankan potensi ketergantungan pada perbaikan reaktif daripada strategi preventif, meningkatkan risiko *downtime* tak terencana."  
   * *Konstruksi Kalimat C (Rekomendasi):* "Alokasi anggaran segera menuju {System\_Name} (misal: Genset OH) disarankan untuk menyelaraskan dengan standar Tier {Tier\_Level}."  
2. **Injeksi Konteks Dinamis:**  
   * Mesin memeriksa item baris spesifik. Jika "Pemeliharaan Genset" tinggi ($40k) tetapi "Suku Cadang" rendah ($41k), ia menambahkan: *"Meskipun kontrak layanan aktif, inventaris suku cadang kritis di lokasi mungkin tidak mencukupi untuk pemulihan segera (MTTR)."*

### **4.3 Otomatisasi "Penilaian Eksekutif"**

Menggunakan data dari Laporan OPEX 7:

* **Input:** Staf \= 23 FTE, Kepadatan \= 23 FTE/MW. Tolok Ukur \= 12–15 FTE/MW.  
* **Narasi yang Dihasilkan:** "Kepadatan staf sebesar 23.0 FTE/MW berada **di atas kisaran tipikal** untuk fasilitas Tier 3\. Dengan biaya $490,879/MW, ini mewakili peluang optimasi utama. Tindakan yang direkomendasikan mencakup evaluasi **konsolidasi peran** antara tim teknis Elektrikal dan Mekanikal atau transisi peran non-kritis (Keamanan/Kebersihan) ke model **Outsourced** untuk mengurangi *overhead* tetap."

Logika ini mengubah "Skor: 0/100" yang statis 7 menjadi peta jalan kualitatif tanpa intervensi manusia.

## ---

**5\. Desain UI/UX: 'Scenario Simulation' untuk Penempatan Staf**

Fitur 'Scenario Simulation' adalah alat pendukung keputusan yang dirancang untuk **Kalkulator OPEX Pusat Data**. Alat ini memungkinkan pengguna memodelkan skenario "Bagaimana-Jika" (*What-If*) mengenai kepatuhan tenaga kerja, model shift, dan struktur biaya.

### **5.1 Arsitektur Komponen UI**

Berdasarkan analisis alat yang ada 7, fitur simulasi baru harus terintegrasi secara mulus ke dalam estetika "Glassmorphism" (latar belakang buram, gradien biru tua).

* **Dasbor Simulasi:** Tata letak layar terbagi (*split-screen*).  
  * **Panel Kiri (Kontrol):** Slider dan Toggle untuk variabel input.  
  * **Panel Kanan (Visualisasi Langsung):** Grafik dinamis (Chart.js) yang diperbarui secara waktu nyata.

### **5.2 Fitur Input Fungsional**

1. **Toggle Pola Shift (Shift Pattern Toggle):**  
   * *Opsi A:* 3-Shift (8 Jam) – Kepatuhan Standar.  
   * *Opsi B:* 2-Shift (12 Jam) – Minggu Terkompresi.  
   * *Interaksi:* Mengaktifkan '12 Jam' memicu modal "Peringatan Kepatuhan" jika kotak centang 'Izin Long Shift' tidak dipilih, memperingatkan pengguna tentang potensi kewajiban lembur harian di bawah PP 35/2021.  
2. **Slider Model Penempatan Staf (Staffing Model Slider):**  
   * *Rentang:* 100% In-House \<-\> 100% Outsourced (Smart Hands).  
   * *Logika:* Menggerakkan slider menyesuaikan rasio "Biaya Tetap" vs. "Biaya Variabel".  
   * *Umpan Balik Visual:* Saat pengguna menggeser ke arah "Outsourced", grafik batang "Kewajiban/Risiko Pesangon" menurun, tetapi batang "Biaya Layanan Bulanan" meningkat. Ini memvisualisasikan *trade-off* antara CAPEX (biaya rekrutmen) dan OPEX (biaya layanan).  
3. **Uji Stres Atrisi (Attrition Stress Test):**  
   * *Input:* "Tingkat Turnover yang Diharapkan" (Bidang input, default 9%).  
   * *Simulasi:* Pengguna meningkatkan turnover menjadi 25%.  
   * *Output:* Dasbor secara dinamis menghitung **Total Biaya Turnover** (menggunakan formula dari Bagian 2\) dan menambahkan lapisan "Hidden OPEX" ke grafik Total Biaya Kepemilikan (TCO).

### **5.3 Visualisasi Output (Aspek 'Dinamis')**

* **Peta Panas (Heatmaps):** Sebuah "Shift Coverage Heatmap" yang menunjukkan zona risiko. Jika shift 12 jam dipilih hanya dengan 3 tim, peta panas berubah menjadi merah pada akhir pekan, menunjukkan pelanggaran "Lembur Wajib \> 18 jam/minggu".  
* **Metrik Delta:** Menampilkan ![][image58] (Perubahan) antara 'Keadaan Saat Ini' dan 'Keadaan Tersimulasi'.  
  * *Contoh:* "Beralih ke Hybrid Staffing menghemat **$45,000/thn** tetapi meningkatkan overhead Manajemen Vendor sebesar **15%**."

### **5.4 Alur Interaksi UX**

1. **Entri Pengguna:** Pengguna memilih "Mode Skenario" dari Bagian Hero utama.  
2. **Seleksi Baseline:** Pengguna memuat "Indonesia Tier 3 Baseline" (mengambil data UMK, tarif listrik, dll.).  
3. **Manipulasi:** Pengguna menyesuaikan "Pemeliharaan Genset" dari 'Bulanan' ke 'Kuartalan'.  
4. **Umpan Balik Instan:**  
   * OPEX menurun sebesar $12,000.  
   * **Meteran Risiko** (komponen pengukur) bergerak dari "Rendah" ke "Moderat" (Kuning), memicu *tooltip*: *"Pemeliharaan kuartalan mungkin membatalkan garansi pabrikan untuk Caterpillar C175-16 dan tidak sesuai dengan rekomendasi SFG20."*  
5. **Ekspor:** Pengguna mengklik "Hasilkan Laporan Narasi," memanfaatkan logika dari Bagian 3 untuk menghasilkan ringkasan PDF dari simulasi tersebut.

## ---

**6\. Kesimpulan**

Optimasi tenaga kerja dan anggaran operasional pusat data bukan sekadar latihan pemotongan biaya; ini adalah keseimbangan antara **efisiensi finansial, kepatuhan regulasi, dan ketahanan operasional**.

**Algoritma Pola Shift** menunjukkan bahwa meskipun shift 12 jam menawarkan manfaat kontinuitas, mereka membawa premi finansial yang berat di Indonesia karena tarif lembur progresif (1.5x, 2x, 3x, 4x) kecuali dikelola melalui perjanjian "Long Shift" khusus. Tanpa perjanjian ini, model 8 jam tetap lebih unggul secara finansial.

**Formula Biaya Turnover** mengungkapkan bahwa biaya sebenarnya dari kehilangan seorang Insinyur Pusat Data hampir dua kali lipat gaji tahunan mereka ketika memperhitungkan pesangon, biaya rekrutmen, dan kurva produktivitas. Ini memvalidasi ROI tinggi dari program retensi dan strategi "Smart Hands" untuk peran non-inti.

Dengan menanamkan logika finansial ini ke dalam **Mesin Narasi Dinamis** dan **UI Simulasi Skenario**, manajer fasilitas dapat beralih dari pelacakan reaktif ke pemodelan prediktif. Hal ini mentransisikan Laporan OPEX dari sekadar tanda terima pengeluaran masa lalu menjadi alat strategis untuk ketahanan masa depan, secara langsung menangani skor "Biaya Tinggi / Efisiensi Rendah" yang diidentifikasi dalam analisis *benchmark*.

### ---

**Daftar Tabel dan Struktur Data**

**Tabel 1: Pengali Biaya Lembur (Hari Kerja vs. Hari Libur Indonesia \- PP 35/2021)**

| Skenario | Jam ke-1 | Jam ke-2 s.d. ke-8 | Jam ke-9 | Jam ke-10+ |
| :---- | :---- | :---- | :---- | :---- |
| **Lembur Hari Kerja** | 1.5x | 2.0x | 2.0x | 2.0x |
| **Hari Istirahat / Libur** | 2.0x | 2.0x | 3.0x | 4.0x |
| **Dampak Shift 12-Jam** | N/A | Biaya Tinggi | Sangat Tinggi | Ekstrem |

**Tabel 2: Analisis Komponen Biaya Turnover (CoT)**

| Komponen | Deskripsi | Estimasi Dampak (Peran Engineer) |
| :---- | :---- | :---- |
| **Pemisahan (![][image29])** | Pesangon (UU Cipta Kerja), Pencairan Cuti | 15–20% dari Gaji Tahunan |
| **Kekosongan (![][image30])** | Cakupan lembur staf tersisa (Pengali OT Tinggi) | 10–15% (Risiko Burnout) |
| **Rekrutmen (![][image32])** | Biaya agensi, pemeriksaan latar belakang | 20% dari Gaji Tahunan |
| **Produktivitas (![][image36])** | Kurva Ramp-up 6 Bulan (Integral kerugian) | 25–30% dari Gaji Tahunan |
| **Risiko (![][image45])** | Human Error / Probabilitas Downtime | Variabel (Dampak Tinggi di Tier IV) |
| **TOTAL** |  | **\~150–200% dari Gaji Pokok** |

**Tabel 3: Pemetaan Logika untuk Pembuatan Narasi Dinamis**

| Metrik Input | Kondisi Ambang Batas | Sentimen Narasi yang Dihasilkan | Rekomendasi yang Dapat Ditindaklanjuti |
| :---- | :---- | :---- | :---- |
| **Rasio Maint.** | \< 15% | Peringatan / Risiko Tinggi | "Tingkatkan Anggaran PM segera sesuai SFG20." |
| **Kepadatan Staf** | \> 20 FTE/MW | Tidak Efisien / Biaya Tinggi | "Audit peran untuk konsolidasi atau outsourcing." |
| **PUE** | \> 1.6 | Sub-optimal | "Investasi dalam optimasi pendinginan (CRAH/Chiller)." |
| **Turnover** | \> 15% | Instabilitas Kritis | "Tinjau strategi retensi/keterlibatan karyawan." |
| **AQI Lokal** | \> 150 (Unhealthy) | Risiko Lingkungan | "Tingkatkan frekuensi ganti filter (Multiplier 0.33x)." |

**Tabel 4: Variabel Input UI Simulasi Skenario**

| Kategori | Variabel | Target Dampak |
| :---- | :---- | :---- |
| **Staf** | Jumlah FTE, Rasio (In-House/Outsourced) | Biaya Tenaga Kerja Tetap, Liabilitas Pesangon |
| **Jadwal** | 8h vs 12h, Pola Rotasi, Izin Long Shift | Biaya OT Variabel, Risiko Kelelahan |
| **Kebijakan** | Kenaikan Upah %, Turnover %, Shrinkage % | Proyeksi TCO Masa Depan |
| **Teknis** | Target PUE, Frekuensi Maint. (SFG20), AQI | Tagihan Energi, Profil Risiko Aset |

---

**Akhir Laporan.**

*Catatan: Semua angka keuangan dan spesifikasi teknis yang dirujuk dalam laporan ini diturunkan dari laporan CAPEX/OPEX yang diunggah (tertanggal 17 Feb 2026\) dan cuplikan penelitian terkait mengenai hukum ketenagakerjaan Indonesia dan praktik terbaik pusat data.*

#### **Works cited**

1. Indonesia Overtime Regulations 2024: Complete HR Compliance Guide, accessed February 17, 2026, [https://www.sailglobal.com/blog/indonesia-overtime-management-guide-en](https://www.sailglobal.com/blog/indonesia-overtime-management-guide-en)  
2. Rights of Employees Engaged in Overtime in Indonesia \- Schinder Law Firm, accessed February 17, 2026, [https://schinderlawfirm.com/blog/rights-of-employees-engaged-in-overtime-in-indonesia/](https://schinderlawfirm.com/blog/rights-of-employees-engaged-in-overtime-in-indonesia/)  
3. Working conditions & Working hours in Indonesia | L\&E Global, accessed February 17, 2026, [https://leglobal.law/countries/indonesia/employment-law/employment-law-overview-indonesia/working-conditions-in-indonesia/](https://leglobal.law/countries/indonesia/employment-law/employment-law-overview-indonesia/working-conditions-in-indonesia/)  
4. Understanding Labour Law & Employment Regulations in Indonesia, accessed February 17, 2026, [https://indonesia.acclime.com/guides/employment-law/](https://indonesia.acclime.com/guides/employment-law/)  
5. Understanding Indonesia Overtime Rate and Law \- Blog Gadjian, accessed February 17, 2026, [https://www.gadjian.com/blog/2024/08/30/indonesia-overtime-rate-law-rules/](https://www.gadjian.com/blog/2024/08/30/indonesia-overtime-rate-law-rules/)  
6. Indonesia Working Hours & Overtime Regulations \- Playroll, accessed February 17, 2026, [https://www.playroll.com/working-hours/indonesia](https://www.playroll.com/working-hours/indonesia)  
7. OPEX Report — February 17, 2026.pdf  
8. Working 12 Hours a Day? Learn What a Long Shift Is and How to Calculate the Pay \- ESB, accessed February 17, 2026, [https://www.esb.id/en/inspirasi/long-shift](https://www.esb.id/en/inspirasi/long-shift)  
9. How to Calculate and Reduce Call Center Shrinkage Effectively \- Sprinklr, accessed February 17, 2026, [https://www.sprinklr.com/blog/call-center-shrinkage/](https://www.sprinklr.com/blog/call-center-shrinkage/)  
10. What is Call Centre Shrinkage and How to Calculate It?, accessed February 17, 2026, [https://www.callcentrehelper.com/how-to-calculate-contact-centre-shrinkage-90353.htm](https://www.callcentrehelper.com/how-to-calculate-contact-centre-shrinkage-90353.htm)  
11. Long shifts in data centers — time to reconsider? \- Uptime Institute Blog, accessed February 17, 2026, [https://journal.uptimeinstitute.com/long-shifts-in-data-centers-time-to-reconsider/](https://journal.uptimeinstitute.com/long-shifts-in-data-centers-time-to-reconsider/)  
12. Benchmarking 2025: What's a 'Good' Employee Productivity Score for Software Engineering Teams? | Worklytics, accessed February 17, 2026, [https://www.worklytics.co/resources/software-engineering-productivity-benchmarks-2025-good-scores](https://www.worklytics.co/resources/software-engineering-productivity-benchmarks-2025-good-scores)  
13. Preventive maintenance standards for data centers \- ProSource, accessed February 17, 2026, [https://www.team-prosource.com/preventive-maintenance-standards-for-data-centers/](https://www.team-prosource.com/preventive-maintenance-standards-for-data-centers/)  
14. Colocation Data Center Smart Hands: When Do I Need Them? \- Lightyear, accessed February 17, 2026, [https://lightyear.ai/blogs/colocation-data-center-smart-hands-when-do-i-need-them](https://lightyear.ai/blogs/colocation-data-center-smart-hands-when-do-i-need-them)  
15. Smart Hands \- On-Site Responsive Technical Support \- Stream Data Centers, accessed February 17, 2026, [https://www.streamdatacenters.com/resource-library/glossary/smart-hands/](https://www.streamdatacenters.com/resource-library/glossary/smart-hands/)  
16. How to Calculate Employee Turnover Cost in HR \- HRBench, accessed February 17, 2026, [https://www.hrbench.com/resource/learn/cost-of-turnover](https://www.hrbench.com/resource/learn/cost-of-turnover)  
17. What Is SFG20, accessed February 17, 2026, [https://www.sfg20.co.uk/what-is-sfg20](https://www.sfg20.co.uk/what-is-sfg20)  
18. AIR PURIFIER PARTICLE FILTER LIFETIME EVALUATION ALGORITHM FIT FOR OUTDOOR PM2.5 LOW CONCENTRATIONS SITUATION, accessed February 17, 2026, [http://www.upubscience.com/upload/20241205102515.pdf](http://www.upubscience.com/upload/20241205102515.pdf)  
19. Performance Based Air Filter Change Out Frequencies for Building Air Handlers Serving Office Space and Light Labs \- ResearchGate, accessed February 17, 2026, [https://www.researchgate.net/profile/Peter-Vorobieff-2/publication/320708748\_Performance-based\_air\_filter\_change\_out\_frequencies\_For\_building\_air\_handlers\_serving\_office\_spaces\_and\_light\_labs/links/5b2dd00ba6fdcc8506c2c216/Performance-based-air-filter-change-out-frequencies-For-building-air-handlers-serving-office-spaces-and-light-labs.pdf](https://www.researchgate.net/profile/Peter-Vorobieff-2/publication/320708748_Performance-based_air_filter_change_out_frequencies_For_building_air_handlers_serving_office_spaces_and_light_labs/links/5b2dd00ba6fdcc8506c2c216/Performance-based-air-filter-change-out-frequencies-For-building-air-handlers-serving-office-spaces-and-light-labs.pdf)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAZCAYAAABU+vysAAAAgElEQVR4Xu2RgQqAMAhE9/8/XQgtxDy5JhstfCC0202PbK0oNucgairMEMaThhnCeFKwv53xpJja/A2/CKLXml5d5rENkelFPbaeaKjWbUivblBD4WG+QLpgg3jf/fzNIFq05YH0DrpH+jCoYRReiO6GQA2XBxHsCtEQxlMUe3ACLltfoeLrC5AAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAXCAYAAACrggdNAAAAtUlEQVR4Xu2PUQrEMAgFe/9L72LBRd5qnEChbciAH43jqx7HZvN6PvqwAo8+ypbzmqHySV50tCoHoyEzqB9/3i2ivczPvvUtZcmjInSAhHeO9jrfIM4fdICEE8cZeZ4zcobQQfIT4jgjb8mjIjOZP8gAcQyyAHEis/4JGSCOQRYgTmTWPyEDxDHIApXj79rL3lJiQBUW6XpZVdC+VosOdINdL6sK2te6jMsDn8A+6i0sedTmDr795p5iVjp9IwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAZCAYAAADJ9/UkAAAAdElEQVR4Xu2Q0QqAMAwD9/8/rexhICFHV5xOpAeFkpUcrLWi2MQhE+WD6H0aKqC8Q3kaklDeoTyNk0RfSnkaJyG5y27hCrfIZ/alkIT2pYxiLf+EXHPH9dYNQkeUO1Smg9AB5YpKaH8MEv5bruVOrjdF8Q4n+nZ5h6eut6MAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK0AAAAYCAYAAACIqH2FAAACNElEQVR4Xu2S7W5DMQhD9/4vvSk/IlkuH4Zk7dZypEkL2A6h9+trGIZhGIbh4/jmwgEr62beEPOxu7758Plon4u06/2jSGIAfd2M23gznMzn+bJM3ktV/yp4jj0L16w5ucd9ldCLDVfkcDrYb2DNc/pGCyVTrXszW/Vn4t0dzebVq4Q52HBFDtHwr8Ka5/SNFkqmWvdmturPxLs7ms2rV5FzJBFQ1SORVx6YUDyKBlH0nobrlXdVdJE26mV43n0n9/l8gzQzFRA4vPeQCEvP5wqKV9EsrNk8FJ2q6exxwfpOBsN+zLTy+XyDNDMVELxk6yERlp7PFRSvollYs3koOlXT2eOC9Z0Mhv2YaeXz+QZpZipIOFl4x8cofkWzqMyj6BQNUtUvbu1xgzmciffcvJNJc1MBwfru0ro+RvErmkVlHkWnaJDOTjqeCMzhzNt3eaT5qYBgffchXR+j+BXNojKPolM0SGcnHU8E5nDm7bs80vxUQLC++hBLy+cKiveWBon0yk6svuJDWFfxekQzRL0NalCb+RBTx6F8wcaqs577EZGukoN4Hp4vm9WrI5zjZXp1hP2ZHsm0US8j8ir3Who8c8/C1PCiosu4znruR0S6Sg7ieXi+bFavjnCOl+nVEfZneiTTRr2MyKvca2nwzD0LRfPvsRalcuIdHsF9WrvlM2Lp35aTx554h0e8j3b/j3+MV39LTh574h0esT5U/H8+WqLz4I9c1B9kfoNhGIZhGBR+AJv8zEIwh8LZAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK0AAAAYCAYAAACIqH2FAAACQUlEQVR4Xu2S4W7DQAiD+/4vvSk/IlkOBnO5ZVvLJ1XqgW3IJa/XMAzDMAzDx/HFhRscWTvzhpyPveudDz4f7bNYd32+FPy5sK/j/QnUDnf2U74qk++lq/8teI9zF65Fe3KP+y6plxudYUqj6k8Q7Y5n7lUovZPp1tXOUf1J1OxsN1XvkuZwI1uIURpVf4Jodzxzr0LpnUy3rnaO6k+iZme7qXqXNIcb2UKM0qg6kmnc+YzjcTSIo1carneeq6PLtFmvQnnPmdzn8w6sTLVQhNKoOhPN4XMHx+toDqLdFI7O1XTuH2H9SgbDfsyM8vm8Ayuzc2lKo+pMNIfPHRyvozmIdlM4OlfTuX+E9SsZDPsxM8rn8w6szGgZprpYVVdUeS6O39EcdPZxdI4G6eoPdt3jCeZwJs7ZOZORuasPq/Sqrlidzzh+R3PQ2cfRORpk5U5WPBmYw5m7Zylk/uoCSq/qitX5jON3NAedfRydo0FW7mTFk4E5nLl7liLMD4svXUeURtWZ6KH53MHx7tIgmd55uVHf8SGs63gV2Q5Z7wQ1qK18SKjjUB5wEtVZz/2MTNfJQZSH96t2VXWEc1SmqiPsr/RIpc16FZnXmRtp8My9iFDDF5UN4zrruZ+R6To5iPLwftWuqo5wjspUdYT9lR6ptFmvIvM6cyMNnrkX4Wj+PdFFudzxDlfwPqO75TMS6d+WOw97xztcUR/t+R9/jKq/JXce9o53uBJ9qPh/Plpi5YE/8qL+IPMOhmEYhmFw+AZLuNA+cgNqOgAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK0AAAAYCAYAAACIqH2FAAACQklEQVR4Xu2S227DMAxD9/8/vcEPBghWlKjEyy7VAQrUEkkpTj4+hmEYhmEY3o5PLtxgZZ3MG3Le9q5PPvh8tM9i3fV+KfhzYV/H+x2oHe7sp3xVJt9LV/9T8B57F65Fe3KP+y6plxudYUqj6k8Q7Y5n7lUovZPp1tXOUf1J1OxsN1XvkuZwI1uIURpVf4Jodzxzr0LpnUy3rnaO6k+iZme7qXqXVk5HrHSqjmSazg6I43E0iKNXGq53nqujy7RZr0J590zu8/kEMhOXiJZRKJ2qM9EsPndwvI5mEe2mcHSupvsONqy/ksGwHzOjfD6fQGbyZUkhoXSqzkSz+NzB8TqaRbSbwtG5mu472LD+SgbDfsyM8vl8AiszWoapLlbVFVWei+N3NIvOPo7O0SBd/eLUPW4whzNxzsmZjJXbeXClUXVFZ2aG43c0i84+js7RIFfu5IonA3M48/QshZXfWUZpVF3RmZnh+B3NorOPo3M0yJU7ueLJwBzOPD1LEeZzsbOM0qg6E83hcwfHe0qDZHrnPqO+40NY1/Eqsh2y3gY1qK18SKjjUBUY9djD/YxM18lBlIf3q3ZVdYRzVKaqI+yv9EilzXoVmdeZG2nwzL2IUMMXFQ1aRD32cD8j03VyEOXh/apdVR3hHJWp6gj7Kz1SabNeReZ15kYaPHMvwtH8eaKLcrnjHV7B+4zuls9IpP+33HnYO97hFfXR7v/4Y1T9X3LnYe94h1eiDxX/z0dLXHngt7yoX8i8g2EYhmEYHL4ARwXSPHdmIWUAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK0AAAAYCAYAAACIqH2FAAACPklEQVR4Xu2SUY7DQAhDe/9L7yofkVwXg5mM0t2WJ0XqgDHONI/HMAzDMAzD1/HDhQscXjv9hpyvveudLz4f7b2077r7B516fN6JynAln5qrPPleuvp3wTnOLFyLcnKP+y72bHeR0qn6HUT58cy9CqV3PN26yhzV70TtzrKpehfbJwsToXSqfgdRfjxzr0LpHU+3rjJH9TtRu7Nsqt6l9EFBKQaUTtWRTNPJgDgzjgZx9ErD9c57dXSZNutVqNlzJ/f5vAPpiQGiMAqlU3Um2sXnDs6sozmIsikcnavBpwPrVzwYnkfPyJ/PO5CeVRiF0qk6E+3icwdn1tEcRNkUjs7V4NOB9SseDM+jZ+TP5x2EnlyMwjDVxaq6ovJzceYdzUEnj6NzNEhXf7DrHk/Qhz1xz86dzJMvvqB6KpRG1RWdnRnOvKM56ORxdI4GWbmTlZkM9GHP3bsUT/64VD0VSqPqis7ODGfe0Rx08jg6R4Os3MnKTAb6sOfuXQrLvxNE6VSdiXbxuYMzu0uDZHrnz436zhzCus6sIsuQ9U5Qg9pqDpE6No5MozrruZ+R6To+iJrhfFVWVUfYR3mqOsLzlR6ptFmvIpt19kYaPHMvQmr4stQyrrOe+xmZruODqBnOV2VVdYR9lKeqIzxf6ZFKm/Uqsllnb6TBM/ciHM2/J7oolyuzwyt4n9Hd8hmJ9B/LlZe9Mju8oj7a8zc+jKp/JFde9srs8Er0oeLv+WiJlRf+yov6g8x/MAzDMAyDwy9SLtg2iWjlMgAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAZCAYAAABD2GxlAAAAhElEQVR4Xu3Q0QqFMAwD0P3/TysbU0pt0jJ9cJADfbhNbhm2JiJlR3Esn6HxfI56Awqjvf3ts0h0w2LZDR2J9ls80E4m67GMYo9A+xXLd7Z4IPLFA9kHKGF/fHV4+sUDWSe7wbKBFSrHWd6hDto/sFJ2JMs71EH74Qr9IL632o9GRESmE9gkfoIri2VnAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAZCAYAAADaILXQAAAAXklEQVR4Xu2QQQoAIAgE+/+niw4FLa4FaUI40GW1KbaU5GvqwblGk1w/ol12k5vUgz2bSAcoNJEziZQh250ncoTlA/apBbawy2PkOJSWcCbN3Uj5hPVvgqu84yqPowG+RF6isFFN4wAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAZCAYAAAAxFw7TAAAAYUlEQVR4Xu2QQQrAMAgE/f+nk0sLkjiaGMmlHdjLiiMo8qNoKiWUCkdJWk5L1IfQIvUhtEh9iP6VTppRdCy0WBF7s4m00CwfSOgeM0vx+/tCChHNt/mIcOW3W5QLX8qFd+gHs1GveDh3cQAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAXCAYAAABkrDOOAAAA9klEQVR4Xu2QUQ6EMAgFvf+ld6OxRkfkQaNpP5iExC4Dfd1lKYqiKIoixW+vkcyQYaXlUFnOXsTfSMkfMVMGfluwp/yDmR46QwZ+W7Cn/NTyM56X2bPSm+FrVBavd4OyWk4sn2cFfWvnKFSW1meZsOHKBpbPs4K+tXMUKgv/ZNdnw5Ud5EUOnOnZw8eqivLkP+2yfrtdblWGnjneZ1UUzqmKonz2TJ+XW5WhZ473WRWFc6qiKJ895R+8FYbnDD0ZvkRlYU/5lwdmHus50R0N3p2dfxNm8LLQ8dwNinJgx3OiOxq8Ozv/JszgZaHjuUVRFEVRFAP4A2NyAQ5O8K2aAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAXCAYAAACWEGYrAAAAe0lEQVR4Xu2QQQqAQAwD9/+f1pNSgpt0axGVDHjqJBscwxjzOrbwMbJeK/FB9TjelN/G4yOPUCk8dA5vyj+5MwpRPeWfUApNUD3LI9PiAqoz3uRYKRRRnXij/idGRjoHqx68Kf+SODgbxgzLosPcKZUwZlgWHeYaY37FDrtbbpJP801LAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAWCAYAAAAisWU6AAABd0lEQVR4Xu2R24rEQAhE5/9/epfADkhhqWV6lgzUAV/0eOnk9TLGGGOMMZ/mJ4RC7NvOOAne0cUpqlm4E12ssfhKtg/Ax29mnATv6OIU1SzciS7WWHwd8Wj1AU95OLtBzZ9G3VH5/3XzR1APV32k+1hVLcLmqPnTqDsm/sR5HOrRqo90P7iqRdgcNX8adcfEnziPQz36/YMwVLBnOweZzMHbsx6sZRHBWuZkbBzcke3CGjqYx/oF1piXMpIKpGXAnV7Gdh7rOZVnTPyNo35b5rJ8y6opoD4gcqeXsZ3Hek7lGRN/46jflrks36I2oa8+IHKnlzGZF/d2N5zKMyY+Onh3df9F5mAv1t+wfIvahH51VAX6mxkZ3Rx2b5XPUPOMymf3TPKZc4HeNC+jNqHPDupAfzMjo5vD7q3yGWqeUfnsnkk+cy7Qm+ZHxCEYkSyPPtY7Or+qMfAWDATrGBNn6megw4KBHkblvMG84hhjjDHGGGOMMX/8AuXrqGYTCQXRAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALgAAAAXCAYAAAC4eYX8AAAB+klEQVR4Xu2QgYoDQQhD+/8/fccWhpOHUWd2CwfNA6EbY7TzehljjDHGGGOMMR/iJ6kpnNuZfRre0dVTqCzuy3zsV2X+4NvI92GjHQgoj9I/hbp3V3+K0/xurup9E3yH9W7U31AszUB5lP4p1L27+lOc5ndzVe+b4Dusd6P+hmJpBsqj9Ejlme5fKP+u/hSn+ZO5iec/Ud361H/ZylnmyYDyKJ1ke/h9hyyfxP+b/XfqqhbU2a+YeDMPd0UPtd35BXusiszD7124f5y3M6A8SifZHn7fIcsnfCTOUFe1oM5+xcSbebgreqjtzi/YY1VkHn7vwv3jvIm5C1W6oss75TSTM10Oe51fMZnb9azf3QxRfqVPOL2lo808Xaz8Slec7u+YZMbd6o5Mi7DX+RWTuczD2zPPhepxLvMslD6hyz6lzW0NAuVXuuJ0f8ckM+5Wd2RahL3Or5jMZR7ennkuVI9zmWeh9Ald9illbiq+tB5RHqWT7Ch+3yHLj6iHoZ55Iux1fkU3xx7vzPSsf8E+PZW+y1M5C86qW9/wTypzptPPfkXl28khvIVF2J/WBbWqFPRVpaBvUhH2WJWno/JMMwhvKHNoUgOZTj/7FZVvJ4fwFhZhf1oX1KpS0FeVgr5JRdhjVZ6OyjPNILzhNMcYY4wxxhhjjDHmy/kFlk5trxa6dbAAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAXCAYAAAB9J90oAAAAk0lEQVR4Xu2Q2wqAMAxD9/8/rSgqJeslEcUHe8CHLadLcYymaR5nSb4K9Nm5W0QPR/eW15ezRCXRveXTRZVi1jvJfKWXFw/sH2X/rufguUQdwAW9JRDPwXOJPACwy24o7oQ6hL5SrrgT6hD6SrniXtwaGrPPvOPleA5RCqxj77wcqbIs32FL0MEFMUeqLMubpvkFKzuDcJCmvZRsAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAYCAYAAACIhL/AAAAAk0lEQVR4Xu3QQQ6AIAxEUe9/aQ0LCPmZUWsQMelLWLSWOrptKaXb9ptnOvdi1Wc9hQpSqD7rKVSQQvVZf6aGWyYQ/SLg0lzA/s+6U0V3hLgLXKpOFd0RcnahX6hewJr47Gq+4Re5iy6gm6fofMOLbkHf56yap+h8mFqueuSeu/5jaiFr6j+AZzi1mDUx1KsBUxrpAKiCjHSZCr7ZAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAZCAYAAADXPsWXAAAAUUlEQVR4Xu2MQQoAIAzD9v9PKwiKq9lOw9MCgu1CzZovDHiK3slZZBJ1SNkI/XfWzkECZe0cJFDWzhEJdx85h0goHaHbQyT+GbmFVLT81jQpE+1iRLwO4JHLAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAAMAljuAAABAElEQVR4Xu2SUQ6DMAxDuf+lN+0jUmcljosoG+AnRYLYTYm3bTPGGGPMLXkVpep3Q9kRs8AaYRqFmaeHXZRxR7Zvlge+B9jPzqYwkzzk4vgH+WPYvlke+F6RnU0JI6snoe6rZLMrQww/qyeh7qtkM5VhZ676H9i5M8A/TFczqP7Z2a2/M3Qa01eDgXc1g+JXPEj7LZ2h05i+Ggy8qxkUv+JB2m/pDJ3Gzh/V/wXKtzBPlU3W+zJnB7GPejD2VzyfTdyNVcG0AGelM1FEE/ZRD8b+iuezibuxKpgW4Kxu5m5waHUZ66GGPjMBC1WpAPuoG5EqQOxXFWAfdWOMMcYUvAEYeCziWbwiLgAAAABJRU5ErkJggg==>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA4CAYAAABAFaTtAAADTUlEQVR4Xu3c0WrjMBAF0P3/n94lD1qGy8iWY7tN3XNA2BqNZCkNSBjSP38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4YH+bAgDAB8kDWtYBAPhmeUAb9XzjlvcZAwDgBnnYygPZ7L6LAQBwsfoGLd+UZbwe1LIAAPAh8kAHAMAH8lYNAAAAAAAAAACAq+UvP1cLAABfyCEMAHi0fOv0Uw8+Vxza6mcwK0MX+y6zOQ7ZvpX7083Wl/U0a5vFr3Dn2AA8SG4Ye5valnf7XenMHLLv3maf9autjt/ldbGXXMcs7ylW15qfy9DFs37W1eMB8DDdRtHFVp3pe6V355H9crPfar/DyviznDrfXEeV9Z8u17O19hVdny52xtXjAfAg3QHkZRbLeB4Iavlu78yjy6/rq9e8v8vKM2Y5s8+giz3J1vrqdzT/ltlvKy/jV7h6PAAeYmWDyI0p++zVj8oNMcuqd/ukEZtd73bmObO+s/iTzP7+tZ5/y8wdungXO+uOMQF4gJUNInO6DW9Wf6mbZreB3uno87rcjNW1VFk/Y8y7K0d0+UfHWc2f5XWxtJWT6z/6WdS87LNXf+melfVh71kj1o350sUAYHeD6DaW3JSyXtUNql63jDFn5agjfbrcjM3m0cWu8O64V81zNX+WN4tXKzmrcqxa32vL9pfV2J58VmcWB+CXW9kgcqMZ9bzuxcZ9HeNuR5/T5ed8sz7kZ5N5Nda1z6zkdGb9unjOp7uv/WbtW3m13vW9So6Vz+/ua30WrzK3W1OVsWwfZnEA+L+Z1FLtxY/E8nqnd57R9clY1l/qump73mdeN1ZazcnSmeXk3KqMb42xd80y5DPPmD1jtNX7rfowi434rH2rPrOaBwCXyk0tr5/onbnVddX+3VhdbMvR/DNy/iPWXWf3eR226tn2Sfbm1rXn59jlpJUcAHiMoxtfl9/F+F2u/A7sjbXXDgCPY/PjU3Rv2nw/Afj1VjfDsXGu5gMAcIF6CDtSAAAAAAAAAAAAAACAX2TvxwR+cAAA8E2O/PpzJQcAgAvVA1j+647uIOfABgDwxfIwNis1BwCALzQ7mHVW8wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4aP8AKSUg/MUnFgQAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAYCAYAAACyVACzAAABJ0lEQVR4Xu2SgQrDIBBD9/8/veFAOGKeV9viHPWB4JJ4prLXa7PZ/AFvFTbMfqyE8kB1ud9K5leO5goxq3mnTScrQR7pV+jNzHpOIStBHulX6M3Mek6hlqAiR3TKjNKb0+s4nfhoR0pp1p3TjEPvdTN1/ZzRQpp15zTj0HvdTF1L0StGnvtI3WdQjnSFuhGUbfRGEMi/S49kmZ7niHk6W+9U3+qNIJB/lx7JMj3PEfN0tt6pvtUbQSDf6VSO9oqbGTkyp86o/sjMiNXjcLcI59NZpzmyDM2PXtxTtjCqf9Ghugjn01mnObIMzY9e3FO2MKovx9miesY9nDKqL0Etd6VgnNFbEacVSF8C+pgR9FFoRZxWIP2x0GOQ/kiyf5nqj4YehfTNGT64BSzi6lpEnQAAAABJRU5ErkJggg==>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA4CAYAAABAFaTtAAAEt0lEQVR4Xu3ZAY7rJhAA0L1IL9S79cytohYVjQYDDnZw9j3J+mEYMOAoY+3/+QEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOBD/g7XVa6cG97huwnA9u4oVnfc40rZy2wW47k8SwC2lhWq+Be3+DnGjozkPEG9j+w8eD7PEoAtxQIVX8Kyz1nsN8j2msV4Ns8UgK2Ul7P6OhP/LeJ+63PhfvF7GNutWM9sPgBsIxbBUTO5O4uFv25/yx6fKJ59fB6xf9TZcQDwcbEYjpjNhxnx+xW/o7F/1NlxAPBICh9Xyl7O4r9nxBc/APhaih5Xa72wrfjerZgDALan4HG17K9pXtgA+EqlwM1ePSM5O4v7Hb24Tznv+txXPYNV8wDAMle8bKye7xNmz2Uml/dlzye2X+oX6vo6MpIDwKayH/xv+VFfWaCO5srOL+ZnsU9ZvY7W3up4vHYW15etObbvVu5fr2NkTSM5AGwm+/HOitOIM2PusGpdvXOJfb32FWbuMZN7JM7TeoGozy+O2Um2tiz20orfIZ5lfb5HRnIA2Ejrh7sV7zk77g4r1tYriLGv177CzD16+xmRjS/zxr66Hft2kq0ti7204jt74poBfrXWD3eMZ8X3pY63ivQuVqytN0fdF/Ni+yoz93n3mbXGHsV311pjfVYxJ7aPzOReZYc1ALBY/eOefc5iK8VCGa9RZ8ZEvfGtszgas9rsvd45l9aY2fhOWms8ep6xXTsa9ym7rAOAhVoFZ6TIx5xe+2rv3q83vvTFnF77HWVN2TVqNr9ojcniZ+/xUo8bnWM0L8rGxVivHY3s/a+F158/x3prAeABYnGM7Vrsz5T+LDe2M2Vc65p1ZkzRu2e91xirZbFVzs59Zlw2pnVGWWxU7zwzo3lRNi7Geu2odSa1PxZfR3prAeAB4o95addF56iA9tq1MudRzkrv3qe31qw/tl/ivuO4Xv+R0bzamTEv2bgs9hLj9R6z/RYxHq8YL7K+3pgSj7J5a1ms6I39hF3WAcCgWMiyH/Is3sqP7ZcYywpYzLnCintke64d9RVx/9kZxHjvvrXRvGI2P6rXl80V+7Pc8jmOz+Lxcz1X7Ks/Z1cmi2dz1WL7yEzuVXZYAwCbicWuVtoxvqusWM+K53F0BmfuN5M/k7tatu+4nmz/WX7r3yK2X7JYcdQXzeTOiPPGdi07pyMzuQBwi9nidJQ/Wxh3NruP2fy7XLWukXlHcs6Kc5d2K14+x/5oJAcAbre6OK2e71Nm9jGTe7dvfQFp7akVfznqK771vAB4sNHCVIrYSP5Izu5G9zBzLqyVnXkWe5l5RjO5AHC5+mVj5uoZydlZ3O/oxb2yM89itZFn1esHgK+g4HGH7HvWi3lhA4D/jBRFeFf2HevFRr6bvX4A+BqKHlcpL131VfdFrdzMSA4AfA1FjyfyvQVga71C9dv+8jC639E8nsGzBGBLo/9V9DKSU5vN38nImfT6eRbPE4At1QWqfnHLrpIzYzZ/JzNn8+R98i/PEIBtzbyUlJxZZ8bsYPRseD7PEYCtzbx8jOZFZ8Z8Wr3e3tqfuD/+5/kBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA0z8Mgu1B8O3PAwAAAABJRU5ErkJggg==>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAuCAYAAACVmkVrAAAFMklEQVR4Xu3YC67jNhAF0dn/phMISAM9ldsk5c8bO6kDCGZ/SMqTZ0rIr1+SJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSpNf6iwn97/g3IElf4jqwV9ezduu8ej/i+mmvtC97kjs908WeZMrv3F033dsjnplLd+5p6km5V+C9ndznrj6pOY/On7xyLUnSm/Cw3sXJT/bc1dfk+qtamfLdSc8l9fHhm3p2pjm7dZljfEm5hH2Mk0d6GCep5zSXnPSxhzHt6qX3TeNXePV6kqQX40G9i2lXLyd9Jz13rR5yjJNX9VxS35VL+VOruavahf82u/5XO9mPPYyTV/WUk96Tnu6kf9Wzqj3i1etJkt4sHdzM8UHfTTX2JVM/x9NaU76s6lVjD/dmjjFrXd07vwPnrGqXXb2sanTSyx7G3apWTnouu383rnO3Z+ekl/eY7qGP05rMreLVHoU5zqFVTZL0YdKhzdzuQXHhw2Hq61LPnXVWtcuqXjX2ML4wN82l9D3S9+PV7eJuVaOTXvYw7qYav9v0PSfsS3Mr7vmpJ+F98UpWeV6V79Laq3hVqzjlVnZ1SdIHSYc2c7sHR+VWfQn7766zql1W9bQX47qn1JPylOqcx7hLNcbdqkZpbWKdcbeqlUd6+n3ys1RPz6eeUye9Uw/vo6R7Y98qPqmtepJdXZL0j+nAnPLvkPZiLj0cajzFXOOS+qfxap2yql1W9Wn9nk/jitOYUo1rVS6NS6rv+k6k/rTXScxa8khP/75pXDHHq3V2nu1Z3Q9rjNMnxz1mD+OVXV2SHlYHEg+alDtxOue0745+4PL6Cdyz7zvly6qXF001zuPVe/qY65Q0f6qlK/Uxl2Lmdlfq7znWVzX2ndjNY537smdlV79wrz4n5Vcx90u5ZNWzWr+wh/0pV1Z9Kc845XrcMf4J6T4uU17SF+o/Zv6wGZ+4c0Cc9t0xfZ937CVd/vTf1p/e/9S33Ocz3v0d0/l6cs5NeUlfgj/iXfxq71i/1jw5xKRX8O9L5U/8LXBPxmXKS/oC1w949SOueu9LuZL6OO56vedS72Wqca/+ybH0Dv6N6ZG/Ac5hfIJzGJcpL+lL1MtO+jFPLz39paiP+2eNU2/pe7OeYo7ZU1Ivx8T7SPckSa/2zBmTzqh+PnaMJX0J/nhP43RAFNamcY+ndadxxexP0hrTnL4mL0l6p2fOGs5jXKa8pA/HH+8qrvHuUFn19dr0ebLnNCb2cT9J+gTPnkmcz7hMeUkfrl5i+EJU0gvP1FtWL0ac2/s45l4pt8tTX0uSPgHPI8aUzryUK1Nekt7u5OCZeqa8PgMfPK9+2KzWesd+Hde/u8/dfkmSflw9qHxg/Xfxv22PWUtOei67vl39GVz77kvYnV5Jkn7c3Qebvg//+955YdvVu13vrv6MtHbKTe70SpIkvd30clIv71VnPOVKynUn63D/nmNvxxr7OU579M8u7c81VnHP1ViSJGkpvTAwN71c8CWkY0zTXM5bvdwwLjWnX73WP2vc84w7zntmPO0hSZL0G74s9BeJnuuftJozSfXdOqtal/K1dr96rWON9QvzNU69l6lfkiRpK704MJdeRtILCONuVeeYcRqnuKR85fjJMeN+P+neGHerOnslSZL+pV4m+jXVulVf1dK8C/tSPq3DONUK12EPc6kv5QprXJtSb8pJkiTpB/jyJUmS9KH8P2WSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmS4G98ix4bzh9rawAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKUAAAAWCAYAAAChdVwBAAAB90lEQVR4Xu2SwY7EMAhD+/8/vatqloi1sIF2mjkMT8qhtiEQ9TiGYRiGYRgkP3+HobzhP1/zVvbTVBb22Ur+hGWZbnTveZoruxuV2krmJPN3g3Or2aq5WuiPclMHyzLd6N7zNFd2Nyq1lcxJ5u8G51azlXLeoKEjbpI2P3Iv8r3OMjthMzDdE2Xw3aLMSVf/BDgH7oY6wvSFMtNiAqthOnL13nfCZmC6J8qYZnqUOWG6obxd4Ay4G+oI0xfKTIsJrIbpyNV73wmbgemeKGOa6VHmhOmG8naBM+BuqCNMXyjTX8Yu9lT8ClmfHbAZmJ6B78f6MN1Q3qfA3VBHmL5QJivu6obyPFkfj2Wrp4LKMz3D19zprzwDd87OXaI+qj/TF8pkxV3dUJ4n6+Pxy1dOBZVneoavudNfeQbunJ27RH1Uf6YvlMmKu7qhPE/WZwdsBqZHWDbKd3VDeYa/t3KuUKlnPtMXymTFkY7fEZXMSdR/N2wGpntYxuuVTITydsFmQJ3twvSFMllxpON3RCVzEvXfDZuB6R6W8XolE6G8XbAZUGe7hLqJ0fGgF2UMpntUBu/Asxu8P5qjokdHZTIqmafBmdn86EWZR+he1M0PL+bdGnQfq5sfXsy7Neg+Vjc/vJh3a3D1sa7UfCvzVk3mp3yeeath2MUvhPHrI/x6Sb0AAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAZCAYAAAA14t7uAAAAX0lEQVR4Xu2QSQrAMAwD8/9PpydDEB6UrYSWDOgiWTq4lMtvqJ2axpVdjriiyxEqLr9Df6qaRodUw1A584Z4fVghvxsaID9wOR6QH6R5mKoWzdo887bxjWF9zbbhy2EelwJSrt4DXHcAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMcAAAAYCAYAAABObek8AAACK0lEQVR4Xu2V0W7DMAwD+/8/vSEPKoQDaStO3S2tDjAgyRRtKyv2eDRN0zRN0zRN0zRN82/4KayMq1e52t+cg99SzZ57SvOVjIYx2lvl1X5NjTxzN39X/1pGP4DR3iqv9mtq9I9jgdFAdvwh7/Bs5vSPY4H832E0QKUh9FLaXKdW6b8FzkHNw9UrsCf7rHp+PO5jcFhKQ+iltLlOrdJ/C5yDmoerV2BP9ln1/Hg4FPUBXExmA8/eFU9Xv4q6w1/j7nL1rq431yuaHVx92zZmFztbP8ieyjvn3Muo3h2844wq7i5ullVcL78TNcx38s6zSrihBGfrBxw2tTnnXkb17uAdZ1Rxd3GzrOJ6+Z2oYb6Td55VQg3kYDSsqLl95qrGXHnmO1R8glFPMNpX9ZyrPVdTeyOcdsUrM+t1e5V3sM4e7mecRuVRU/oDpan6P2GTa54tBTVKq3Kni9qZeMUnyHn2Y93FM/0MetDrwNUJPUY9lTo12Y9nKC1z9rqYnjP/kd7FT3igEnFPLQU1Sqtyp4vamXjFJ8h59mPdxTP9DHrQ68DVCT1GPZU6NdmPZygtc/a6mJ4z/5HexbdDPYSPcbVZHDn9M66Xd5n13hm+W8WRq3lUZsN5sn41VrgzbwEvnR/jVsD4ygpYdyvI8R3he3KtutgTUDdbrsfVqQlGe7eCl+fD1AoYX1kB624FOb4jfE+uVRd7Aupmy/W4OjXBaK9pmqZpmqZpmmY7vx/2xVdrWrwaAAAAAElFTkSuQmCC>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAVMAAAAYCAYAAABHox5vAAAETklEQVR4Xu2U4c7cKgxE+/4vfa/yw5J7NGNMNmTZiiMhxeNhMHS//vlzOBwOh8PhcDgcDofD4XCY4D8KX2a3eQ6Hp3jjt32d8cY5B8FuD7/bPIfDU7zx2576zzTM1co4vcun+3dldKfuvfn2yl/1FDPe1czOnhm9S0Bf5X0TzqRWxuldPt2/K6M7VW8ajPqk5atCq95dns7bBXevrDtPwJ57f6VVzPpXMPMORPmrt1E4/U3czBdV7y5P5+2Cu9eMznpEy1/9I1a9uzydtwvuXll3noA99/5Kq5j1r2DmHYjyV2+jcPqbuJkvqt5dns7bBXevGZ31iJa/MqkhPmVF5rfp3md0d/bC73R+j+j6VjMzs8Ptn9UzlWflzBdP5JMVmd+muo+7r9JzzZ5D5fxFGGjkJuUhzFLerNOr/L9Ad+7ZO7p3UTo9io7nDTh7l3zvaj99lZcoP+u7uJmYrzyEWcqbdXqV/xfozN25J/uVNxh63MHcpDyEWcqbdXqV/xfozj17R/cuSqdH0fG8AWfvku9d7aev8hLlZ30XNxPzlYcwS3mzTq/y/wKduTv3ZL/yBkMPmzwkNPVNRsPl7G5m0PF8i+5svPcI5VfvF/qIrmdm3eGTvYHbn/VP5vxkr4NZ6gz3TfI+ZmSNPfoy9O5INZ96E/pHeoX1uNBgVr/ImSo71+w5XJai8nQz7tDN7cwwuu+snul6ZtYdPtkbuBlYB053uPw7jLJm9YucqbJzzZ7C5Ticz+lPUeW7+bPe8TisZ/R4s/pFzlTZuWbP4bIUlaebcYdubmeG0X1n9UzXM7Pu8MnewM3AOnC6w+XfYZQ1q1/kTJWda/YULsfhfE5/iirfzZ/1jsdhPa4ROnujgVStNNZV5kVHj++8MqpW2gjncTpR52ZcL+v05My7+W8zmpMof2hKVzidzGR2UZkX1R1Cc33WSmM9kxlQj715ZZ0onbXCeZx+oc66GM2Za/Yyf+2NgivDnloKepRX1coXdHT3HTXz+T3yRB0avaE5eAZXhj3l6+xxVL3VcEauDHV61Z6AnspLKt9MzgXPV/vZU0tBj/Kq2vmoXWRdeXJdZedv5VN7uucSnuH2O031Mn/1uUltZk8tBT3Kq2rlCzq6+46a+fweeaIOjd7QHDyDK8Oe8nX2OKreajgjV4Y6vWpPQE/lJZVvJueC56v97KmloEd5Ve181C6yrjy5rrLzt/KpPd1zCc9w+52meplRf2s4uLpMrtkLnOeTb6Jm24WdZzt8F/XbULXSWCvtiW+izlrN2+c9Di8Qj9hZGdfj98wiTt+BnWc7fBf12+BvfbS4J6i+ZxZx+krePu9xeAE+crUyrsfvmUWcvgM7z3b4Luq3wd/6aHFPUH3PLOL0lbx93mOsfqyV+aty77LbPId9eOO38et/ayvnX04M//QFVuUeDr/G6r+F1fmHJqv+IVblHg6/xuq/hdX5h8PhcPgX+B/UDquNAxOJyQAAAABJRU5ErkJggg==>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAXCAYAAABAtbxOAAAA0UlEQVR4Xu2PQQrDMAwE8/9PtySQsB12bekWigZ08Hoky8cxDEPgYyqxunsd/NRq+dXdDxy4aqx6jlWf5nyDtcWJaYDLTlKuqJN8l7szM4sT7yzlJOWKOsl3uTszK5Oau3ki+Zo7h+cS9yAt0s0TO5877Pwl/JQb1M0TO5877PwybhAfU1Ke6Pj0dI/OnIvU5LKTlCc6Pj3t7cy5+IuPucs3fMw53Ms5DyqzCO+dV8ldKTwr6rveBz6QHjvhvfMquSuFZ0V91/tqKstWnGEYhjpfDkvrFZ3/zbgAAAAASUVORK5CYII=>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAACkklEQVR4Xu3Y0YrjMAwAwP3/n74jDwUhJMtp0zaFGQgbS7Ks64MD9/cHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD7/hXPSq7d3fdN1ZzfnvduM91plkP1+9xBNded5jtUMwLwo565yOOevD+v76CbqYu/6pW+r+zt7PSsaqrYVabeXb6LX2Gnd1fTxd9hOqvLd3EAbu64wHcv8a62it1JN/ehi79qp29X08VfMfXsfqMqdpVV726eQxe/wtT7W3Nlq7PuMiMAF9q5wPMHIO/J63d7zFM9lS7+Tjtn7tRcZTpryr/D6sxV7p2mc6f8p6zmWOUA+FE7l3uu2Vnnp9LFD6vcWTu9duad5B5Tvy5+yHtXfSr5/Nwv6+LRTp+VvD8/UV53Vj2iKdc9WRWrTH06XX3ul58orztnelQ1AHxQdwk/4tVFnddRzMUelS5+mHLdU7kqfsZOj6omxrr3Z0z7q3yOTeuzVvu73PSbVLFDF8+mui7fxQ+rXLZbu6rrcjk+raNVDoAP6C7i7sN4vHd7oqrmsTc/OfdYX6XrNf27qplyTWenrqrJM+W/eYYqVnkmn2PxnGqG+J73VlY1XS6fm8Xzn5nr2fxOPM9QvXd9slVdl8vxfH4VW+UB+LD4sagu5J14levEyz/+7WJXyLN2/eP53bPjTN2qd5xnFZvs1D47y2rPylSfe+dzsyq/sy+a8oc8U7Unx6v1Kj6Z6vJ8VX2cIariXQ8Aftzqcs8fhDt9GKqZHs7Mtls3qeapYpMztZV8fjXD2TPO1kfV3m6W7r0y5V9RzRF/yxif7NZ18pndupsTAG7JxwoA4Ob8DwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADcw38HislFUdl3xgAAAABJRU5ErkJggg==>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAVCAYAAADID4fUAAAAfUlEQVR4Xu2RgQrAIAhE+/+f3tggsIc6s2Js9ECYel03KmWz+RBHsJYQueBpP8zrISIBLiKaNMuMe/hFCPmc6SeLHLI0nO8QHtTUoJw3C608LJ2c0Y/aGwpYHpZOzuhHbQrNSPbWd+0564Z/pJlyJzXsU9BYM+RueogRmotPvYt7hfO/iF4AAAAASUVORK5CYII=>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAWCAYAAAA4oUfxAAAAcElEQVR4Xu2SUQrAIAxDvf+lN/wYhKLltRMdrA8EW2MaxNaK4gNcYC2HGBNNCmJMNGHokxJNmOWGEWr4Echw1egH1U9oa4Qn9sxsPxXEE3gGtp8a3lExvajns/1T295rZiG3BDk6vDMy01A24Ej/I27HflioxLJL8wAAAABJRU5ErkJggg==>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmMAAAAYCAYAAAC2svpWAAAGjklEQVR4Xu2Vi24kNwwE/f8/nUCXKOHVsfmYnd2V1yyAgNXdlCh5DH99DcMwDMMwDMMwDMMwDMMwDMMwDMMwDG/ir39r+B6c+vs6caZhGIbhvZz6P+s45qG+F6f+vk6caRiGYXgvl/5n7aasPgV7F97R3pXas96hsidn8GaJvE/hlHupN+bvIKu7UXtG59JjvZp3nu3B92A9C57Ds+ipGjSnvQ9/dyf9DjlTVsM/lN6i8nCZ/x1R91H64qR3UHMo/ZM45Y7e98D1pqvfiTdnRDf/TE6aw5ulq3fo9kf5O+b5BL7bO5wyq3q3rv4Id+151z4dSuftwaJw5n9H1H2UvjjpHdQcSv8kTrmj9z1wvenqd+LNGdHNP5OT5vBm6eoduv1R/o55PoHv9g6nzKreras/wl173rVPh/S8PVQWrGS+C9ldMi/yXwnnOGm2V1C5b5aJvAzVe5d+J9k7kG7+mdg59lzvmE2d6+lcX6W7T5T35vxpPHr/7A0j7yrP2PMK6u5d/Sp37XXXPlcI30QaH0z4IF//+1ER+sxRV9VB7R/B89hDnf6CXidzJa/IfAtznV5Ft7+S5929Oemp2lCn71HJbLiv7aVWLUukc61y1HmelyHMeXl6z8x4qEykXy0LvSu5ajbymNvQ86oD81f2qKL25fx2BmrVukKnl+fdVZaKrspS0VUpQl8aH0z4IF9/PqxXhD5z1FV1UPtH8Dz2UKe/oNfJXMkrMt/CXKdX0e2v5Hl3b056qjbU6XtUMhvua3upVcsS6VyrHHWe52UIc16e3jMzHioT6VfLQu9KrpqNPOY29LzqwPyVPaqofTm/nYFata7Q6eV5d5WloquyVHRVitCXxmHwsllFZJnMi3wLc1lv5Hnwvtn+C5Wxe6nMRnnU1T6e7q2pkUrGUrlbh+4+3fxCzav0Db0sTyp59Z5K86joUeaRs7zeLt0ZFCqvdIWdR822UJ7VPH/h6d6a2sLTuVZ0eu/SI/Y8V3o7VPf3ZuF609UjvHOJeiureb5FeSfq6i5K/4U0DDZjD2Kv0u+A52YVkWUyz/N5vpfzNEvkeah8pKsZPJ15rgl1lfV0u87O2VQyluq+Vbr7VPJ2xmhepW/oZXmS5TlfNOviEV1lFt6ZXG+oe70RKu/d3cttbN7rtShdUc3zbG8GT1t4ul2r/RZWj3IL66ss15u79Ag1092o/fku3ixcb7p6hHcu4Yxej6dZlHeavlB3UfovpGGwmb2Zt6nS74DnZhWRZTLP83m+l/M0S+R5qHykqxk8nXmuCXWV9XS7zs7ZVDKW6r5VuvtU8nbGaF6lb+hleZLlOV806+IRXWUW3plcb6h7vREq793dy21s3uu1KF1RzfNsbwZPW3i6Xav9FlaPcgvrqyzXm7v0CDXT3aj9+S7eLFxvunqEdy7hjF6Pp1mUd5q+UHdR+i+kYWDG25DrTVd/Bd78lsyjv7VM9zKWyPNQeZ5ryXTPW1i9ktlragtPz8736OSZ6/Qquv1RXt0/0xX0sjxReU/31p7mUdGjzCNneb0RKu/pav5oZqV3eDRvZ/DmWXi6mp9Ucirj6cxsKrr6uQLznOsK3v22zrXKUWdm09UjeGYEc7Y320fdS/VUdPWz5Yqu7qL0/7DNXimsx5ztrfz8SrxzeWdvTpaFXrUW1LbuwZyXp2cz1NhPnf6CXiXT1el73JGJvIxKL++T3Y0ZL0/d+tSiIvSjstCzGWpX9KgUzFUrglkWUR77WFHGg5koS9ijalPV6W/oq9yCmaxUD6HPisgykZfBObKZmMlK9US6glmWgrmsiPLYxyLKYx/LQk/lLJn/x0YshfWYs72Vn1+Jdy7v7M3JstCr1oLa1j2Y8/L0bIYa+6nTX9CrZLo6fY87MpGXUenlfbK7MePlqVufWlSEflQWejZD7YoelYK5akUwyyLKYx8ryngwE2UJe1Rtqjr9DX2VWzCTleoh9FkRWSbyMjhHNhMzWameSFcwy1IwlxVRHvtYRHnsY1noqZwl8y+jDvfWXu7dnDbPTyT7LpSn9FeTzT8Mn0z2/Vsvy0X+MJxG93vt5luozfcfVrXexTvPHn6H30T2fSj91UQzDsNPgX+z6u+XHmsYToffbPW7reYuoTbnoFm9i3eePfwOv4ns+1D6q4lmHIafAv9m1d8vPdYwnA6/2ep3W839WDqPObyfU39fJ840DMMwvJdT/2cNwzAMwzAMwzAMwzAMwzAMwzAMw/Az+RsVqe2Dj2sQgAAAAABJRU5ErkJggg==>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAWCAYAAAChWZ5EAAAAe0lEQVR4Xu2SQQrAMAgE/f+nWwo9yGaNa0qgpQ7kEB0XCTFrmpdyCGcLSrjiLKOEK84S6vMqzhJbQiv0Ap9YIHL8B1Y/88BsIAvEHvPTxcKGJYM29pifLnDhJWngZub7Gus/ggWye+RhrQwLYffIw1oJH+yDsIYe1n/OCS6JX6EVzCDyAAAAAElFTkSuQmCC>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGEAAAAYCAYAAADqK5OqAAABJElEQVR4Xu2TWwrFMAhEu/9N30s+UmSYSbVtkgoeCOhofDT0OIqiKIqi+CQ/58mEml3pLIbxKahGTEc/A2yPRlSfimrKdPQzwPZoRPWpqKZMR38GrK9lFGOwel1DvaH05YyGXAX2vjsPu6f2Q38rasiVYO+787B7aj/0t/KVYdTHimDve+zP4BnIk9N4suCbj4A16hGcqA8YQdVI/QhsYLuojSndA+bfqdFQ/ZXOUHuou6jjfYyfYBJLRh39DsvxcpU/ijFUPaVbovsxG2uweid4gSWjjn6H5Xi5yh/FGKqe0i3R/ZiNNVi9MKyI9VkMtWx49/PYr9ALqsFsHE9WcD9rs2NjaL8CNuuatdXJCu5nbXZsDO1iEfXBN4F/QrGBeoTM/AGPKCzi1EOUTwAAAABJRU5ErkJggg==>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAYCAYAAAB5j+RNAAAAj0lEQVR4Xu2SUQrAMAhDe/9Lb+xjIwSNWrZShg+EVhMbxsZomibkSNZSMg9H88/YNlwm2EVG8zrLH6zw63DZ30Lhet0B4Gm4PxvS9bgDwNNwf4twUQic3VrlkXNewIXwHUG98ls96/w0VCF8R1Cv/FbPOpdR5urDkX4K/CpYFhwOtez3dpTghWrx8nBNU+UE8ACBf05o2ysAAAAASUVORK5CYII=>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcMAAAAYCAYAAACGCJaGAAAE30lEQVR4Xu2Vi44bOQwE8/8/fYGDECDqmg/JY+9owgIESGSTYsuzya9fwzAMwzAMwzAMwzAMwzAMwzD85T8GhkHw+k5++lu5wwzDmcx3M5TMRzJ0uMN/RHeYYTiTpe/GPrRqPRX6zNYTqLzQs9IzpzRPg17NL2PqLZhj/gR+aubsXr6pelvmlOaJRH4ZZ/5FljuR0kfHbJU/ne4b3JWd2Sq/L7rvkuWfSuQ5e7MofhLvzP/p2uztjSz3VKI3qd4rip9K5vUP1YO8qPKn032Du7IzW+X3RfddsvxTiTxnbxbFT+Kd+T9dm729keWeSvQm1XtF8VPJvJaPYXQ0J9L1/6Kj+SlWZ+vqq7dZeb+fJJtvd/6oJnoTnk9G+euwW9Oty3TR73I3qhmzXETUM3oTFXsS0psM/kM85Udf9dDV+z+WaJ2CmpfnFVjr+199191Q/jrs1nTrTJutU+Cs78yvav1Z5Rh7EtKbDP5DPOVHX/XQ1dv7ZOsU1Lw8r8Ba3//qu+6G8tdht6ZbZ9psnQJnfWd+VevPKsfYk5DeZHCBKz6y1Vp/Z2dldDQnsOqhq6/eJ8vdle63UeHr2cv3v+Kuu7HrabemW5fpVvrcBZv53bmr79GfmfsW37xX3iWDINIwrh65w2qN3dNdGVdpdlntS2/VishyRtYny72I4jtk9+xQzd7F17NX944qv0Lnvquo7vL+OytjRRPpsnwU3+XqXlfM53uoflfds0Pn3o5mBdlLBkGkYXx34NUa/8N1VsZVml1W+9JbtSKynJH1yXIvovgO2T07VLN38fXs1b2jyq/Que8qqru8/87KWNFEuiwfxXe5utcV8/keqt9V9+zQubejWUH2kkFATTWYz/lHjmqq/Cfp3Ks0kS/qPF7L+qyuw2p9R59popnpqeuXZ8PHs/oOqo7nFbJZstwLejEdY6zn2WCcPZh/oeJVjVHlI3ZrqrpKE+Uiv1Hc54iKZ30qqN/pYVQzVPkXHS+MR1ofZ1/q1ZnLw7Mi1LAxl4dnj9dn9Sqm9t+Enqv5ozj3RuSRul1W+0R6ele+uBT0qPp09lweFYvIdCt9PFlNt6fX0OfKPuvj49Fe1bDeQ22X3RpVx7mpY5x5w8eVrruv+vh4RqXJchHv9Ox4UXvW7e7trGKdvSLM+QvU8vDsUcNQH8XU/pvQczV/FOfeiDxSt8tqn0hP78oXl4IeVZ/OnsujYhGZbqWPJ6vp9vQa+lzZZ318PNqrGtZ7qO2yW6PqODd1jDNv+LjSdfdVHx/PqDRZLuKdnh0vas+63b2dVayzV2S5NlkTNQCNeCr9nen6qjwyt8tOHzXbVbCvukudVazanwx9VG9gZxXj2WKdvcGzoqOJ+KnajM47XKFh7jQiL9HezhZb3RvqrGJqT1TtW1hDLgWH9FrWRz3uCH35/e76Np+4l56sv7qLOtYojYqfCH2ZD+WJOtZQ48/MRcvw+4iO5hN84t7uO1DHRY3BPfMnEXmJ1orOUHHGmPcxLhLFt+GF2QU+Ti3rox53hL78fnd9m0/cS0/WX91FHWuURsVPhL7Mh/JEHWuo8WfmomX4fURH8wk+cW/3HajjosbgnvmTiLxEa0VnqDhjzPsYF4niw/CH+TiGDnf4h+QOMwxnMt/NMAzDMAzDMAzDMAzDMAzD//kN5dFn34OmsAgAAAAASUVORK5CYII=>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAWCAYAAACyjt6wAAAAiElEQVR4Xu2TUQrAIAxDd/9Lb7/61tpUJ8Log8FIYlMQr6soiilu4TuCUq5ktqGUK5ktqNenZLZwpDRDLbjKLxb0Mu0DUx9bmtHAqNDyqHmLj7ROZ6jlFQaWR80sDTTqneGGDJjnGc/jP/1lMgPbrHWOC1qZNJkhUfnnC7YDo0H0eZZLUS+meQAJSHON3EVBMAAAAABJRU5ErkJggg==>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAYCAYAAABqWKS5AAAAq0lEQVR4Xu2S0QrDMAwD8/8/vVGYwRyS662MNcwHhVhRknvoWsMwbMvjje+2VHIj/00que3kt/jXA0puIZ8lfyHs3m058FCFeiSgRHSYMXfrmEvaxVVfTEElo3K3jrmkXXyh+mp2PSWpcgsPnR5IqK6aXY9ZJu/ZHqXPLs2orppdj1mmJX8FJaBm12N2kHO3vkyW4qXcowDzgDm77H9MdSn3ujLM2WV/GP6KJx3pvUPsM3cRAAAAAElFTkSuQmCC>

[image38]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAYCAYAAADH2bwQAAAALklEQVR4XmNgGILgPxTjBDRSABNElkBRRFABDGAVRAbUVYBVMTbHogCCCoYxAAALiBrmoq/g1AAAAABJRU5ErkJggg==>

[image39]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAAAYCAYAAABHqosDAAAA7ElEQVR4Xu2RSw6DMAwFuf+l21UkMzz/qkDVyiNl4WTiPMxxDMMwpLywFN7+X7NtMGwUrW9TyWLPmL9y/0Ikt5ttRr3PesHBWFSflOjCRw03ot5nvZjBoF54g/H8FF5cYbj/NF4O1pauH8KLXqCn8XKwtnR9iX3YC9GFvSrLw3O8fWIdvhneTQVDx+uuCOWwVtCxfVTPE6lg6HjdFaEc1go6to/qeSIVjutHZP5u1JusFXTSwfAjpSSoOHfAnFle79zuS4cPSElQce6AObO83rnd95wWW5o8RCVnxSnBP7Wt8a/DocxghmEYmrwBA+flG8YSSAsAAAAASUVORK5CYII=>

[image40]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAYCAYAAACC2BGSAAABFElEQVR4Xu2RAYrDQAwD+/9PtwTa4gyy7O0lJVw9YMiuJVtsbrdhGIZ/xR2VUfV/mkMfkcNcXQGXiT2leRHvqa+8Kc7oet9C7Wcunh3UKB/PJS6A630LtZ+5eHZQo3w8lzjDSrizUPuZS2kyoo6elTk7MhODXglmi2f2FErj9CWZWS26CszGx6tyK43Tl3Axh6/AGVV9Ssfb3aM07Zwt0ZOOZoPLq1rB+dS900eUJp7Z29FdstHRbMSZnVrB+dS900eUJp7Z26HMJAbp6M8g2xvvlaaTmT3loWYnUoaMjuYsmJXlNBmdvvp+X6iq6GjOgllZTpPR6avvP3HYoItQPeJGR9OCf/aQob8GH3AecRiGYXjzAOYLJuhpSkYdAAAAAElFTkSuQmCC>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAYCAYAAACC2BGSAAABFUlEQVR4Xu2RgQrDMAhE9/8/vRFYizlOPVnTltUHgUXv9Jq9Xk3TNH/FG45H1n80hz4iDovOlWAWPJGGYeuoz7wukTHqnYW339YrOVHDfHhPiQJEvbPw9tt6JSdqmA/vKZGhEm4VbD+7Y83D6tBTmTPhme7wgIiXx2ZVcjNNpE/xzGzR1Xh58PE83QbTRPoUXIzDK+CM7FSp+NQ9TCPnlERfFM0Al2eniudjdXUP09g79ibUJQNFM7AzlVPF87G6uodp7B17E8yM2CCKfiVRBlaP9BvYYx7UTCJm8FA0q4ny4vd4ug2lz37vBXYyFM1qorz4PZ5uQ+mz3z9x2KCbkD3iQNFI4D97yNCngQ/Yj9g0TdPsfAD/3xj22gPshQAAAABJRU5ErkJggg==>

[image42]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAYCAYAAACV+oFbAAABM0lEQVR4Xu2RSW7DQAwE9f9PJ9BBxqTSzcWQPYbBAnhgs7lodBzDMAzDm/gRQZw+NOFDq0d1uoTDothN9Zaq7yTyrjrfgtEianhq4I2oj3aw5vxKV3m0l3mZqFEteifZR6+w5vxKV3m0l3mZqFEt2kV2C2vOr3SVq8dWvS3YfA2kvht3k7s30pSuoK56W7DZHbQbd5O7N9KUrqCuekusi90RXTgriw6ux81TutIifcXNiXoelI1Hz9eJDlkPa86vdOYrmZ81iRri6Pg60SHrYc35lc58JfOzJlFDyOVZYxfZftacX+nMVzI/aw/4cGqQouJ5Bbwzupce52Xd+U4quvP8WxAtWql4XgHvjO6lx3lZd76Tiu48T3P7wA8n+gEXFU8L/v1bhw9/4UPPYw/DMAxfxy/36zjWcUBLlQAAAABJRU5ErkJggg==>

[image43]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA2CAYAAAB6H8WdAAACLUlEQVR4Xu3cwW7DIAwA0P3/T2/KAQlZmBCSBjq9J6EOY0joBSvt+vMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj/utGgAAGyqFmoINAGBD9dM1BRsAwIbqIk3BBgCwKU/YAAAAAAAAAAAAAAAAAAB2F393bbQBAPCiq0XYlVwAgG3FJ1JXi6K33b2/uMfYz2JvePqa9T7O9pTFAYDFsgO8FdtJdt+j4tyz/hvKNZ++dnyvYr9oxQCAxbKD+5DFd9G79xFxbixoZsW5sV/LxrL4rLhe773L4gDAIt9+OPcKjzOxQIv9O8r8s3Wy8Sw+K64X+7XeGACwwMjhXIqZuo3q5cc1Z9Y/zMw5lDnZ610j62Q5vXivZVp5WX4WBwAWyQ7nOh5zYr+nlxuLiFhQjJqZcyhz6teZdTIja2U5WXxGtq9W7JDFAYBFssO5jvf+brU49mmz14j3F/tF3F8rJ6rfh55sPIvPaK3V20srBgAsFouReGC34rFfxHgr50l31o9zY//Q2k8rrxbHY78Wx8r6dZt1tk4rdsjiAMDGsgO8FY/FQSvnKZ9cu1auE1+/XWsfrRgAwJSrhcXV/Dftcm+73AcA8A9cLSyu5gMAcEP5yPVqAwAAAAAAAAAAgCeMfCfNd9cAABYaLcRG8wAAeNCV//wcyQEA4ANKIRZ/uiMWcwo2AIAFYlGWGc0DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA3f0BX8Qc8mCK068AAAAASUVORK5CYII=>

[image44]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAXCAYAAADUUxW8AAAAOUlEQVR4XmNgGAUjEfyHYlwAnxwcoCsiZCgKQFdIkmYQgGkgSRMMDIxmdA1EGUJIET45yjSPAloCACsDGuZ+sipdAAAAAElFTkSuQmCC>

[image45]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAVCAYAAADFEfeTAAAAi0lEQVR4Xu2SUQqAMAxDd/9LKwpCzZK1HTr20QeFNsY2gq0VReFyBGspkcPe89/YNlwk2EXE8znLD2aocAleeSLhlMf+r1gWpiHU0wkE5cFA24XDmWkM1Nm7N/aLWSlGPk9XPfq7I1iKkc/TVY/+aXARW47zA4bBeQq7xC6K6srD+jSjAxFdeVi/HyeJVZdpyZATXwAAAABJRU5ErkJggg==>

[image46]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAABuklEQVR4Xu3W0W6DMBAEwP7/T7fiwdLptDZEIYGkMxIC7xlzbR7snx8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA47LcHvJ3fAAAutG3E9RrZnaz62aul6256b3ftEQC4QNqEU3alVT+r2tAPaX18pdRHyu7izr0BwFeaHVxSdpVVL/0QNtNrfXymtHbKNp/w/0/u3h8AfJWrNt5xUElXl7Kh1vbmrb5xtkf6+kSf2jcAfKQjG+/soNPHmzTvWbP1er769ix/pVU/w169OrLeSn+3jx/xzLsAwIPSxtuzOu61bq8+jMNHurqUbVI+y1L+ake+m+op28zyo559vzpzLQBgR9p4e9YPHnU8nuu43s+Q1krZpvc6siT1PhvP8plaOzpv6Fn/3qynft+7hp6nNbqUAQAvlDbrqm7gKet5WuMZab3ec7/SnKrX+py6Rs36vCTVUzbMehi1+lz76uN6T9ms1ut17VqvUgYAXCRt8uO5j1N+lrPXTOvtZfVvfJf+/d7D7D6e+7g+13dmtWRVAwD+OQeF6/kNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgxx+M4AYJ1bM80AAAAABJRU5ErkJggg==>

[image47]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAYCAYAAACmwZ5SAAAAy0lEQVR4Xu2Ryw6DMAwE+f+fpuoh0nbk5wESSkayRNbrsIbj2Gxex0nh33nNwt9FR3XQuaiWgwE7IbOZrD8FLtsJl81k/dthkG64zP+Yhal7eN7uPbfBQN2gnrd7z+VkYaKeoostt6SSBauEr3iWIQtaWabimU4nYOaNehb06wfTd1Gz5nhmhc1KDaizb6EezlV17zny/wjdGlBn30I9nKvq3nPkn4K+nEG8cJZunZdZUtE/oKU9Yumcr9wzBQasBLV0zlfu2Ww2D+YD6AnyDmLqBiMAAAAASUVORK5CYII=>

[image48]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAYCAYAAACsnTAAAAAA3UlEQVR4Xu2QUQrDMAxDe/9Lb2RQ0IQUO0225MMPDK2kJqqvqyiKotjCKzkj8LfRHEOmVOQzLj+qb6OWAuAyokKZDOLyo/rfWVGEFxudGfnbWVGQlxGdGfnbmS3ovu3ps3euRPbIFnSZVXoDF+YmIpNBZH72slV6gxegJiKTQWT+6WWuqNNvnN5Q3+G78m4N71XnNJTO71/wgTwOzqk8ey6HZPzoGXEZl//AZXkcnFN59lwOyfjRM+IyLn8kbilK7/2kyyv9SLCsK85eb7L5o+GyqjR7vcnmi6IofsIbLKAGCf8MNPkAAAAASUVORK5CYII=>

[image49]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAmCAYAAAB5yccGAAADlUlEQVR4Xu3YW47bOBQFwOx/0xnogwPm4JCS3Ha3nVQBgngfJEXNQG7k1y8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC47fcXLgAAvskjf4Dd7QcA4Ase/Vezuf/uXPgO/r8EPs7qx/Xsg3ZWn93pPbQ/ElrumV659qd79N3v5uSau96f1J6r5T5VniXjZ2prt9x3+cm9AW7ZfbB2tcNZffZIb5vTco/IdY44c/zpkXe06m//jVe9P2l15pb7RO18GT/TK9d+xLs9D8BTjI97XrOWO7TcyujNOW3ts1yrHzKX8TDn21q5T9aHXe1T3D3Drnd+b5l7lVw/4+bs+Xb/3Vu+nftZ2potN2v1PHPrOcxnz54Wt97sO7SeNvdZXrEmwI9YfSgzlx/ZNr5i9Ocauc6uPsdZm3PzNVvNzz3GvY2HNvc75Tnn664783Z9Wcv4Ve7us3tfI8569s75cc+1nqXtu9N62vMOmWtnarmhrTXHWb+y5lc9ez2Al1t9uFr+LLcan2nz8j603hZn7ZC5XXx3nI5a1q/mZqvaKv8qV/db9bV8yz3iyjpn73k2963mZH6sn/uMcd6vyLV27vamzLUzrOLD6nwZp6y3fVvuit07WeUB3lb7cK0+dJnLvtX4TJuX9zHOeHZWy/pZvMvnuGlzc07GV53NG3u16xFX5636Mv+VZ0lX1rmz31lfrpXxMOfzfsXd3iv9ra/Feb55vOtvtTT3Zj33WuWu2PXuagBvafXhah/Jds++vK5oa8zxPM645Ueu3YeMD2293K/tlXLOPL4at3G73s3qmTLf4nbmXS3zK2f1u9p6mctna897JZ7zK3Nt13fIels718s4rZ653cf4bn7c5545N49zjZwzcgAfYf64tY9Xq2U857KWcdPmtjVWudW8EV+5Zi13yDmtZ7bqm3Nn9924xa90Z6/snd/F6jxtPPe3ceZWspbxrK3dtNpqbubynrnMt71mrb7KtWtl1beas+vPOa1+paflZ7lOxrNVHuCfNn+Udx/Rv9n8g7P78clc5vP+ao/sc3dOnnllfh+zlnsn7Xwtl/HqvP+y3Xsbzt5fywHA/z8c+UNyJTfs+l7l0fXvzsszra5d7zs7e/a8Ru+4v/v5vkt7R+0atblnljEAfKy7P2p3+wEA+IKrf3y1f9kAAODF8o+wOxcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8uv8APvTjORuAr4sAAAAASUVORK5CYII=>

[image50]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAZCAYAAACo79dmAAAAiElEQVR4Xu2UUQrAIAxDvf+lN/bhKG9RxDl1kAeFGmMbGCwlY8w0jkJtzfYBIw77FQ47mhV/gO59vwxbonbXi9rJs0Q9vFB6/AqqSIvOGcp/UzIonUNZpEXnjIefl7WiP8M+nqPGGewzPL+GAWOvlqmA9CltCAwYe7VwSVg1UIVVnlqVPMaYGZys8IZ6pBY21wAAAABJRU5ErkJggg==>

[image51]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAtCAYAAAATDjfFAAAB5UlEQVR4Xu3ZW4rcQAwF0Nlk9r+UhIYIiotkl3ucZnDOgcIuSdWvr4v76wsAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+Kd+/12d6nX9tTfNAABwgylsZS33ZaoDAHCTLrDl/mWayxoAADeqsLWGrimEdfXcAwBwsymwdbp6VwMA4CZTSJtCWNbziVv2r/jOWQCAR8qA1AWvCmQ5W7K+znZns5b3XW06s74uAMCj7Iagrp+9nClH9/maZ+dLvmc3AwBwKMPEUwLFFKrSFLi6M/n75MzUzzkAgLc8MVRkgOrUzM6a5st6X/tuAQBc9uQg8dTvBQD8Z4QaAIAf7pOBLf8ezAUAQCODUu531Jl3zp759dAFALClC1hrLZ+ATU/DjnoAALwhA1YXtrr73SsAAB90Fty6/qfl51hVb5o56wMA/HgZznbWp1153905AABuchQUp1rWcw8AwE3WoJWhqwtmL1099wAA3OQssHW6elcDAOCb6knZula5L129q3V2516uzAIAPFIGorP9yxTssjbZnXu5MgsA8CgVsNZA1NWqXteulyt7KWfqOtUBANgwBaqUM91cztQ1691ZAAAOVIg6ClLrzNEqWe8WAAAXCFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsOsPO5dJxX7Bq2EAAAAASUVORK5CYII=>

[image52]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAABkklEQVR4Xu3W227EIAwFwP7/T7fiAck6MiTb9JKmMxLa2DhAtA/47Q0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu6z0TAAB/yWhmctxNnqnGZ86c8xkPuWZ1Zo/POrPuquY7zwUA3MzdL/7V2TKf8UpX1+WGzGd8RV1rte7M53+Uz6v3AYCHuPtlPxuSPOdRvNLVdesPmcv4imy6dnbzuzkA4CF+8sKvzVc3OqvGJuszHl7N5fpZm/GQ31DHSs4f1XZyDQDgwfLSz/gVV949ozYpuVfGw9nclE1Q1mZ8xW6flOeqdnMAwAN0l33Grzh6d+63Gp2ar3VZfxRPXb6umftVGQ/5DXXs7PaZzpwr5wCAh+ku+mwSsgHJBiHz3ZpX5F51v+oonrp8fkPmV/EVq3265925cg4AeIh5yXejzs/n+rvKdfFX6M63y0+Zy/rVWtWq/ius1q25o5puDgD4R7IZ6J53Nb/pLucAAGBBwwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFzyAdlY6Bi20trRAAAAAElFTkSuQmCC>

[image53]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIEAAAAWCAYAAADnw/+rAAABcElEQVR4Xu2QQYrFMAxDc/9LzxBowCiSY1NKFl8PsnmWXdExjDHGGGN2/shTVHNfgz06XXCP7eKcZW6BvbJu1dwWzMLV3Ndgj04X3GO7OGeZW2CvrFsphwMV7vovUd9TPoIZ9oMqmVtgB9WNuQn1m3hAT5eH9pFTJpsxVF75jFO3SSVzC9Wt5TfxgJ4uD+0jp0w2Y6i88hmnbpNK5haqW8tv4gE9XR7aMzDX2Y2oHeWR9d34EJyzzC2wF+vW8ijYYeYWyiuyWydOu8pnZPcWlUwk9qy8N7Ab2W3qUbADzC2UV2S3Tpx2lc/I7i0qmUjsWXlvYDey28rTJQzifKG8gn2ri9pVPqPSp5KJxHzlvUHdYW5CPQoaGn3PwFxnN6J2lI9gZnWIvpK5BXZQ3ZibUI+ChkbfMzDX2Y2oHeUjmFkdoq9kboEdVDfmJtTHI+rgBOcqxzhlsxkDO7D7Ff8mcwvspLrhXOWMMcYYY4wxP88/cIl9kU7p25gAAAAASUVORK5CYII=>

[image54]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAAAYCAYAAACssfJFAAACJUlEQVR4Xu2TjWoDMQyD+/4vvXGDgKZJ/rlLt3bnDwyJLOvSkD4ewzAMwzAMQ8IHC8NwJ+YPMNyS4+GvcqDHlYI9mf+O8L1khTj9r9l5rm5W158OOB2JPFn+nXF3UtVf9V6fcaZqZvtOsgfqdCTyZPl3xt1JVX/Ve33GmaqZrTtBIw91Hm7kdfq7gb9x1+9xOVUdz7LzXFfBc+w6U5TTvgdlUnvWHMur/E5/d6LffJVqpjoDr7NCuFfxKLgfeQ84szuL68z/hTKpPWuO6MNOf3ei33yVaqY6A6+zQrhX8Si4H3kPOLM7i+vMb5usp0FA5Ovk/CY7z1S6+AKdHOfFfWW99kpTVHKczlT0ioc11r+BJi5EaYybXWT9DrtyFruzuM7QmXW+M7oqR+RT2sEVXXmi76fgMBeiNMbNLrJ+h105i91ZXGfozDrfGV2VI/Ip7eCKrjzR9y1qAOGe8qs9a0jUWzgP6viD2a80xPWcXsWd5wqdPPbhrFs7nCfLUXulubXzu1IehD0/AtwQF8I67xnOcl6VWV0vOL+yXvA+A7/VnY3gXC4H93hu9bOcA55TM9yLPEqr9DKP01WFJoR7UV/tGc5yXpVZXS84v7Je8D4Dv9WdjeBcLgf3eG71s5wDnlMz3Is8Sqv0Mo/TVT0F9wHeZ7Df5SKuj7rLUZ5hOAU+srOPiee7hXCvU8PQhh/RmYfE891CuNepYRiGYRiGYRiG4Z/wCUlqvl6zSVsqAAAAAElFTkSuQmCC>

[image55]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAYCAYAAABXysXfAAAAmklEQVR4Xu2T2wrAMAhD9/8/vdEHoQRvTfsgqweENdrMDPY8TdNcz6uURmamDNGSXq8cV4Sx9NJY/4Omlef3YSqGwB1V5jCpCwuc9gr9MEh4YYHTXmm/TJioJ338OKh7WDOWruINRgvNZ++Z9ZEzaibeILsEPrM+ckZtGTSIFprBnnVX8/GC0ciLdmuAGlNboBlbA9SYappmgw986rlH84dUsQAAAABJRU5ErkJggg==>

[image56]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAYAAAC8/X7cAAAAq0lEQVR4Xu2S2wqAMAxD/f+fVvYwKSHpWpFZxw4UtqyXVDyOzWazBCcJRiTnU0bGvLcSLLuA0suh/m+mlWTJBX5hvGMXwEU6Sp+FOxvNs2SlzyI0Wy0wWq6BOtbgeyOiYw+Wf+M9quLIMFZr79mzxEtiJhrMqA3M6ShzkfMjRib63TNtQXOjWrynsAPUYBWKbJ9IT4lqgDoLRbZPpOd0yhmKUPJLZvj9Aq9wAaJvsk4K925SAAAAAElFTkSuQmCC>

[image57]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKUAAAAYCAYAAACbfz1xAAABf0lEQVR4Xu2TW25EIQxDZ/+bbsUHVWrlBUWEgo8U6WJIcDLM50MIIYSQC/lCgZBq+CjJMbTH2OMkpC/LW+bMrWR6z5w5EjR+kvnIj7f3AtfOBx/kSY1Efry9F7hyPmg6anI3lh9Lfw1rDpb+L0DjvRnUq7D8aNqLXDkfNG41WYXlR9Ne5Kr5RKa9PQ05nExk0XJG8k8CZxBFBu18Nncn6FElOqQ164EDjSIL5mm5lr6L6rsxVrG6VlgvOjTaJA4miiyYp+Va+i6q78ZYxepabj13UxAW2og19MwPgjrm4H4jo2MN7fwuMh6ivaivqH7DOmPpP+CFmajG82B5lDr2g7pErke/q/A8rOp3tk5fo/YLeUE2qvE8WB6ljv2gLpHr0e8qPA+r+p2t09eoXY3WsLb2BirB4Ua5uD4J9Bb1IsE9K1erI9e4dz19IDgY1LWwGK2TqVkF+puNBmoz8QRW06hrYTFaJ1OzCvQ3Gw3UZoL8AQ6RHAH/0eQ4+CgJeZ1vV+bdMbXb+7EAAAAASUVORK5CYII=>

[image58]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAXCAYAAADtNKTnAAAASklEQVR4XmNgGDHgPxRTBKhqCNkGIWscXIaQ5C1cinGJYwW4FOMSxwpwKSbJS4QU4pODA4oNIaiAgQhvISsgBmMF6IoI4VEwJAAAZ8E9w121SaAAAAAASUVORK5CYII=>
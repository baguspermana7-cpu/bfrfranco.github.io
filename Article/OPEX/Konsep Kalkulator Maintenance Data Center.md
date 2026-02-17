# **Cetak Biru Arsitektur & Spesifikasi Fungsional: Kalkulator Maintenance & Operasional Data Center Generasi Berikutnya (DCMOC)**

## **1\. Ringkasan Eksekutif**

Dalam era digital yang berkembang pesat, khususnya di pasar pertumbuhan tinggi seperti Indonesia, pengelolaan infrastruktur pusat data (data center) telah bergeser dari sekadar manajemen fasilitas menjadi disiplin ilmu yang menuntut presisi finansial dan operasional tingkat tinggi. Pendekatan tradisional yang mengandalkan spreadsheet statis dan estimasi terpisah antara belanja modal (CAPEX) dan belanja operasional (OPEX) tidak lagi memadai untuk menangkap kompleksitas interdependensi infrastruktur kritis modern. Dokumen ini menyajikan kerangka kerja komprehensif untuk **Data Center Maintenance & Operations Calculator (DCMOC)**, sebuah alat berbasis logika algoritmik canggih yang dirancang untuk menjembatani kesenjangan antara desain fisik dan realitas operasional.

Mengacu pada standar estetika dan kedalaman analitis dari referensi *resistancezero.com*, kalkulator ini dirancang untuk menelan parameter desain CAPEX—seperti beban IT, dimensi *white space*, topologi tier, dan lokasi geografis—dan secara otomatis menerjemahkannya menjadi roadmap operasional yang terperinci. Sistem ini tidak hanya menghitung jumlah aset, tetapi juga menyimulasikan jadwal pemeliharaan Gantt chart yang mematuhi standar global (SFG20, ASHRAE) dan regulasi lokal Indonesia (SLO, K3 Listrik), serta memproyeksikan kebutuhan staf dengan presisi matematis.

Lebih jauh, konsep ini mengintegrasikan pemodelan finansial tingkat lanjut untuk membandingkan strategi pemeliharaan Original Equipment Manufacturer (OEM) melawan pendekatan Statutory-only, serta menghitung dampak ekonomi dari layanan Smart Hands dan beban kerja operator BMS. Dengan antarmuka pengguna (UI/UX) yang mengadopsi estetika "FinanceApplication" yang futuristik namun fungsional, alat ini bertujuan untuk memberdayakan para pengambil keputusan C-level dengan wawasan berbasis data yang dapat dipertanggungjawabkan.

## ---

**2\. Visi Arsitektur dan Desain Pengalaman Pengguna (UI/UX)**

### **2.1 Filosofi Desain: Estetika "Glass & Grid"**

Antarmuka pengguna bukan sekadar lapisan visual, melainkan jembatan kognitif antara logika algoritmik yang kompleks dan pengambilan keputusan manusia. Mengadopsi kerangka kerja visual dari *resistancezero.com*, DCMOC menggunakan identitas visual yang memprioritaskan kepadatan data, kejelasan, dan otoritas teknis.1

* **Hierarki Visual & Palet Warna:**  
  Antarmuka ini didasarkan pada tema "Dark-Blue Professional" dengan gradien primer (\#1e3a5f hingga \#3a7ca5) yang merepresentasikan stabilitas dan kedalaman teknis. Penggunaan warna aksen sangat strategis; "Accent Gold" (\#f59e0b) dan "Amber" (\#fbbf24) digunakan secara eksklusif untuk menyoroti Key Performance Indicators (KPI) kritis seperti "Total Annual OPEX" atau "Risk Score". Warna semantik seperti Emerald (\#10b981) untuk efisiensi dan Red untuk peringatan risiko kritis digunakan untuk memandu mata pengguna ke wawasan yang dapat ditindaklanjuti tanpa membanjiri bidang visual. Latar belakang menggunakan pola grid halus (50px linear grid) yang memberikan nuansa presisi arsitektural atau cetak biru teknis.  
* **Kerangka Kerja Glassmorphism:**  
  Elemen navigasi dan panel konfigurasi yang melayang (floating panels) menggunakan efek *glassmorphism* (backdrop-filter: blur(20px) dengan rgba(255, 255, 255, 0.85)). Pilihan desain ini memiliki tujuan fungsional: mempertahankan konteks dengan menjaga lapisan data yang mendasarinya tetap terlihat sebagian, memperkuat keterkaitan antara input CAPEX di lapisan bawah dan output OPEX di lapisan atas. Bayangan (shadows) yang dikalibrasi dengan cermat (--shadow-lg) memberikan kedalaman, memisahkan elemen interaktif dari data statis.  
* **Tipografi Berbasis Data:** Distingsi antara narasi dan data ditegakkan melalui tipografi. Font **Inter** digunakan untuk label, teks naratif, dan navigasi untuk memastikan keterbacaan tinggi pada berbagai ukuran layar. Sebaliknya, **JetBrains Mono** dicadangkan secara ketat untuk data numerik, angka keuangan, dan spesifikasi teknis. Font *monospaced* ini memastikan penyelarasan vertikal yang sempurna dalam tabel data yang padat, yang sangat krusial ketika membandingkan varians biaya pemeliharaan yang mencapai jutaan dolar.1

### **2.2 Perjalanan Pengguna (User Journey) dan Alur Interaksi**

Kalkulator ini dirancang sebagai progresi linier dengan loop umpan balik siklus, memindahkan pengguna dari input arsitektural makro ke output operasional mikro.

1. **Tahap Input (Integrasi CAPEX):**  
   Pengguna memulai di modul "Construction Data Ingestion". Di sini, mereka mendefinisikan realitas fisik situs. Input tidak sekadar kolom teks, melainkan slider dinamis dan *blueprint* interaktif.  
   * **Input Inti:** Beban IT (100 kW – 100 MW), Kepadatan Rak (kW/rack), Tingkat Tier (I-IV), dan Faktor Lokasi (misalnya, Jakarta vs. Cikarang vs. Batam).  
   * **Umpan Balik Visual:** Saat pengguna menggeser slider "IT Load", visualisasi *real-time* memperbarui estimasi "White Space Area" dan "Grid Power Requirement", memberikan pemeriksaan kewarasan (*sanity check*) instan terhadap asumsi desain.1  
2. **Tahap Pemrosesan (Konfigurasi Operasional):**  
   Setelah kerangka fisik didefinisikan, pengguna mengonfigurasi "jiwa" operasional fasilitas tersebut.  
   * **Seleksi Model:** Sakelar *toggle* memungkinkan perbandingan instan antara model staf "In-House", "Outsourced", dan "Hybrid".  
   * **Pemilih Strategi:** Slider proprietari "Risk vs. Cost" menyesuaikan kedalaman pemeliharaan dari "Statutory Minimum" (Kepatuhan Hukum) ke "OEM Comprehensive" (Rekomendasi Pabrikan) hingga "Predictive/RCM" (*Reliability Centered Maintenance*).  
3. **Tahap Output (Pelaporan & Dasbor):**  
   Tampilan akhir adalah dasbor komprehensif yang menampilkan:  
   * **Financial Waterfall Charts:** Memvisualisasikan aliran biaya dari Gross CAPEX ke Annual OPEX.  
   * **Gantt Chart Timeline:** Tampilan pemeliharaan interaktif 52 minggu yang dapat di-zoom.  
   * **Staffing Heatmaps:** Menunjukkan kepadatan cakupan staf di seluruh 3 shift.  
   * **Ekspor PDF:** Pembuatan "Laporan Eksekutif" satu klik yang meniru struktur laporan *resistancezero.com*, lengkap dengan ringkasan eksekutif, skor benchmarking, dan item tindakan yang diprioritaskan.1

## ---

**3\. Modul 1: Mesin Penerjemah Aset (CAPEX ke Inventaris Peralatan)**

Inovasi inti dari DCMOC adalah kemampuannya untuk menyimpulkan daftar aset (Asset Register) yang terperinci dari parameter desain tingkat tinggi. Pengguna tidak perlu secara manual memasukkan "12 Genset"; kalkulator harus menurunkan ini dari Beban IT dan Topologi Tier yang dipilih.

### **3.1 Logika Derivasi: Dari Beban IT ke Inventaris M\&E**

Kalkulator menggunakan mesin logika berjenjang (*cascading logic engine*) untuk mendimensikan fasilitas secara otomatis.

#### **3.1.1 Dimensi Rak dan Ruang (Space Dimensioning)**

Unit fundamental dari data center adalah rak. Kalkulator pertama-tama menentukan jumlah rak untuk menetapkan selubung spasial.

* **Formula Dasar:**  
  ![][image1]  
* **Perhitungan White Space:**  
  Menggunakan benchmark industri, kalkulator menerapkan pengali untuk lorong (aisles), PDU, dan kolom struktural.  
  * *Kepadatan Standar (5kW/rak):* \~2.5 hingga 3.0 ![][image2] per rak.  
  * *Kepadatan Tinggi (15kW+):* \~2.0 ![][image2] per rak (memerlukan *containment* yang lebih ketat).  
  * **Logika:**  
    ![][image3]  
  * **Referensi:** Seperti yang terlihat dalam laporan CAPEX 1, beban 1.000 kW pada kepadatan standar membutuhkan 418 ![][image2], sementara kepadatan tinggi hanya membutuhkan 100 ![][image2]. Perbedaan ini secara drastis mempengaruhi biaya pembersihan dan keamanan.

#### **3.1.2 Penentuan Ukuran Infrastruktur Listrik (Electrical Sizing)**

Setelah beban IT didefinisikan, rantai daya hulu dihitung berdasarkan Tingkat Redundansi (Tier Topology) yang dipilih.

* **Total Facility Load (TFL):**  
  ![][image4]  
  *Catatan:* PUE bervariasi berdasarkan tipe pendinginan (Udara \= 1.5 \- 1.8, Cair \= 1.2).  
* **Penentuan Ukuran Generator (Genset):**  
  * *Kendala:* Genset diukur untuk peringkat *continuous prime*, biasanya dibebani pada 70-80% untuk keamanan operasional.  
  * *Kapasitas:*  
    ![][image5]  
  * *Logika Redundansi:*  
    * **Tier III (N+1):** Jika permintaan adalah 2 MW, sistem akan menyarankan instalasi ![][image6] unit.  
    * **Tier IV (2N):** Jika permintaan adalah 2 MW, sistem akan menyarankan instalasi ![][image7] unit (dua jalur terpisah A/B).  
* **Penentuan Ukuran UPS:**  
  Dihitung berdasarkan Beban IT \+ Beban Mekanikal Kritis (jika pendinginan berkelanjutan diperlukan, seperti pada beban kepadatan tinggi).  
  * *Logika:* Blok modular (misalnya, modul 500 kVA) dikumpulkan untuk memenuhi permintaan dengan margin keamanan.  
* **Distribusi Hilir (Downstream):**  
  * *RMU/Switchgear:* Dihitung berdasarkan jumlah feed Tegangan Menengah (MV) yang masuk (misalnya, 2 feed utama dari PLN untuk Tier IV).  
  * *Trafo:* Dipasangkan 1:1 dengan aliran generator/utilitas untuk isolasi gangguan.

#### **3.1.3 Penentuan Ukuran Infrastruktur Pendinginan (Cooling Sizing)**

Aset pendingin diturunkan dari persyaratan penolakan panas (*heat rejection*).

* **Beban Pendinginan:**  
  ![][image8]  
* **Seleksi Chiller:**  
  * Jika *Water Cooled*: Output mencakup Chillers \+ Cooling Towers \+ Pompa Sirkulasi \+ Unit CRAH.  
  * Jika *DX/Air Cooled*: Output mencakup Air Cooled Chillers \+ Unit CRAC.  
* **Kuantitas Unit:**  
  ![][image9]  
  * *Contoh Logika:* Untuk beban 1000 kW menggunakan CRAC 100 kW pada redundansi N+20%: ![][image10] Unit.

#### **3.1.4 Sistem Non-Kritis & Pendukung (Grey Space)**

Kalkulator juga mengestimasi aset "Grey Space" yang sering diabaikan dalam estimasi tingkat tinggi namun kritis untuk penganggaran pemeliharaan.

* **Pemadam Kebakaran (Fire Suppression):**  
  * *Gas:* Volume gas FM200/Novec 1230 dihitung berdasarkan Volume Ruangan (![][image11]).2  
  * *Sprinkler:* Sistem *Pre-action* untuk area non-kritis (koridor, kantor).  
* **Poin BMS:**  
  Diestimasi sekitar \~50 poin per rak \+ \~100 poin per aset infrastruktur utama (Chiller, Genset). Ini mendorong estimasi lisensi perangkat lunak BMS dan beban kerja operator.  
* **Keamanan Fisik:**  
  * *CCTV:* 1 kamera per lorong \+ 1 per pintu masuk/keluar \+ Jarak perimeter (setiap 30m).  
  * *Access Control:* Pembaca biometrik/kartu di setiap transisi zona keamanan (mantrap, pintu white space).

### **3.2 Output: Register Aset Otomatis**

Output dari Modul 1 adalah objek data terstruktur (JSON) yang diumpankan ke modul berikutnya.

* **Contoh Output (Fasilitas 1 MW Tier III):**  
  * 3x 1.5 MW Diesel Generators.  
  * 3x 1.5 MVA Trafo (Step-down).  
  * 1x RMU 20kV (3-Way).  
  * 4x 500 kVA UPS Modules (Modular N+1).  
  * 10x 120 kW CRAH Units.  
  * 1x Sistem Deteksi Kebakaran (VESDA \+ Point Detectors).  
  * 200x Rak Server.  
  * 1x Sistem BMS Terintegrasi.

## ---

**4\. Modul 2: Strategi Pemeliharaan & Penjadwalan (Lapisan Pemrosesan)**

Dengan daftar aset yang telah didefinisikan, kalkulator menerapkan logika pemeliharaan. Bagian ini membedakan antara "Rekomendasi OEM" (seringkali konservatif dan mahal) dan strategi "Statutory/Risk-Based", yang merupakan tuas penting untuk optimalisasi OPEX.

### **4.1 Opsi Strategi: OEM vs. Statutory**

Pengguna dapat memilih filosofi pemeliharaan, yang akan menyesuaikan pengali biaya dan frekuensi tugas.

#### **4.1.1 Strategi OEM (Standar "Gold Plated")**

* **Definisi:** Kepatuhan ketat terhadap jadwal pabrikan untuk mempertahankan garansi penuh dan memastikan umur aset maksimum.  
* **Dampak Biaya:** Tinggi. Mencakup tarif tenaga kerja premium untuk insinyur bersertifikat OEM dan suku cadang asli (proprietary).  
* **Pro:** Memaksimalkan umur aset (misalnya, UPS 10-15 tahun), menjamin pembaruan firmware/patch keamanan, risiko kegagalan katastropik terendah.3  
* **Kontra:** Bisa 30-40% lebih mahal daripada TPM (*Third Party Maintenance*). OEM sering mendorong siklus penyegaran perangkat keras (End-of-Life) yang agresif.

#### **4.1.2 Strategi Statutory/TPM (Keseimbangan "Kepatuhan & Biaya")**

* **Definisi:** Memenuhi persyaratan hukum minimum (misalnya, NFPA 110 untuk genset, SLO lokal untuk listrik) dan menggunakan penyedia pemeliharaan pihak ketiga (TPM).  
* **Dampak Biaya:** Moderat/Rendah. Penyedia TPM menawarkan penghematan 30-40% dibandingkan OEM.3  
* **Pro:** Kontrak fleksibel, dukungan multi-vendor dari satu tim, OPEX yang berkurang secara signifikan.  
* **Kontra:** Risiko "kesenjangan pengetahuan" pada sistem *proprietary* yang kompleks, potensi keterlambatan dalam *patch* firmware yang rumit.5

### **4.2 Pembuatan Gantt Chart Otomatis**

Kalkulator menghasilkan Gantt chart visual berdasarkan strategi yang dipilih. Mesin logika memanfaatkan standar seperti **SFG20** (Standar Pemeliharaan Bangunan UK) dan **ASHRAE** untuk mengisi frekuensi tugas secara otomatis.

#### **4.2.1 Tabel Jadwal Sistem Kritis (Sampel Logika)**

| Aset | Frekuensi | Deskripsi Tugas (Referensi SFG20/NFPA) | Tipe Staf Pelaksana | Durasi (Man-Hours) |
| :---- | :---- | :---- | :---- | :---- |
| **Diesel Generator** | Mingguan | Uji tanpa beban (No-load test) sesuai NFPA 110\.6 | In-House | 0.5 |
|  | Bulanan | Inspeksi visual, cek level oli/coolant, cek baterai starter. | In-House | 2.0 |
|  | Semesteran | Sampling bahan bakar, penggantian filter bahan bakar/oli.7 | Vendor (OEM/TPM) | 4.0 |
|  | Tahunan | Uji beban (Load bank testing) 2-4 jam, servis penuh. | Vendor (OEM/TPM) | 8.0 |
| **UPS** | Triwulanan | Pengecekan visual, tinjauan log alarm, cek lingkungan. | In-House | 1.0 |
|  | Tahunan | Termografi inframerah, cek kapasitor, uji bypass statis. | Vendor (Spesialis) | 6.0 |
| **Chiller** | Bulanan | Tinjauan log operasional, cek kebocoran refrigeran. | In-House | 1.0 |
|  | Triwulanan | Pembersihan kondensor, analisis oli kompresor. | Vendor | 4.0 |
| **Sistem Kebakaran** | Semesteran | Penimbangan silinder FM200/Novec, inspeksi nozzle.8 | Vendor (Bersertifikat) | 4.0 |
| **Trafo / RMU** | Tahunan | Pembersihan, pengencangan koneksi, uji DGA (minyak). | Vendor | 4.0 |

#### **4.2.2 Jadwal Sistem Non-Kritis**

Kalkulator juga menjadwalkan pemeliharaan "Grey Space" yang sering kali dilupakan dalam estimasi tingkat tinggi:

* **VRV/FCU (Pendingin Kantor):** Pembersihan filter triwulanan (In-house/Janitorial).  
* **Pencahayaan:** Pengecekan level lux tahunan dan penggantian bohlam.  
* **Perangkat Keras Pintu/Keamanan:** Pengecekan fungsi kunci dan *latch* triwulanan untuk memastikan kepatuhan akses fisik.

### **4.3 Mesin Perhitungan Jam Kerja (Man-Hour Calculation)**

Sistem mengagregasi jam-jam ini untuk menentukan total beban kerja pemeliharaan.

* **Formula:**  
  ![][image12]  
* **Wawasan:** Agregat ini sangat penting untuk menentukan apakah tim "In-House" kekurangan atau kelebihan staf. Jika beban kerja pemeliharaan preventif (PM) yang dihitung adalah 200 jam/bulan dan model staf menyediakan 320 jam kerja yang tersedia, sisa 120 jam dapat dialokasikan untuk tugas reaktif, proyek, atau peningkatan fasilitas.

## ---

**5\. Modul 3: Algoritma Tenaga Kerja & Staf**

Staf mewakili sekitar 30% dari total OPEX data center.1 Kalkulator menggunakan pendekatan *bottom-up* untuk membangun "Struktur Organisasi" berdasarkan realitas fisik dan operasional fasilitas.

### **5.1 Model Staf Teknis (Cakupan 24/7)**

Data center memerlukan kehadiran fisik yang berkelanjutan. Kalkulator menggunakan logika **Erlang C** yang diadaptasi untuk kerja shift.

* **Logika Pola Shift:**  
  * *Persyaratan:* 168 jam/minggu (24 jam x 7 hari).  
  * *Minggu Kerja Standar:* 40 jam per orang.  
  * *FTE Dasar:* ![][image13] FTE per satu pos jaga.  
  * *Faktor Absensi (Konteks Indonesia):* Memperhitungkan cuti tahunan (12 hari), libur nasional (\~15 hari), cuti sakit, dan pelatihan. Faktor **1.3** diterapkan untuk keamanan operasional.9  
  * *Total FTE per Pos:* ![][image14] (Dibulatkan menjadi **6 FTE** untuk ketahanan).  
* **Perhitungan Berbasis Peran:**  
  * **Fasilitas Tier III (1-5 MW):**  
    * *1x Chief Engineer (Day Shift):* Pengawasan strategis, pemegang sertifikat K3 Listrik.  
    * *2x Duty Engineers (Shift):* 1 Bias Elektrikal \+ 1 Bias Mekanikal per shift untuk memastikan kemampuan respons segera terhadap insiden apa pun.  
    * *Kalkulasi:* 2 pos jaga ![][image15] 6 FTE \= 12 Insinyur Shift \+ 1 Chief \= **13 Staf Teknis**.  
  * **Absorpsi Smart Hands:** Jika fasilitas menawarkan Colocation, kalkulator berasumsi tugas "Smart Hands" (reboot, pengkabelan) menghabiskan \~20% waktu insinyur shift. Jika volume melebihi ambang batas ini, peran "Teknisi IT" khusus akan dipicu secara otomatis.

### **5.2 Staf Keamanan Fisik (Security)**

Keamanan dihitung berdasarkan titik akses fisik, bukan beban IT.

* **Definisi Pos Jaga:**  
  * *Gerbang Utama:* Cakupan 24/7 (Pemeriksaan kendaraan/tamu).  
  * *Security Control Room (SOC):* Cakupan 24/7 (Pemantauan CCTV/Akses).  
  * *Lobi/Resepsionis:* Cakupan 12/7 (Jam kerja bisnis).  
* **Kalkulasi (Contoh):**  
  ![][image16]  
* **Variabel:** Pengguna dapat mengaktifkan "Roving Patrols" (Patroli Keliling) yang menambahkan \+1 Pos (6 FTE).

### **5.3 Staf Kebersihan (Cleaning & Janitorial)**

Pembersihan di data center terbagi menjadi "White Space" (Standar ISO 14644-1 Kelas 8\) dan "General/Grey Space".

* **Pembersihan White Space:**  
  * *Standar:* Pembersihan permukaan (harian) \+ Sub-floor/Plenum (Tahunan/Semesteran).  
  * *Benchmark:* 1 Petugas Kebersihan dapat memelihara \~1.000 ![][image2] *white space* dengan standar ISO (pembersihan debu mikro, pel anti-statis) per shift.  
* **Pembersihan Umum:**  
  * *Benchmark:* 1 Petugas Kebersihan per 2.000 ![][image2] untuk kantor/koridor.  
* **Output:** Kalkulator menjumlahkan area dari Modul 1 dan menerapkan rasio ini untuk menghasilkan jumlah FTE.

### **5.4 Opsi Model Operasional**

Pengguna memilih model operasi, yang menerapkan struktur biaya berbeda pada jumlah staf yang dihitung:

* **In-House:** Biaya tetap tinggi (Gaji \+ Tunjangan \+ Pelatihan \+ Asuransi). Kontrol kualitas tertinggi.  
* **Vendor (Outsourced):** Biaya variabel (Biaya Jasa \+ Margin Vendor). Skalabilitas fleksibel.  
* **Hybrid:** Manajemen in-house (Chief Eng) \+ Vendor untuk shift (Teknisi/Keamanan). Ini adalah model yang paling umum di Indonesia untuk menyeimbangkan kontrol dan biaya.1

## ---

**6\. Modul 4: Mesin Finansial & Prakiraan OPEX**

Output dari modul-modul sebelumnya berkumpul di mesin finansial. Modul ini menerapkan basis data biaya yang dilokalkan untuk menghasilkan angka OPEX akhir.

### **6.1 Basis Data Biaya & Lokalisasi (Konteks Indonesia)**

Kalkulator dimuat dengan biaya unit yang relevan untuk wilayah yang dipilih pengguna (misalnya, Indonesia 2025/2026).

* **Tarif Tenaga Kerja (Estimasi Pasar):**  
  * *Chief Engineer:* \~IDR 30 Juta \- 45 Juta / bulan (Tergantung sertifikasi CDFOM/ATD).10  
  * *Teknisi/Operator:* \~IDR 8 Juta \- 12 Juta / bulan (Berbasis UMK \+ Tunjangan Keahlian Shift).  
  * *Satpam:* \~IDR 6 Juta \- 8 Juta / bulan (Tarif outsourcing standar).  
* **Biaya Regulasi (Spesifik Indonesia):**  
  * **SLO (Sertifikat Laik Operasi):** Biaya ini wajib untuk setiap instalasi pembangkit tenaga listrik.  
    * Genset (\>1 MVA): \~IDR 25 Juta \- 50 Juta per unit (setiap 5 tahun/instalasi baru).11  
    * Trafo: \~IDR 5 Juta \- 10 Juta per unit.  
  * **Riksa Uji K3 Listrik:** Inspeksi keselamatan berkala yang wajib dilakukan oleh PJK3 (Perusahaan Jasa Keselamatan dan Kesehatan Kerja). Diestimasi sekitar \~1-2% dari nilai aset atau paket *lump sum*.  
  * **Pajak Bahan Bakar:** Harga solar industri (non-subsidi) yang berlaku.

### **6.2 Integrasi Smart Hands & Offset Pendapatan**

Untuk penyedia Colocation, tim pemeliharaan adalah pusat pendapatan, bukan hanya pusat biaya. Kalkulator menyertakan modul "Smart Hands".

* **Input:** Jumlah Rak ![][image15] Tingkat Layanan (misalnya, 2 jam/rak/bulan termasuk dalam kontrak).  
* **Logika:**  
  * **![][image17]**\*  
    ![][image18]  
* **Dampak:** Pendapatan ini dikurangkan dari Biaya Staf Bruto untuk menunjukkan "Biaya Operasional Bersih", menyoroti efisiensi tim teknis sebagai aset produktif.

### **6.3 Integrasi Operator BMS**

Kalkulator menilai kompleksitas Building Management System (BMS) untuk menentukan beban kerja operator.

* **Jumlah Poin:** Diturunkan dari daftar aset (misalnya, 1 Chiller \= 50 poin monitoring).  
* **Beban Alarm:** Mengestimasi alarm harian berdasarkan jumlah poin.  
* **Dampak Staf:** Jika beban alarm melebihi ambang batas (misalnya, \>100 alarm/shift), kalkulator menyarankan peran **Operator BMS** khusus, memisahkannya dari Duty Engineer untuk mencegah kelelahan alarm (*alarm fatigue*) dan memastikan respons insiden yang cepat.

## ---

**7\. Pelaporan & Sub-sistem Visualisasi**

Kalkulator ini tidak hanya menghasilkan angka, tetapi narasi profesional. Fitur ekspor PDF dirancang secara dinamis menggunakan pustaka jspdf atau pdfmake.1

### **7.1 Struktur Laporan PDF**

Laporan yang dihasilkan secara otomatis mengikuti struktur dokumen profesional:

1. **Ringkasan Eksekutif:** Skor Efisiensi (0-100), Benchmarking Biaya ($/kW/bulan), dan Status Risiko.  
2. **Inventaris Aset:** Daftar detail yang dihasilkan oleh Modul 1\.  
3. **Jadwal Pemeliharaan:** Gantt chart 52 minggu yang menunjukkan distribusi beban kerja.  
4. **Struktur Organisasi:** Bagan visual dengan jumlah FTE per peran.  
5. **Perincian Finansial:** Diagram lingkaran untuk Staf vs. Energi vs. Pemeliharaan.  
6. **Dasbor Regulasi:** Daftar periksa sertifikasi Indonesia yang diperlukan (SLO, K3, Izin Genset) beserta estimasi biaya dan tanggal pembaruan.

## ---

**8\. Analisis Dampak & Pemodelan Risiko**

Bagian ini memberikan wawasan mendalam tentang implikasi dari pilihan yang dibuat dalam kalkulator, memberikan nilai tambah strategis bagi pengguna.

### **8.1 Dilema Strategi Pemeliharaan: OEM vs. Statutory**

Pilihan strategi pemeliharaan adalah tuas terbesar untuk kontrol OPEX non-energi.

* **Jebakan OEM:** Mengandalkan sepenuhnya pada OEM memberikan keamanan tertinggi tetapi mengakibatkan "Vendor Lock-in". Biaya cenderung meningkat seiring bertambahnya usia peralatan, dan OEM sering mendorong penyegaran CAPEX (taktik *End-of-Support*). Kalkulator memodelkan ini dengan menerapkan "Faktor Eskalasi" tahunan sebesar 5-7% untuk kontrak OEM.  
* **Alternatif Statutory/Hybrid:** Model Hybrid, di mana pembaruan firmware kritis dikelola OEM tetapi tenaga kerja mekanikal/elektrikal ditangani oleh penyedia TPM yang kompeten, sering kali menghasilkan TCO optimal. Logika kalkulator menyarankan "Jalan Tengah" ini secara default, mengestimasi penghematan biaya 20-30% dengan peningkatan risiko yang dapat diabaikan, asalkan penyedia TPM memegang sertifikasi K3 yang valid.

### **8.2 Biaya Tersembunyi dari Pemeliharaan Reaktif**

Kalkulator menyertakan "Penyesuai Risiko" (*Risk Adjuster*). Jika pengguna memilih strategi pemeliharaan "Statutory Minimum" untuk menghemat biaya, kalkulator secara otomatis:

1. Meningkatkan "Anggaran Pemeliharaan Reaktif" sebesar **25-30%** (benchmark industri).12  
2. Menurunkan probabilitas "Projected Uptime".  
3. Menandai peringatan "High Risk" dalam Ringkasan Eksekutif.  
   Hal ini mendidik pengguna bahwa penghematan OPEX dalam pemeliharaan preventif sering kali hanya menggeser biaya ke ember "Perbaikan Darurat", yang jauh lebih mahal karena biaya tenaga kerja lembur dan pengiriman suku cadang yang dipercepat.

## ---

**9\. Penutup & Peta Jalan Masa Depan**

Konsep **Data Center Maintenance & Operations Calculator** ini merepresentasikan lompatan signifikan dari alat estimasi statis. Dengan menghubungkan secara dinamis logika desain CAPEX dengan realitas operasional OPEX, alat ini memberikan peta jalan yang transparan, dapat dipertahankan, dan dapat ditindaklanjuti untuk manajemen fasilitas.

Khusus untuk pasar Indonesia, integrasi titik data **SLO, K3 Listrik, dan UMK** mengubah alat ini dari kalkulator generik menjadi aset kepatuhan dan penganggaran yang kritis. Ini memberdayakan operator untuk tidak hanya mengestimasi biaya tetapi juga *mengoptimalkannya*—menyeimbangkan garis tipis antara pemotongan biaya yang agresif dan imperatif mutlak dari *uptime*.

Evolusi masa depan dari kalkulator ini terletak pada **Integrasi Telemetri Real-Time**. Dengan mengumpankan data BMS langsung kembali ke mesin logika, alat ini dapat beralih dari "kalkulator perencanaan" menjadi "dasbor operasional langsung", menyesuaikan jadwal pemeliharaan secara dinamis berdasarkan tekanan peralatan aktual daripada asumsi berbasis waktu—mencapai cita-cita tertinggi dari *Reliability Centered Maintenance*.

### ---

**Tabel 1: Matriks Frekuensi Pemeliharaan & Logika Staf (Standar Industri)**

| Kelompok Sistem | Peralatan | Strategi OEM (Frekuensi) | Strategi Statutory (Frekuensi) | Pemilik Staf Utama | Dampak Statutory-Only |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Daya Kritis** | Generator | Bulanan \+ 6B/12B Mayor | Lari Bulanan \+ Load Bank Tahunan | Vendor (Spesialis) | Risiko Tinggi (Keandalan turun jika filter/bahan bakar tidak dikelola proaktif) |
|  | UPS | Semesteran | Tahunan | Vendor (Spesialis) | Risiko Sedang (Risiko kegagalan baterai meningkat) |
|  | Switchgear | Tahunan (Termografi) | 3-Tahunan (Shutdown) | In-House (Visual) / Vendor | Risiko Rendah (Aset statis) |
| **Pendinginan** | Chiller | Bulanan | Triwulanan | Vendor (Spesialis) | Risiko Sedang (Efisiensi turun, OPEX energi naik) |
|  | CRAC/CRAH | Triwulanan | Semesteran | In-House / Vendor | Risiko Rendah (Penyumbatan filter \= lonjakan energi kipas) |
| **Keselamatan** | Pemadam Api | Semesteran | Tahunan (Diatur Regulasi) | Vendor (Bersertifikat) | **Ilegal** (Harus memenuhi min. regulasi) |
| **Umum** | BMS | Berkelanjutan | Reaktif | In-House (Operator) | Risiko Tinggi (Alarm terlewat, tuning tidak efisien) |

### **Tabel 2: Logika Perhitungan Staf (Contoh: Fasilitas 5 MW)**

| Peran | Rumus / Pemicu | Pola Shift | Est. Headcount (FTE) | Catatan |
| :---- | :---- | :---- | :---- | :---- |
| **Facility Manager** | 1 per Situs | Day Only | 1 | Pengawasan strategis. |
| **Chief Engineer** | 1 per Situs | Day Only | 1 | Otoritas teknis (Sertifikasi K3). |
| **Shift Lead (Elect)** | 1 per Shift (24/7) | 4-Shift / 3-Shift | 4 \- 6 | Cakupan 24/7 Diperlukan. |
| **Shift Tech (Mech)** | 1 per Shift (24/7) | 4-Shift / 3-Shift | 4 \- 6 | Cakupan 24/7 Diperlukan. |
| **Security Guard** | 1 per Gerbang \+ 1 Ruang Kontrol | 24/7 | 8 \- 12 | Berbasis titik akses fisik. |
| **Cleaner** | 1 per 1000 ![][image2] White Space | Day / Swing | 2 \- 4 | Standar ISO 14644-1. |
| **Total** |  |  | **20 \- 30** | Sesuai benchmark 15-35 staf untuk fasilitas Menengah.13 |

### **Tabel 3: Model Varians Finansial (OEM vs. Statutory)**

| Kategori Biaya | Model OEM ($) | Model Statutory ($) | Varians (%) | Profil Risiko |
| :---- | :---- | :---- | :---- | :---- |
| **Maint. Preventif** | $500,000 | $350,000 | \-30% | OPEX Lebih Rendah, Risiko Operasional Lebih Tinggi. |
| **Perbaikan Reaktif** | $50,000 | $100,000 | \+100% | Biaya reaktif melonjak karena inspeksi berkurang. |
| **Inventaris Suku Cadang** | $100,000 | $100,000 | 0% | Inventaris statis, tingkat penggunaan bervariasi. |
| **Admin/Manajemen** | $50,000 | $75,000 | \+50% | Lebih banyak manajemen internal diperlukan untuk multi-vendor. |
| **Total Biaya Tahunan** | **$700,000** | **$625,000** | **\-10.7%** | **Penghematan ada, namun risiko downtime ($9k/menit) melampaui penghematan.** |

#### **Works cited**

1. capex-calculator.html  
2. Fire Suppression System Cost Guide | FireTron, accessed February 17, 2026, [https://firetron.com/fire-suppression-systems/fire-suppression-system-cost/](https://firetron.com/fire-suppression-systems/fire-suppression-system-cost/)  
3. OEM vs TPM \- Is Third-Party Maintenance Better than OEM Support?, accessed February 17, 2026, [https://www.parkplacetechnologies.com/blog/oem-support-vs-third-party-maintenance/](https://www.parkplacetechnologies.com/blog/oem-support-vs-third-party-maintenance/)  
4. Third-Party Maintenance (TPM) vs OEM Support \- Service Express, accessed February 17, 2026, [https://serviceexpress.com/resources/oem-maintenance-vs-tpm-maintenance/](https://serviceexpress.com/resources/oem-maintenance-vs-tpm-maintenance/)  
5. The Truth Behind the Top 5 OEM Maintenance Myths | Data Center Frontier, accessed February 17, 2026, [https://www.datacenterfrontier.com/sponsored/article/11427571/service-express-the-truth-behind-the-top-5-oem-maintenance-myths](https://www.datacenterfrontier.com/sponsored/article/11427571/service-express-the-truth-behind-the-top-5-oem-maintenance-myths)  
6. Weekly or Monthly No Flow (Churn) Tests of Fire Pumps \- NFPA, accessed February 17, 2026, [https://www.nfpa.org/news-blogs-and-articles/blogs/2022/09/09/weekly-or-monthly-no-flow-churn-tests-of-fire-pumps](https://www.nfpa.org/news-blogs-and-articles/blogs/2022/09/09/weekly-or-monthly-no-flow-churn-tests-of-fire-pumps)  
7. Industrial Generator Preventative Maintenance Checklist \- GenServe, accessed February 17, 2026, [https://genserveinc.com/2022/09/14/industrial-generator-preventative-maintenance-checklist/](https://genserveinc.com/2022/09/14/industrial-generator-preventative-maintenance-checklist/)  
8. PRICE/COST SCHEDULE \- VA Vendor Portal, accessed February 17, 2026, [https://www.vendorportal.ecms.va.gov/FBODocumentServer/DocumentServer.aspx?DocumentId=5447728\&FileName=36C24720Q0289-0006002.pdf](https://www.vendorportal.ecms.va.gov/FBODocumentServer/DocumentServer.aspx?DocumentId=5447728&FileName=36C24720Q0289-0006002.pdf)  
9. Types of 24-Hour Shift Schedules and How To Create One | Yourco, accessed February 17, 2026, [https://www.yourco.io/blog/24-hour-coverage-shift-schedule](https://www.yourco.io/blog/24-hour-coverage-shift-schedule)  
10. Chief Engineer Salary in Indonesia (2026) \- ERI, accessed February 17, 2026, [https://www.erieri.com/salary/job/chief-engineer/indonesia](https://www.erieri.com/salary/job/chief-engineer/indonesia)  
11. Tarif Biaya \- Jasa Sertifikat Laik Operasi Genset, accessed February 17, 2026, [https://www.slogenset.id/tarif-biaya/](https://www.slogenset.id/tarif-biaya/)  
12. Preventive vs Reactive Maintenance: Costs, ROI, Best Practices \- Re-Leased, accessed February 17, 2026, [https://www.re-leased.com/property-operations/preventive-maintenance-vs.-reactive-maintenance-costs-roi-best-practices](https://www.re-leased.com/property-operations/preventive-maintenance-vs.-reactive-maintenance-costs-roi-best-practices)  
13. Data Center Staffing Levels: How Many People Does a Facility Need? \- Broadstaff, accessed February 17, 2026, [https://broadstaffglobal.com/data-center-staffing-levels-how-many-people-does-a-facility-need](https://broadstaffglobal.com/data-center-staffing-levels-how-many-people-does-a-facility-need)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAZklEQVR4Xu2RQQrAIAwE/f+nFQqRuM2AYjxYOpDLZF1QS7mA6iaVI8VamFruuadYnySF8I39j66Mob7vVM6Oof7ZaUDREiNySBQ+UjxcTdwSemC7mMLkzNO5DgXIUf4FBclR/ucLNCxCXKQmX/nWAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAjYAAAA4CAYAAADuI7JsAAADe0lEQVR4Xu3YUYrkOBAFwLn/pXfwh0HzUCplu2jXNhEgGOVLyXIvqMz++QMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAP+m9zzGRP1fcN8pw57ni6/ql8h7fO8Qn5HjlS5tmTWeaHzFcDgB+WF3E30qx2qPpPXf5NVudcZStvv3/1/Pzv3Y1vsDrHLOvOX9VHq/WHLgfgw6qL9059puo/dfk3WZ3z7nvcXfcp+fycn67W37A6x+ycOU9dfpjtO+pyAD6sunjv1Geq/lOXf5PVOe++x911n5LPz/npav0Nq3PMzpnz1OWH2b6jLgfgw6qLd7d+zrP3nM+yU7X2W63OucpW3nz/2d8/56er9dT1dHmnO8csm9VGO3k+t5sD8JLdy3h2uZ/1TrX2G83OuXP+sSf7szbbJ/OrfVX/octHOz2d2R67z+9U+6zecVY7rbLTbO+cA/Aldi/n8XKfXfQru30z+bxuPHXukXuu9p/Vc226kud8p39U1Weu9K50573r3DdHZSfvjD27zwXgJbuXc17oVy723b6ZfF43njr3yD1X+8/quTZdyXO+0z+q6jNXele689517pujspN3xp7d5wLww65eztmb85VV3yp7Q3We1d9rzGY9OT+MfV2eZvWr/ak6+1Nv79f1d/khe7r5Yfx75njqE3sA/DpXLtorvalbt8oO+aPQjbu6PVb5rDbKPM+8ymeyvuqv6mm1xx3jXp/Y8+75uv6dfKenMstmNQAe2rmwT3d/VA7Vuqr+lu4duyyN/Zlfma+yU9eftZndvh2zfZ7uf66/ukfVv7tX11dlq3VVfceTtQC/2uriTXd/VA7Vuqr+lu4duyyN/Zlfma+yU9eftZndvh2zfZ7uf66/ukfVv7tX11dlq3VVfceTtQC/0vgDsfqxyHzVm7J/Nd6W56nGSvZm/yo7ZJ5jlPND9q9Gyrzq29Wt7fKU57pzvlzbrc/ebsx02fjv2V5ZH/OdvmoAAFy2+pDIj41ZX5XtznNtzgEAtlUfEtWHRxrz1QdKtV81Xz0TAGCq+oioPkTSmM8+UMZ5VZ/NV88EAPjH+AExG6nKu3rOq/r47+wBAPhKPloAgP8t/xcGAPg1fNgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwG/3Fxa/FxS1wQ6XAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFkAAAAYCAYAAACRD1FmAAABJ0lEQVR4Xu2QCwrDMAxDe/9LbxRmcDXJVho2BvODQGxJzuc4hmEY/o4HrA70sxVg39UuoKkNfJCd892c8qj+Sae1qMth/W1Wz1fvCLLGPG4WUf0L6nJYf5vV89U7gp/4ZKyt8IvO2+mMlQzen5HfxTxdn+lY27BhDixzd9bJSi57Wa7TT9Rd8wejjnVLNcwlZ+/OCFby2Yu5rg7w7WyP9TJ50K0Bx/tFdljJZy/mujrAt7M91tvsDNnJBiszshc/AOdgHeSPRA/2madEBVivAy+yg5tHX/6QrLFeRuU6zUIFWa+C+dVsBzfHfKrH+kH1iZVmocKsV8H8araDm2M+1WP9oPrISrPIA3C5dN5OD/B8dRfUmJ73uBidflJpwzAMwzAMwzCYPAEpbAYJYWNmlQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFkAAAAYCAYAAACRD1FmAAABGElEQVR4Xu2QgQrDQAhD+/8/vSFMkBAvakdhzAcHpzE2vetalmX5O15wFDjPjoP9qnakNfxlRoE/VH3ZTNY3lNaiGvQJuhlU9qixmaoXyfopKuiTdDOo7D//yGpe6YyOJ85mvvhvbEb1mY61xA1sWQXmme4yOr44y3xKN7Ks3mc61iloxrpD9E53OB0/5o+o2sGHZHesy6AB6w4Y5A4dP+aPqNrx7DE/3rEugwasJ9z1G50dp/y4B2snPiTOYJ/NpOBidjpgkDtU/TiX5We9SOZT2ojpIuaZ7jKqPjaX9VjfOT3iSRsxXcY8011G1cfmsh7rO6eHPGlt4rLOUjWndAe/neVAjenxjoehdOOkLcuyLMuyLMtS5A2vhwMMxmz/fQAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALsAAAAXCAYAAABTTj7/AAACaklEQVR4Xu2U4a7rIAyD9/4vfa8ilSrHsoNhqCtVP4kfsU0Io9rn8/Ly8vLy8vLyGP7B2pk7zI+/5xN+10fwtEe4433ej/0mqEcY+VdanXUyCsyP9nLyTibj5q4G73GHGUfmwWwvLwMjTVZnnYwC86O9nLyTybi5q8F73GHGkXkw28v3A586wzylKb2qA6Yhqn9j1kcN64BpGdXbYXafA+vNtF/Rm4X5TDspzYMqwzylKb2qA6Yhqn9j1kcN64BpGdXbYXafA+vNtF/Rm4X5TDspzYMqwzylKb2qA6Yhqn9j1kcN64BpGdXbYXbfLFefVzEzS7mnNA+qDPOUpvSqDpiGqP6NWR81rAOmZVRvh9l9s1x9XsXMLOWe0jyoMsxTmtKrOmBapucH6vyG8lHDOmBaRvV2mN03w+hZ7V7uGmV0TzffDXzqDPOUpvSqDpiW6fmBOr+hfNSwDpiWUb2RlnPXKlb3W4U7kz2/E6oyzFOa0qs6YFqm5wfq/IbyUcM6YFpG9UZazl2rWN1vFe5M9vxOqMowT2lKr+qAaZmeH6jzG8pHDeuAaRnV22F2nwv2x7qi3ctdozh7MIP1H0rzoMowT2lKr+qAaY3Ky6jzG8pHDeuAaRnV22F2nwPrzbRf0ZuF+Uw7UWZ7ILaQnp9xsk6m4fhsKZyck8m4OcbsPge8xzdzrgJnqeZCX+VOlIkNqmY9P+NknUzD8dlSODknk3FzjNl9DniPb+ZcBc5SzYW+yp2U5gbsMH/3EQpm970Qdv0xv/mArmanWR/Nro+w0we006yPZtdH2OkD2mnWR7PrI+z0Ae0066P4D8VyARwOM+PsAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAO8AAAAYCAYAAAAS56oYAAACw0lEQVR4Xu2UC24kIQxEc/9L7wppkZyXKht6mE9v/CQUuVzYmGby9dU0TdM0TdM0zQX+FKt5L/wej3yTEzWaDyP7oE5/Jv3IvnPyLk7W+iTim1lZRGnvZPk8bqBBNnDzGk7e/8lan4CbZ1e/LdlA/eN9Pyfv/2StT8DNs6vfkurH6fTfTHZfgyq/Q/V9djlZ6wpV/ypPnH9XvyXZ46h0ripPH6l8zNPDHJeCHudTKK/SHmH3XJwl7qWmajL/qM+hvEq7ykqt7Nyci0tBj/IxH32MS1ikKqB0HiDqxGncl8WT2FP1n1T7Y0ytguc8zU5N5d25myrPmH7GFax7kqpenIEzufkGvI8JNeVTsetPr4QFqs1KZ/OoE6dxXxZPYk/Vf1LtjzG1Cp7zNDs1lXfnbqo8Y/oZV7DuSap6cQbO5OYb8D4m1JRPxa4/vZIlU0D5XbNVjbAe48mOdrXeCq7eCbK6zM1zxBVhPIi+Kk+cvkNW/wpudkfmVTr9jCfUGA+cpvQfLBv/ofxToz6g5nwR1mPstAk15WU8UVoF657EnXPCHGPCfLwb1cvpE6ev8oy7q84cqbzUlZ/xhBrjATVV37JsDNDPQeZf+gZVfqB0+mNMnag8602UlqH8SrtKdk6nE3dXu3GWu4Lar7Rd3N0odudTftePGuMBNVXf4hpn0K8aurpVfqB0+mNMnag8602UlqH8SrtKdk6nE3dXu3GWu4Lar7Rd3N0odudTftePGuMBNVX/G7OZWitwD1f0EOUlSuc+rugjzqtyzDsqb5XP4HmyRZinJ8sNmOeKMF5F1YpUeQfPulIn8zIeVH4uwjw9We4WvOPQt72s5uNYfUsrno8nDvGKgdR/NsZNs8LKW1Keqd8eDvps1GUybpoVVt6S8kz99rjhnkXs98q+zf8H35F6S8w7X9M0TdM0TdM0TdP8Wv4CqpC+XtD8AVsAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAjYAAAA/CAYAAADzJoLUAAAFA0lEQVR4Xu3ZWW7kuBIF0N7/pt+DPgiwL4KDlFS2y3UOIBgxMESlTdmo+ucfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAr/vfixcAwH/i9B8jp+cBAGx7419bVnNWdYDfznsQXuIPG4Dv8x6EF53+42Y2Y1Zrcj+n9vXUqX18ur45NedPlN+L6nrL2/P/dvl9zOu3+Y3PBD/K2y+RJ3OfrHnTib2cmnFizo5v3eeO2fOP8qe8Pf+bfuKzzPY0q/0Jqv3PfpaBQ946aE/m3u1/26f7efIZpDbj0zk7vnGPJ2bPP8qfMLsvZ6w+31X9T+NnCr7grYP2ZO7d/rd9up8nn0FqMz6ds+Mb93hi9vyj/Amz+3LG6vNd1f80fqbgC/pfnCcP3JN5d/vf9ul+Tq1/8lk+sXuP1X5W9Tuqn80+PnWfypuzf7L8vNOqvmtnzqr+p/qtzwU/Rv/L48SBuztjde/Z/qr47jUyquX60ZysVz0zrX+2NudXfVnv+zKX9Zmqp8p9otpPxr18hmp9k/XsafGqZ1ar5Jp+bebyqmTPaN5d1Zoq99TOvrJePWNfy3h0paxXPZfsyd4qV1nVgQN2D+SOuzNm986XRqrqO7OaUa7KX6r8qH83l3Jei6u1mVvFl91ZO3Kfp/XPPtp302rZt4qbzFV9Oad9zb7LnVw/4868S/aP5o3Wz+Tck1bzcs/5PKmqZ+8qbqrcJfvzXlW+MqsBh7SDeOLA3Z0xu3e+LFJV35nVjHJV/lLlR/27uZTzWlytzdwqvuzO2pH7PK1/9tG+m1bLvlXcZK7qyznta/Zd7uT6GXfmXbJ/NG+0fibnnrSal3vO50lVPXtXcVPlLtmf96rylVkNOGx1IHfcXb97z+zJuBnNu5Or8pcqn/0tzt6MR/r1eaW79VnPU5+un8m5GVdW+8nPI/tH+ZHsy7iXs6u+Wb7ydN6uT9ePrGaO7pv5jHuz2mVUr3KX1j9a18xql1UdOOjEgbs7Y/WSaLIn4ybnjV5EGTdV76XKV7Mzbqpcqnqqe1Sqnowr1bpd+dwnPd3Xat3desYp6xn3Rvlerm/xnbWtN+O7ch8n7O5pVM+1Gfd2atWs0Zpe1VvlKqs6cNCJA3d3xs6L4JI9GTc5b/Syybipei9VvpqdcVPlUtVT3aNS9WRcqdbtyuc+6em+Vuvu1jNOWc+4N8r3cn2L76xtvRnflfs4YXdPo3quzbi3U6tmjdb0qt4qV1nVgQN2DuOu2Zw8+BlXRj05o8/1qrWXan3GuW4Wj+Y1u/XU+rO+ii+jXO57Fo9UPVXuqd199Hb6R3NbLut9nOta7U5/mvVfZvU7cdZWqv4qd1d7ntGsnVo+V4szv7I7aye+zNb3ZjXgkDzgnxrNa/n+2pXrqvUZX6q+yyq/qlVX35OqfK6/U898rr1kfadnZdW3qs/kXu7s67LTl3Nz/ijOfJP1u729jC+r/rx6s9rIqndVH8m9jK6V7B+tzbiS6/PqZS3rl1W9mdWAA944ZKuDDfC38V6EL3njoDnAAP/mvQhf8NYhc4AB/s17EV508oDN5sxqAH8L70J40ekDtpq3qgP8dt6D8KLTB2w1b1UH+O28B+Elpw5X+6+sU/MAALb1f4icvgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4mf4PeigxCDI1XXkAAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHUAAAAXCAYAAAA1OADtAAABg0lEQVR4Xu2R0a7DIAxD9/8/fadMy8Q824GqV1RVjsQDJw4N5fFomqZpmhd/79XciH7Uk8gfOfNDMevymHPZZCXHWP3eTo7MiPeT/VOhN5h1ecy5bLKSY6x+bydHZsT7TfW7EKsxFzDP3EhVD9xllGN+N+4eDpZn7gsXcDWEZZkbqeqB+xnKMb8bdw8HyzP3hQuMg1QDYc5lkyoz1llWOeZ3kvOcNVt5hgvgI52VTarMWGdZ5ZjfSc5z1mzlGS7Aaswl44O6XLBax32gHPMMnLdaq2Af7o8w1e9CrMZcgL66gKsFWMd9oBzzO8BZcL/CUq8LshpzAfpqCFcLsI77QDnmd4Cz4H6FpV4XZDXmAuaZS1Qth69WZpGxXoFnVmsF7FVrBszh/gcXYDXmAuaVY76C9SjH/BVws6narPscwBZS1RPMqbzyCjwP+5W/GjgnzsscepV5gQEXruoJ5lReeQWeh/3KXw2cE+dlDr3KbOeSQzXH6ce8If2oN6Qf9Yb0o/4DT7guYa3G1/OFAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIMAAAAXCAYAAAAoavwzAAABhklEQVR4Xu2RS27EMAxDc/9LtwgwBlSGlPXxNBs9IAtTpMwk1zUMwzAMwzAMB/j5PBGW1z5v0u2C+c6uk2CXbCfMhfNh4/VcHs19i24XzHd2nQS7ZDthLpQPGz8wXyb/TSod1Pvj+b/p3l/Kq4+hYL5u3rKbe1Sy2L3yPSL+3RzJ+pF0fgUiL+ORzSs/0zJ08zeqGwN9K4v6DdM87C610wOz2/wyhMwO2bzyMy1DN3+jujHQ5314pnnYXWqnB2ZlHod4zlDN3axs535LZ0fowwGer7LPwjJMUzAv0x4F8RylkkFO7Fi8uSvrr9C9g+bx5+M5SiWDnNixeHNX1l+he8cjv3689+xAH56jrEw1j1R2qLuZhuA3w7OFaR7MzzQF8zLtQeYFlMZ0hfIzLcMuz+adLp5n7VX7d7CM0pSOMO0PWNoG8Gw19kTY+XZzBDt4fdgMM8zzBthF9VFzzOKcggEbwrPV2BNh59vNEezg9WEzzDDPG2AX1UfNMYvzYRiGYRiGYcjxCzxVT78GxncqAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAXCAYAAAAC9s/ZAAAARUlEQVR4Xu3QMQ4AIAgDQP7/aU2dTG1SgZUboSXRiDFeiwfE7Q8VwkzNJRVMHYC7kCqyVhnKB1pPUIXvT3Qht7cBtx8VGxr/FuoDVpcWAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,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>

[image17]: <data:image/png;base64,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>

[image18]: <data:image/png;base64,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>
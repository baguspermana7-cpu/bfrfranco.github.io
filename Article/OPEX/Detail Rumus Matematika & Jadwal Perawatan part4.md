# **Presisi Operasional Data Center: Algoritma Staffing, Optimasi Inventaris, dan Rekayasa Pemeliharaan Aset Kritis**

## **1\. Pendahuluan: Paradigma Baru Operasional Infrastruktur Kritis di Indonesia**

Dalam ekosistem ekonomi digital yang berkembang pesat, data center tidak lagi sekadar fasilitas penyimanan server, melainkan infrastruktur tulang punggung yang menuntut tingkat ketersediaan (availability) mendekati absolut. Di Indonesia, tantangan operasional ini diperumit oleh variabel lingkungan tropis yang ekstrem—kelembapan tinggi dan suhu ambien yang panas—serta kerangka regulasi ketenagakerjaan yang unik. Laporan ini menyajikan analisis mendalam yang mensintesis prinsip-prinsip matematika aktuaria untuk manajemen sumber daya manusia, model stokastik untuk manajemen rantai pasok, dan standar rekayasa presisi untuk pemeliharaan aset.1

Fokus utama dari riset ini adalah mentransformasi pendekatan manajemen fasilitas dari model berbasis intuisi atau praktik generik menjadi model deterministik yang didukung oleh formula matematika presisi. Hal ini sangat krusial mengingat data biaya operasional (OPEX) di Indonesia menunjukkan bahwa inefisiensi dalam staffing dan pemeliharaan dapat menyumbang lebih dari 40% dari total pengeluaran non-energi.1 Dengan mengintegrasikan standar global seperti SFG20 dan NFPA dengan realitas lokal (seperti Sertifikat Laik Operasi/SLO dan Ahli K3), dokumen ini merumuskan cetak biru operasional untuk fasilitas Tier III dan IV yang tangguh dan efisien secara finansial.3

Analisis ini bergerak melampaui metrik permukaan, menyelidiki interaksi kausal antara rotasi shift yang buruk dengan kelelahan operator, serta korelasi antara strategi inventaris suku cadang dengan Mean Time to Repair (MTTR). Kami juga memperkenalkan kerangka kerja algoritmik untuk penjadwalan pemeliharaan "Non-Concurrent", sebuah pendekatan sistematis untuk meniadakan risiko kegagalan ganda pada sistem redundan selama jendela pemeliharaan.4

## ---

**2\. Formulasi Matematika Presisi untuk Staffing dan Rotasi Shift (FTE)**

Perhitungan kebutuhan tenaga kerja (Full-Time Equivalent/FTE) untuk fasilitas 24/7 sering kali diremehkan dengan menggunakan rasio sederhana. Namun, dalam konteks Indonesia, variabel "shrinkage" atau penyusutan jam kerja efektif akibat regulasi libur dan cuti memiliki dampak signifikan terhadap integritas cakupan operasional. Model di bawah ini mendekonstruksi komponen waktu untuk menghasilkan angka FTE yang presisi.

### **2.1 Derivasi Variabel Shrinkage Berbasis Regulasi Indonesia**

Shrinkage (![][image1]) didefinisikan sebagai persentase waktu berbayar di mana seorang karyawan tidak tersedia untuk melakukan tugas utamanya (monitoring atau maintenance). Di Indonesia, faktor ini dipengaruhi secara unik oleh kombinasi Cuti Bersama dan Hari Libur Nasional yang dinamis.

Mari kita definisikan total jam kerja standar per tahun (![][image2]) berdasarkan Undang-Undang Ketenagakerjaan No. 13 Tahun 2003, yang menetapkan 40 jam kerja per minggu:

![][image3]  
Selanjutnya, kita harus menghitung total jam non-produktif (![][image4]) yang terdiri dari komponen eksternal dan internal.6 Berdasarkan data historis dan regulasi Indonesia tahun 2025-2026 8, komponen tersebut adalah:

1. **Cuti Tahunan (![][image5]):** Hak normatif minimum adalah 12 hari.  
   ![][image6]  
2. **Hari Libur Nasional (![][image7]):** Indonesia memiliki rata-rata 16 hari libur nasional (Idul Fitri, Nyepi, Natal, dll.).  
   ![][image8]  
3. **Cuti Bersama (![][image9]):** Keunikan regulasi Indonesia untuk menjembatani hari libur, rata-rata 6-8 hari.  
   ![][image10]  
4. **Sakit & Izin (![][image11]):** Berdasarkan rata-rata industri, dialokasikan 5 hari.  
   ![][image12]  
5. **Pelatihan Wajib (![][image13]):** Untuk data center (K3 Listrik, sertifikasi OEM), dialokasikan 5 hari.10  
   ![][image14]  
6. **Internal Shrinkage (![][image15]):** Waktu briefing, istirahat sholat/makan, dan transisi shift, estimasi 30 menit per shift (6.25%).  
   ![][image16]

Maka, total jam non-produktif (![][image4]) adalah:

![][image17]  
Sehingga, **Jam Produktif Bersih (![][image18])** per teknisi adalah:

![][image19]  
Persentase Shrinkage (![][image1]) di Indonesia:

![][image20]  
Angka 23.5% ini lebih tinggi dibandingkan standar global (\~15-20%) karena tingginya frekuensi libur nasional dan cuti bersama di Indonesia, yang menuntut strategi mitigasi staffing yang lebih agresif.

### **2.2 Algoritma Penentuan FTE untuk Posisi 24/7**

Sebuah pos penjagaan (misalnya, Operator BMS atau Security) membutuhkan cakupan 24 jam sehari, 365 hari setahun. Total beban jam pos (![][image21]) adalah:

![][image22]  
Jumlah FTE minimum (![][image23]) yang dibutuhkan untuk menutupi satu pos tanpa lembur dihitung sebagai:

![][image24]  
**Implikasi Operasional:** Secara matematis, dibutuhkan **5.49 orang** untuk mengisi satu kursi 24/7. Dalam praktiknya, ini dibulatkan menjadi **5.5 atau 6.0 FTE** untuk menghindari lembur berlebih yang dapat memicu kelelahan (fatigue) dan kesalahan manusia.11 Jika fasilitas hanya menggunakan 5 orang (seperti yang terlihat dalam beberapa model biaya Tier rendah), defisit 0.49 FTE (sekitar 782 jam) harus ditutup dengan lembur, yang secara jangka panjang tidak berkelanjutan dan melanggar batas lembur regulasi (maks 18 jam/minggu).

### **2.3 Topologi Rotasi Shift: The "Indonesian 4-Group" Model**

Mengingat batasan jam kerja 40 jam/minggu, model "4-On-4-Off" (12 jam kerja) yang populer di Barat sulit diterapkan di Indonesia tanpa memicu perhitungan lembur yang kompleks dan mahal. Sebagai alternatif, kami merekomendasikan **Model 4-Grup 3-Shift** yang dimodifikasi untuk mengakomodasi Floating Engineer.

**Struktur Shift:**

* Shift Pagi (P): 07:00 \- 15:00 (8 jam)  
* Shift Sore (S): 15:00 \- 23:00 (8 jam)  
* Shift Malam (M): 23:00 \- 07:00 (8 jam)

**Algoritma Rotasi (Siklus 28 Hari):**

Pola rotasi dirancang untuk meminimalkan gangguan sirkadian dengan rotasi maju (Pagi \-\> Sore \-\> Malam \-\> Libur).

| Hari | Grup A | Grup B | Grup C | Grup D | Floating (E) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1-2 | Pagi | Malam | Libur | Sore | Support/Project |
| 3-4 | Pagi | Libur | Sore | Malam | Support/Training |
| 5-6 | Sore | Pagi | Malam | Libur | Cuti Cover |
| 7 | Libur | Pagi | Libur | Sore | Libur |

**Peran Floating Engineer (Grup E):** Grup E tidak masuk dalam rotasi jam tetap (fixed slot). Fungsi algoritmiknya adalah mengisi variabel ![][image4] dari Grup A-D. Jika tidak ada yang cuti, Grup E melakukan *preventive maintenance* (PM) yang tidak bisa dilakukan oleh shift jaga, seperti pengujian beban genset atau pembersihan filter presisi.1

### **2.4 Estimasi Biaya Staffing dan Retensi**

Mengacu pada 1, biaya staffing in-house untuk fasilitas 1 MW adalah \~$490k/tahun. Namun, biaya "churn" atau pergantian karyawan sering tersembunyi. Rumus biaya turnover (![][image25]) untuk teknisi spesialis (misal: Ahli K3 Listrik) adalah:

![][image26]  
Dimana:

* ![][image27]: Biaya rekrutmen & seleksi.  
* ![][image28]: Biaya pelatihan ulang (sertifikasi ulang).  
* ![][image29]: Waktu adaptasi (biasanya 3-6 bulan untuk memahami topologi spesifik site).  
* ![][image30]: Kehilangan produktivitas selama masa adaptasi (est. 50%).

Riset menunjukkan biaya penggantian engineer bisa mencapai 1.5x \- 2x gaji tahunan.13 Oleh karena itu, investasi dalam *retention program* jauh lebih efisien daripada siklus rekrutmen yang konstan.

## ---

**3\. Optimasi Biaya Inventaris: Pendekatan Stokastik dan Deterministik**

Manajemen suku cadang di data center menghadapi paradoks: sebagian besar spare parts adalah "slow-moving" namun memiliki konsekuensi kegagalan yang "catastrophic". Model EOQ tradisional harus dimodifikasi untuk memperhitungkan biaya downtime (Cost of Downtime) yang jauh melebihi biaya penyimpanan (Holding Cost).15

### **3.1 Economic Order Quantity (EOQ) untuk Consumables**

Untuk barang habis pakai dengan permintaan deterministik (dapat diprediksi), seperti filter udara atau oli genset, kita menggunakan model EOQ standar untuk meminimalkan total biaya logistik.

![][image31]  
Dimana:

* ![][image32]: Permintaan tahunan (unit).  
* ![][image33]: Biaya pemesanan per order (biaya administrasi, pengiriman).  
* ![][image34]: Biaya penyimpanan per unit per tahun (biasanya 20-25% dari harga unit).

**Contoh Kasus: Filter Pre-filter HVAC (G4)**

* Konsumsi: 100 unit/bulan \= 1,200 unit/tahun.  
* Biaya Pesan (![][image33]): Rp 500.000 (biaya admin PO, handling).  
* Harga Unit (![][image35]): Rp 100.000.  
* Biaya Simpan (![][image34]): 20% x Rp 100.000 \= Rp 20.000/tahun.

![][image36]  
**Rekomendasi:** Pesan \~245 unit setiap kali stok mencapai titik pemesanan ulang. Ini menyeimbangkan biaya gudang dengan efisiensi pengadaan.

### **3.2 Model Min-Max untuk Critical Spares (Probabilistik)**

Untuk suku cadang kritis (misal: *PCB Control Chiller* atau *IGBT Module UPS*), permintaan bersifat stokastik (acak) dan jarang. Rumus EOQ tidak berlaku karena risiko *stockout* bernilai miliaran rupiah per menit downtime.16

Kita menggunakan **Service Level Driven Reorder Point (ROP)**:

![][image37]  
Dimana:

* ![][image38]: Rata-rata pemakaian selama Lead Time (misal: 0.1 unit).  
* ![][image39]: Lead Time pengadaan (bulan). Di Indonesia, impor part elektronik bisa memakan waktu 2-3 bulan karena proses bea cukai.  
* ![][image40]: Faktor Service Level (Z-score). Untuk Tier III (99.982%), kita menggunakan ![][image41].  
* ![][image42]: Standar deviasi Lead Time (ketidakpastian pengiriman).

**Formula Safety Stock (![][image43]):**

**![][image44]**  
(Dimana ![][image45] adalah variabilitas kegagalan komponen).

**Tabel Matriks Kritisitas Inventaris (Inventory Criticality Matrix):**

| Kategori | Definisi | Strategi Stok | Model Kalkulasi |
| :---- | :---- | :---- | :---- |
| **Vital (V)** | Kegagalan menyebabkan outage instan (Single Point of Failure). | 100% On-site Availability. | ![][image46] (One-for-one replenishment) |
| **Essential (E)** | Kegagalan menurunkan redundansi (N+1 menjadi N). | Stock cover for Lead Time. | ROP probabilistik (![][image47]) |
| **Desirable (D)** | Kosmetik atau non-kritis (lampu panel, handle pintu). | Just-in-Time (JIT). | Min-Max sederhana |

Untuk komponen Vital seperti **UPS Controller Board**, meskipun ![][image48], kita wajib menyimpan minimal 1 unit di site karena ![][image39] (waktu penggantian) \> Waktu toleransi baterai. Biaya penyimpanan (![][image34]) menjadi tidak relevan dibandingkan biaya risiko.

## ---

**4\. Rekayasa Pemeliharaan: Frekuensi, SOW, dan Estimasi Man-Hours**

Bagian ini menyajikan rincian teknis mendalam untuk pemeliharaan aset, mengacu pada standar **SFG20** (UK standard for building maintenance), **NFPA**, dan rekomendasi OEM. Estimasi man-hours didasarkan pada asumsi teknisi kompeten dengan peralatan yang memadai.17

### **4.1 Water Treatment Systems**

Sistem pengolahan air sangat kritikal untuk menjaga efisiensi perpindahan panas pada *Water Cooled Chiller*. Kegagalan di sini menyebabkan *scaling* (kerak) yang meningkatkan penggunaan energi secara eksponensial.

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **Sand Filter** | Bulanan 19 | 1\. Lakukan *Backwash* manual/auto. 2\. Cek tekanan diferensial (In/Out). 3\. Inspeksi media pasir (level & kondisi). | 1.0 jam / unit |
| **Carbon Filter** | Triwulan | 1\. Cek kadar klorin bebas (pre/post). 2\. *Backwash* dan *Rinse*. 3\. Cek kebocoran pada *multiport valve*. | 1.5 jam / unit |
| **UV Sterilizer** | Bulanan | 1\. Cek intensitas lampu UV & *hour meter*. 2\. Bersihkan *quartz sleeve* dari deposit mineral. | 0.5 jam / unit |
| **UV Sterilizer** | Tahunan 20 | **Penggantian Lampu UV** (Umur pakai \~9000 jam). Kalibrasi sensor intensitas. | 2.0 jam / unit |
| **Dosing Pump** | Mingguan 17 | 1\. Cek level tangki kimia. 2\. Inspeksi *foot valve* dan *injection nozzle* dari kristalisasi. | 0.25 jam / unit |

**Insight:** Di Indonesia, kualitas air baku sering mengandung silika tinggi. Frekuensi pembersihan *quartz sleeve* UV mungkin perlu ditingkatkan menjadi dwi-mingguan jika monitoring menunjukkan penurunan intensitas UV yang cepat.

### **4.2 Chiller System Auxiliaries**

Aset pendukung yang sering terabaikan namun vital untuk stabilitas hidrolik.

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **Pressurisation Unit** | Triwulan 21 | 1\. Cek tekanan statis sistem ("Cold Fill"). 2\. Uji fungsi pompa (Duty/Standby). 3\. Cek *pre-charge* nitrogen pada bejana ekspansi. | 1.0 jam |
| **Vacuum Degasser** | Semesteran 22 | 1\. Cek efisiensi pembuangan udara (vacuum cycle). 2\. Bersihkan *strainer* internal. 3\. Inspeksi solenoid valve dari kemacetan. | 2.0 jam |

**Analisis Teknis:** Kegagalan *pressurisation unit* dapat menyebabkan tekanan negatif di titik tertinggi pipa, menarik udara masuk dan menyebabkan korosi kavitasi pada pompa sirkulasi utama.

### **4.3 HVAC Office (Comfort Cooling)**

Meskipun bukan pendingin server, kegagalan AC kantor berdampak pada kenyamanan operator di ruang kontrol (NOC).

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **Split AC / FCU** | Triwulan 23 | 1\. Cuci filter udara & evaporator. 2\. Cek drainase kondensat (cegah bocor ke server room). 3\. Ukur ampere kompresor. | 0.75 jam / unit |
| **VRV System** | Semesteran | 1\. Cek kode error via remote/bms. 2\. Inspeksi kebocoran refrigeran pada *joint* pipa. 3\. Bersihkan kondensor unit outdoor. | 4.0 jam / sistem |

### **4.4 Fire Safety Systems**

Sistem proteksi kebakaran memerlukan kepatuhan ketat terhadap standar NFPA 72 dan NFPA 2001\.

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **VESDA** | Triwulan 24 | 1\. Cek level *obscuration* dan *airflow*. 2\. *Purging* pipa sampling (backflush) untuk buang debu. 3\. Cek umur filter. | 1.0 jam / detektor |
| **VESDA** | Tahunan | Ganti Filter Cartridge. Kalibrasi ambang batas alarm. | 0.5 jam / detektor |
| **Addressable Alarm** | Tahunan 26 | Uji fungsi 100% device (smoke, heat, manual call point). Verifikasi alamat di panel. | 0.2 jam / device |
| **FM200 / Pre-action** | Semesteran 27 | 1\. Cek berat/tekanan tabung gas. 2\. Inspeksi *discharge nozzle* dari sumbatan. 3\. Uji solenoid pelepasan (simulasi). | 2.0 jam / bank |
| **Fire Pumps** | Mingguan 26 | *Churn Test* (Running tanpa aliran air) selama 10-30 menit. Cek packing gland. | 0.5 jam |

**Insight:** Pada lingkungan data center yang "bersih", filter VESDA tetap bisa tersumbat oleh debu mikro dari konstruksi atau abrasi belt AC. Pembersihan pipa sampling (*purging*) sangat krusial untuk menjaga *transport time* tetap di bawah 120 detik sesuai standar NFPA.

### **4.5 IT & Network Infrastructure (Passive/Active)**

Pemeliharaan fisik perangkat jaringan untuk mencegah *thermal throttling*.

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **BMS Server** | Bulanan 28 | 1\. Cek *disk space* & *CPU load*. 2\. Backup database log historis. 3\. Validasi komunikasi ke field device (ping test). | 2.0 jam |
| **Spine Switches** | Triwulan 29 | 1\. Inspeksi visual intake udara (debu). 2\. Cek status kipas dan PSU (redundan). 3\. Cek *error counter* pada port fiber. | 0.5 jam / chasis |
| **Firewall (Hardware)** | Semesteran | 1\. Vacuum debu eksternal. 2\. Cek integritas kabel power & console. 3\. Validasi status HA (*High Availability*) cluster. | 0.5 jam / unit |

### **4.6 Security Systems**

Memastikan integritas fisik dan kontrol akses.

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **AACCS (Access)** | Triwulan 30 | 1\. Uji fungsi *reader*, *maglock*, dan *door contact*. 2\. Cek baterai backup controller. 3\. Validasi log "Force Door" di server. | 0.25 jam / pintu |
| **CCTV** | Triwulan | 1\. Cek fokus dan *Field of View* (FOV). 2\. Bersihkan lensa. 3\. Verifikasi retensi rekaman (NVR/Storage) sesuai kebijakan (misal: 90 hari). | 0.25 jam / kamera |
| **VCOM (Intercom)** | Semesteran | Uji panggilan audio/video dua arah ke ruang kontrol. | 0.1 jam / unit |

### **4.7 Electrical Systems**

Jantung dari data center, memerlukan tingkat kehati-hatian tertinggi (K3 Listrik).

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **Harmonic Filter** | Semesteran 31 | 1\. Cek display parameter THDi & THDv. 2\. Inspeksi kapasitor (gembung/bocor). 3\. Cek *cooling fan* filter aktif. 4\. *Thermography scan* terminal. | 1.5 jam / unit |
| **UPS** | Triwulan 32 | 1\. Cek parameter beban & keseimbangan fasa. 2\. Cek suhu baterai & ruangan. 3\. Review event log. | 1.0 jam / unit |
| **Trafo (Dry Type)** | Tahunan 33 | 1\. Vacuum debu pada *winding* dan *air duct*. 2\. Kencangkan koneksi (torsi ulang). 3\. *Insulation Resistance Test* (Megger). | 4.0 jam / trafo |
| **Emergency Light** | Bulanan | Uji fungsi 30 detik (Self-test/Manual). | 0.1 jam / titik |
| **Emergency Light** | Tahunan | Uji durasi penuh (misal: 3 jam) untuk validasi kapasitas baterai. | 0.5 jam / titik |

**Insight:** Harmonik di data center modern (banyak *Switch Mode Power Supply*) bisa sangat tinggi. *Active Harmonic Filter* (AHF) yang kotor filternya akan mengalami *derating* atau *overheat*, menyebabkan distorsi tegangan yang merusak server.

### **4.8 Fuel System**

Bahan bakar diesel di iklim tropis rentan terhadap pertumbuhan mikroba (*diesel bug*).

| Aset | Frekuensi (Standar) | Lingkup Pekerjaan (Scope of Work \- SOW) | Estimasi Man-Hours |
| :---- | :---- | :---- | :---- |
| **Fuel Polishing** | Mingguan 34 | 1\. Cek tekanan diferensial filter. 2\. *Drain* air dari *water separator*. 3\. Cek kebocoran. | 0.25 jam |
| **Fuel Polishing** | Semesteran | Ganti elemen filter (Particulate & Water Block). | 1.0 jam |
| **Transfer Pumps** | Bulanan 35 | 1\. Uji fungsi *auto-start* via level switch (float). 2\. Cek *alignment* kopling dan kebocoran *seal*. | 0.5 jam / pompa |

## ---

**5\. Algoritma Gantt Chart "Non-Concurrent" untuk Aset Redundan**

Salah satu risiko terbesar dalam operasional data center Tier III/IV adalah kesalahan manusia (human error) yang mematikan jalur A saat jalur B sedang dalam pemeliharaan atau gangguan. Algoritma penjadwalan "Non-Concurrent" bertujuan untuk secara matematis mencegah tumpang tindih ini.

### **5.1 Logika Constraint Satisfaction Problem (CSP)**

Kita mendefinisikan masalah ini sebagai CSP dengan variabel dan batasan berikut:

**Himpunan:**

* **![][image49]**: Himpunan semua aset yang dapat dipelihara.  
* ![][image50]: Himpunan grup redundansi (misal: ![][image51]).  
* ![][image52]: Slot waktu (hari/jam).

**Variabel:**

* **![][image53]**: Variabel biner, bernilai 1 jika aset ![][image54] dipelihara pada waktu ![][image55], 0 jika tidak.

**Constraint (Batasan Keras):**

Untuk setiap grup redundansi ![][image56], dan setiap pasangan aset ![][image57] (dimana ![][image58]):

![][image59]  
Artinya, pada waktu ![][image55], hanya satu (atau nol) aset dalam grup redundansi yang boleh berstatus "maintenance".

**Constraint Buffer (Jeda Waktu):**

Setelah pemeliharaan jalur A selesai, harus ada jeda waktu (![][image60]) sebelum jalur B disentuh, untuk memastikan jalur A stabil.

Jika ![][image61], maka ![][image62] untuk ![][image63].

### **5.2 Implementasi Konseptual pada Gantt Chart**

Algoritma ini bekerja dalam beberapa langkah untuk menghasilkan jadwal visual:

1. **Identifikasi Aset Berpasangan:**  
   * Input: Database aset dengan tag "Redundancy Group" (Contoh: Chiller-1 & Chiller-2).  
2. **Alokasi Jadwal Jalur A (Primary):**  
   * Algoritma menjadwalkan PM untuk semua aset Jalur A pada minggu ke-1 dan ke-3 setiap bulan.  
   * *Output:* Blok warna Merah pada Gantt Chart untuk Aset A.  
3. **Proyeksi Exclusion Zone (Zona Larangan):**  
   * Untuk setiap blok Merah pada Aset A, algoritma membuat "blok bayangan" (abu-abu) pada baris Aset B untuk waktu yang sama \+ 24 jam (Buffer).  
   * *Logika:* IF Asset\_A.Status \== Maintenance OR Asset\_A.Status \== Unstable THEN Asset\_B.Schedule \= Locked.  
4. **Alokasi Jadwal Jalur B (Secondary):**  
   * Algoritma mencari slot kosong untuk Aset B yang *tidak* bertabrakan dengan "blok bayangan".  
   * Biasanya dijadwalkan pada minggu ke-2 dan ke-4.

**Visualisasi Gantt Chart:**

| Asset | Week 1 (Days 1-7) | Week 2 (Days 8-14) | Week 3 (Days 15-21) | Week 4 (Days 22-28) |
| :---- | :---- | :---- | :---- | :---- |
| **UPS System A** | (Locked) | \[Available\] | (Locked) | \[Available\] |
| **UPS System B** |  |  |  |  |
| **Genset A** | \[Available\] | \[Available\] |  | \[Available\] |
| **Genset B** | \[Available\] |  |  | \[Available\] |

**Keuntungan Algoritma:**

* **Mencegah Human Error:** Sistem manajemen pemeliharaan (CMMS) akan menolak tiket kerja (Work Order) untuk Jalur B jika Jalur A sedang aktif dikerjakan.  
* **Stabilisasi Sistem:** Memaksa periode "soak" atau stabilisasi setelah perbaikan sebelum risiko dipindahkan ke jalur lain.

## ---

**6\. Kesimpulan dan Rekomendasi Strategis**

Laporan ini telah menguraikan kerangka kerja operasional yang komprehensif, mengintegrasikan presisi matematika dengan realitas lapangan di Indonesia.

1. **Staffing:** Penggunaan rasio FTE generik harus ditinggalkan. Fasilitas di Indonesia memerlukan faktor pengali **\~5.5 \- 5.6 FTE per posisi 24/7** untuk mengakomodasi *shrinkage* sebesar 23.5% akibat struktur hari libur yang unik. Model "4-Grup 3-Shift" dengan *Floating Engineer* adalah solusi optimal untuk kepatuhan regulasi dan kesejahteraan karyawan.  
2. **Inventaris:** Penerapan hibrida antara **EOQ** (untuk barang habis pakai) dan **Reliability-Weighted Min-Max** (untuk suku cadang kritis) adalah kunci untuk menyeimbangkan *Cash Flow* dan *Uptime*. Stok pengaman harus memperhitungkan variabilitas *lead time* impor yang tinggi di wilayah ini.  
3. **Pemeliharaan:** Transisi dari pemeliharaan reaktif ke preventif yang disiplin, dengan jadwal yang dipetakan secara granular hingga ke level man-hours per aset, memungkinkan perencanaan anggaran dan tenaga kerja yang akurat. Tabel man-hours yang disediakan dapat menjadi dasar perhitungan kontrak vendor atau beban kerja tim in-house.  
4. **Penjadwalan:** Adopsi algoritma "Non-Concurrent" bukan sekadar fitur software, melainkan prosedur keselamatan wajib (SOP) untuk fasilitas Tier III/IV. Memisahkan pemeliharaan jalur redundan secara temporal adalah pertahanan terakhir melawan *catastrophic failure* akibat kesalahan manusia.

Implementasi rekomendasi ini akan menghasilkan fasilitas data center yang tidak hanya tangguh secara teknis tetapi juga efisien secara biaya dan patuh secara regulasi, siap menghadapi tuntutan era digital yang tanpa henti.

---

**Data Sources:** 1 OPEX Report — February 17, 2026 (Operational Costs & Staffing Baseline) 1 CAPEX Report — February 17, 2026 (Asset Lists & Redundancy) 6 Call Center Shrinkage & Staffing Formulas 17 SFG20 Maintenance Standards 15 Inventory Management (EOQ, Min-Max, Critical Spares) 34 Fuel Polishing Maintenance 24 VESDA & Fire System Maintenance 19 Water Treatment & UV Maintenance 31 Harmonic Filter Maintenance 21 Chiller Pressurisation & Degasser 29 Network & IT Maintenance 5 Redundancy & 2N Logic 48 Indonesia Labor Laws & Regulations 8 Indonesia Holidays 2025-2026

#### **Works cited**

1. OPEX Report — February 17, 2026.pdf  
2. Indonesia Data Center Market Share & Size 2031 Outlook \- Mordor Intelligence, accessed February 17, 2026, [https://www.mordorintelligence.com/industry-reports/indonesia-data-center-market](https://www.mordorintelligence.com/industry-reports/indonesia-data-center-market)  
3. Indonesia Data Center Market Investment Analysis Report 2026-2031: Opportunities in IT, Electrical, and Mechanical Infrastructure, Cooling Systems, Construction, and Tier Standards \- ResearchAndMarkets.com \- Business Wire, accessed February 17, 2026, [https://www.businesswire.com/news/home/20260120658159/en/Indonesia-Data-Center-Market-Investment-Analysis-Report-2026-2031-Opportunities-in-IT-Electrical-and-Mechanical-Infrastructure-Cooling-Systems-Construction-and-Tier-Standards---ResearchAndMarkets.com](https://www.businesswire.com/news/home/20260120658159/en/Indonesia-Data-Center-Market-Investment-Analysis-Report-2026-2031-Opportunities-in-IT-Electrical-and-Mechanical-Infrastructure-Cooling-Systems-Construction-and-Tier-Standards---ResearchAndMarkets.com)  
4. Dynamic Maintenance Cost Optimization in Data Centers: An Availability-Based Approach for K-out-of-N Systems \- MDPI, accessed February 17, 2026, [https://www.mdpi.com/2075-5309/15/7/1057](https://www.mdpi.com/2075-5309/15/7/1057)  
5. Data Center Redundancy Definition & Reliability Best Practices \- SOCOMEC USA, accessed February 17, 2026, [https://www.socomec.us/en-us/solutions/business/data-centers/data-center-redundancy-definition-reliability-best-practices](https://www.socomec.us/en-us/solutions/business/data-centers/data-center-redundancy-definition-reliability-best-practices)  
6. How to Calculate and Reduce Call Center Shrinkage Effectively \- Sprinklr, accessed February 17, 2026, [https://www.sprinklr.com/blog/call-center-shrinkage/](https://www.sprinklr.com/blog/call-center-shrinkage/)  
7. What is Call Centre Shrinkage and How to Calculate It?, accessed February 17, 2026, [https://www.callcentrehelper.com/how-to-calculate-contact-centre-shrinkage-90353.htm](https://www.callcentrehelper.com/how-to-calculate-contact-centre-shrinkage-90353.htm)  
8. Indonesia Public Holidays 2025-2026: A Guide for Employers \- High Five, accessed February 17, 2026, [https://highfive.global/compliance/indonesia-public-holidays-2025-2026-a-guide-for-employers/](https://highfive.global/compliance/indonesia-public-holidays-2025-2026-a-guide-for-employers/)  
9. Public Holidays in Indonesia 2026 \- Emerhub, accessed February 17, 2026, [https://emerhub.com/indonesia/public-holidays-in-indonesia/](https://emerhub.com/indonesia/public-holidays-in-indonesia/)  
10. Focus on Employee Training to Keep Data Center Operations Costs in Check, accessed February 17, 2026, [https://blog.se.com/datacenter/2018/02/06/focus-on-employee-training-to-keep-data-center-operations-costs-in-check/](https://blog.se.com/datacenter/2018/02/06/focus-on-employee-training-to-keep-data-center-operations-costs-in-check/)  
11. Long shifts in data centers — time to reconsider? \- Uptime Institute Blog, accessed February 17, 2026, [https://journal.uptimeinstitute.com/long-shifts-in-data-centers-time-to-reconsider/](https://journal.uptimeinstitute.com/long-shifts-in-data-centers-time-to-reconsider/)  
12. Data Center Staffing Strategies: Protecting Uptime 24/7 | Broadstaff, accessed February 17, 2026, [https://broadstaffglobal.com/data-center-staffing-strategies-protecting-uptime-24-7](https://broadstaffglobal.com/data-center-staffing-strategies-protecting-uptime-24-7)  
13. Employee Retention: The Real Cost of Losing An Employee \- PeopleKeep, accessed February 17, 2026, [https://www.peoplekeep.com/blog/employee-retention-the-real-cost-of-losing-an-employee](https://www.peoplekeep.com/blog/employee-retention-the-real-cost-of-losing-an-employee)  
14. The Cost of a Bad Tech Hire: How to Calculate the Real ROI of Specialized Recruiting, accessed February 17, 2026, [https://viva-it.com/insights/the-cost-of-a-bad-tech-hire-how-to-calculate-the-real-roi-of-specialized-recruiting/](https://viva-it.com/insights/the-cost-of-a-bad-tech-hire-how-to-calculate-the-real-roi-of-specialized-recruiting/)  
15. How to Manage Your Spare Parts Successfully | Prometheus Group, accessed February 17, 2026, [https://www.prometheusgroup.com/resources/posts/the-right-parts-at-the-right-time-how-to-manage-your-spare-parts-successfully](https://www.prometheusgroup.com/resources/posts/the-right-parts-at-the-right-time-how-to-manage-your-spare-parts-successfully)  
16. Defining Inventory Min-Max Levels \- Accendo Reliability, accessed February 17, 2026, [https://accendoreliability.com/defining-inventory-min-max-levels/](https://accendoreliability.com/defining-inventory-min-max-levels/)  
17. What Is SFG20, accessed February 17, 2026, [https://www.sfg20.co.uk/what-is-sfg20](https://www.sfg20.co.uk/what-is-sfg20)  
18. SFG20: Homepage, accessed February 17, 2026, [https://www.sfg20.co.uk/](https://www.sfg20.co.uk/)  
19. How Often Should I Have My Water Treatment Equipment Serviced?, accessed February 17, 2026, [https://waterdepot.com/how-often-should-i-have-my-water-treatment-equipment-serviced/](https://waterdepot.com/how-often-should-i-have-my-water-treatment-equipment-serviced/)  
20. How To Maintain A UV Water Filter System \- ESP Water Products, accessed February 17, 2026, [https://espwaterproducts.com/pages/uv-technical-help](https://espwaterproducts.com/pages/uv-technical-help)  
21. When failure is not an option \- data centre chilled water pumps \- PumpServ, accessed February 17, 2026, [https://pumpserv.co.uk/news/when-failure-is-not-an-option-data-centre-chilled-water-pumps/](https://pumpserv.co.uk/news/when-failure-is-not-an-option-data-centre-chilled-water-pumps/)  
22. Agilent 1260 Infinity High Performance Degasser User Manual, accessed February 17, 2026, [https://www.agilent.com/cs/library/usermanuals/public/G4225-90002\_HiPDegasser-A\_USR\_EN.pdf](https://www.agilent.com/cs/library/usermanuals/public/G4225-90002_HiPDegasser-A_USR_EN.pdf)  
23. Commercial HVAC Preventive Maintenance Schedule by Frequency \- Oxmaint, accessed February 17, 2026, [https://oxmaint.com/industries/hvac/commercial-hvac-preventive-maintenance-schedule-by-frequency](https://oxmaint.com/industries/hvac/commercial-hvac-preventive-maintenance-schedule-by-frequency)  
24. VESDA SDM Maintenance Service Frequency Table | PDF | Smoke \- Scribd, accessed February 17, 2026, [https://www.scribd.com/document/681522707/VESDA-SDM-Maintenance-Service-Frequency-Table](https://www.scribd.com/document/681522707/VESDA-SDM-Maintenance-Service-Frequency-Table)  
25. Xtralis VESDA Maintenance Guide \- FireSense, accessed February 17, 2026, [https://firesense.com.au/amfile/file/download/file/522/category/158/](https://firesense.com.au/amfile/file/download/file/522/category/158/)  
26. Fire Safety Equipment and Fire Safety Building System Inspection, Testing, and Maintenance Based on the Joint Commission Hospita \- ASHE, accessed February 17, 2026, [https://www.ashe.org/sites/default/files/ashe/fire-safety-equipment-system-inspection\_hospitals.pdf](https://www.ashe.org/sites/default/files/ashe/fire-safety-equipment-system-inspection_hospitals.pdf)  
27. NFPA 72 Fire Alarm Inspections, Tests and Maintenance \- Fire Service Pro, accessed February 17, 2026, [https://www.fireservicepro.com/Fire-Alarms/NFPA-72-fire-alarm-tests-inspections.html](https://www.fireservicepro.com/Fire-Alarms/NFPA-72-fire-alarm-tests-inspections.html)  
28. VESDA SDM Maintenance Report | PDF | Computer Engineering \- Scribd, accessed February 17, 2026, [https://www.scribd.com/document/681522706/VESDA-SDM-Maintenance-Report](https://www.scribd.com/document/681522706/VESDA-SDM-Maintenance-Report)  
29. Data Center Maintenance Guide – Best Practices to Prevent Downtime, accessed February 17, 2026, [https://www.parkplacetechnologies.com/blog/data-center-maintenance-guide-best-practices-prevent-downtime/](https://www.parkplacetechnologies.com/blog/data-center-maintenance-guide-best-practices-prevent-downtime/)  
30. 2N vs. N+1: Data Center Redundancy Explained \- Digital Realty, accessed February 17, 2026, [https://www.digitalrealty.com/resources/blog/2n-vs-n-1](https://www.digitalrealty.com/resources/blog/2n-vs-n-1)  
31. How to Perform Basic Maintenance on a Harmonic Filter \- Premium Power, accessed February 17, 2026, [https://premium-power.com/how-to-perform-basic-maintenance-on-a-harmonic-filter/](https://premium-power.com/how-to-perform-basic-maintenance-on-a-harmonic-filter/)  
32. Electrical Distribution Maintenance Services Guide \- Power and Cables, accessed February 17, 2026, [https://www.cablejoints.co.uk/upload/Electrical-Distribution-Maintenance-Services-Guide.pdf](https://www.cablejoints.co.uk/upload/Electrical-Distribution-Maintenance-Services-Guide.pdf)  
33. Dry Type Transformer Maintenance | ELSCO | Read our Guide, accessed February 17, 2026, [https://elscotransformers.com/blog/guide-to-dry-type-transformer-maintenance/](https://elscotransformers.com/blog/guide-to-dry-type-transformer-maintenance/)  
34. Fuel Polishing: Critical Assurance for Data Centre Facilities Managers \- WASP PFS, accessed February 17, 2026, [https://wasp-pfs.com/fuel-polishing-critical-assurance-for-data-centre-facilities-managers/](https://wasp-pfs.com/fuel-polishing-critical-assurance-for-data-centre-facilities-managers/)  
35. Review of Maintenance and Repair Times for Components in Technological Facilities \- \- INL Research Library Digital Repository \- Idaho National Laboratory, accessed February 17, 2026, [https://inldigitallibrary.inl.gov/sites/sti/sti/5554588.pdf](https://inldigitallibrary.inl.gov/sites/sti/sti/5554588.pdf)  
36. Call center shrinkage: Calculate, manage, and optimize agent scheduling \- Aspect, accessed February 17, 2026, [https://www.aspect.com/resources/call-center-shrinkage-optimize-agent-scheduling](https://www.aspect.com/resources/call-center-shrinkage-optimize-agent-scheduling)  
37. What Is SFG20 and Why Should You Be Using It? \- SWG NA, accessed February 17, 2026, [https://www.swg.com/na/blog/what-is-sfg20/](https://www.swg.com/na/blog/what-is-sfg20/)  
38. Determining Optimal Spare Parts Inventory Levels and Safety Stock ..., accessed February 17, 2026, [https://fsm.how/materials-management/determining-optimal-spare-parts-inventory/](https://fsm.how/materials-management/determining-optimal-spare-parts-inventory/)  
39. Data Centers \- Fuel and Tank Services \- Bell Performance, accessed February 17, 2026, [https://www.bellperformance.com/fuel-and-tank-services/industries/data-centers](https://www.bellperformance.com/fuel-and-tank-services/industries/data-centers)  
40. Vesda Air Sampling Panel Maintenance | Control Fire Systems Blog, accessed February 17, 2026, [https://www.controlfiresystems.com/news/vesda-air-sampling-panel-maintenance/](https://www.controlfiresystems.com/news/vesda-air-sampling-panel-maintenance/)  
41. New Mexico Water Systems Operator Certification Study Manual, accessed February 17, 2026, [https://www.env.nm.gov/wp-content/uploads/sites/5/2016/07/NMWaterSysOperStudyMan.-Update-11-2016.pdf](https://www.env.nm.gov/wp-content/uploads/sites/5/2016/07/NMWaterSysOperStudyMan.-Update-11-2016.pdf)  
42. Recommended Standards for Water Works, accessed February 17, 2026, [https://files.dep.state.pa.us/Water/BSDW/Public\_Water\_Supply\_Permits/2022\_Recommended\_Standards\_for\_Water\_Works.pdf](https://files.dep.state.pa.us/Water/BSDW/Public_Water_Supply_Permits/2022_Recommended_Standards_for_Water_Works.pdf)  
43. Managing Harmonic Distortion from Data Centers \- Dynamic Ratings, accessed February 17, 2026, [https://www.dynamicratings.com/managing-harmonic-distortion-from-data-centers/](https://www.dynamicratings.com/managing-harmonic-distortion-from-data-centers/)  
44. Harmonics in the data center: Risk & solution with GRIDCON® ACF \- Reinhausen, accessed February 17, 2026, [https://www.reinhausen.com/knowledge/power-quality/harmonics-in-the-data-center-gridcon-acf](https://www.reinhausen.com/knowledge/power-quality/harmonics-in-the-data-center-gridcon-acf)  
45. Data Center Maintenance: A Comprehensive Guide \- Dgtl Infra, accessed February 17, 2026, [https://dgtlinfra.com/data-center-maintenance/](https://dgtlinfra.com/data-center-maintenance/)  
46. What is Data Centre Redundancy? (N, N+1, 2N, 2N+1 Explained) \- Stulz: Oceania, accessed February 17, 2026, [https://www.stulzoceania.com/newsroom/detail/data-centre-redundancy/](https://www.stulzoceania.com/newsroom/detail/data-centre-redundancy/)  
47. 2N Redundancy: Ensuring High Availability Through Fault-Tolerant Architectures In Data Centers \- DataBank, accessed February 17, 2026, [https://www.databank.com/resources/blogs/2n-redundancy-ensuring-high-availability/](https://www.databank.com/resources/blogs/2n-redundancy-ensuring-high-availability/)  
48. Is A Data Center Mandatory In Indonesia? \- Ahmets, accessed February 17, 2026, [https://direct.ahmets.com/bright-content/is-a-data-center-mandatory-in-indonesia-1764797578](https://direct.ahmets.com/bright-content/is-a-data-center-mandatory-in-indonesia-1764797578)  
49. DATA CENTRES \- King & Wood Mallesons, accessed February 17, 2026, [https://www.kwm.com/content/dam/kwm/insights/download-publication/global/2025/Data\_Centre\_APAC\_Regulatory\_Guide\_2025\_Indonesia.pdf](https://www.kwm.com/content/dam/kwm/insights/download-publication/global/2025/Data_Centre_APAC_Regulatory_Guide_2025_Indonesia.pdf)  
50. Leave policy in Indonesia | Payoneer, accessed February 17, 2026, [https://www.payoneer.com/resources/workforce-management/leave-policy/indonesia/](https://www.payoneer.com/resources/workforce-management/leave-policy/indonesia/)  
51. 8.3. Leave and Public Holidays \- Better Work, accessed February 17, 2026, [https://www.betterwork.org/reports-and-publications/8-3-leave-and-public-holidays/](https://www.betterwork.org/reports-and-publications/8-3-leave-and-public-holidays/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAYCAYAAAAs7gcTAAAAP0lEQVR4XmNgGAVDBvxHw3gBUYqxSaLzwQCrIAMOcayCDDjEsQoy4BBH9xQ298MBuiKCigkCvCagA9opHgQAABN0I93ZU/TBAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAZCAYAAAC7OJeSAAAAd0lEQVR4Xu2Q2wrAMAhD/f+f3p4cEkxaWO0ueMAXT6ihZk3zIw4ys74EdWBLgYg61mVGsw08nE05o2Nsfwf65ivLMJTLmMnTzIoy8XfZTyt3IaVp5+Ch7E3qUGAA9+idzGEOve/KyEo5cc8yS3m8TCzARuWa5vucO1l/gR+a8s0AAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAAFDklEQVR4Xu3VW47cOAxA0dn/pmegDwLEBUnJ1XbKmb4HMGI+RMmuOPnnH0mSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSpMK/TEgP8O/Z7+NvLv0S62PP12ntLXiuK2c97bvDp3t9uu7N+EyMlyu/47Lr3dWvuHPW3T4929X3/RafnntaN9WWqE89y65+l0/3OXkGSS/Ufbhd/g34D053X+HaJ/1kn5+sfat4991vcPo77uaEXf2qO2fdpXpGxjtX+7/t9O8JTeum2hK5eN9VzzLV7lTtcWXv0z5JL9F94F3+LXg+npXxt7zlHG+xex/8TXf9y9RzOuNvxmf85Hk/WfNNfN7T87Mvr61q3T17v4FnYLxztV/Sl3UfbZd/g+ofWJ6XccZ/cCOu1uR8dV+tydjP+xxXue6+2zfXq3msdX2Tql7lKtx/cqWvkp+x072L6pxTzFqWZ7GHtaqPMeX6bkY3h+tznmuq/Xg/yWdhP+MT1ZwO+7rzd33MV9iX11b57p79VM3iOsbZ1HMac4akB+UPj9fdOL+6JuyJe+YjN6nm8D5wPnsYB+arOVVPdz/1Mu7uP4kr0/zJlXW7eqj6ru4z9ef6VIs4u6NWxaHK73Jdvevp+vM94wnrsZ5zTp2uqeYz152j6pmwP2ONMd2VY517R66672LOYI+kG3UfWJcPXZ0f8J04u7uvYqrqnB+Y28WB+Squcrv7wFzXP/WdxJ3q/FdM67t8peqdnp9Yr+LIVbXT+NNaFYcqX+VCfpaMuelsy1Rn/KSre7E/vw8+E2OqcqGr7eYyXn6SC9w3cnTlbKczJd2k+8C6fOjq1Ud8F87u7quYqjrnB+Z2cWC+iqvc7j4w1/VPfSdxpzr/FdP6Ll+peqfnJ9arOHJV7TT+tFbFocpXuZCfJWNuOtsy1Rk/6epe7M/vg8/EmKpc6Gq7uYyXn+QC940cXTnb6UxJN6g+uKXLZ129yy8xd7o67OMarmVMuT7NWZjbxctJLu+bc7v7wFzM41zmq3VT3Klm7VTnoio3YT+ftdsnsFbFkatqu7g7w642xUuVW6p83qOrdzFry1RnTPmZ2ct4cqU3cM30XqZnXKpc4NpuH85gvDDHOFT5bt8qXq6cLc/OOUkP6D6uKh8fJ6+q/qdw/4wxRZ1nrp6Ds3bxcpLjPpHb3QfmGIcuH1hnXNmdrcN1XDvFrIUuH67WqzhyVe1KnF2pMV6q3MKz5vPnmLlsqi1TnTGxns/DWod9uzgwn/esatV9qHIhz2Tf6Z6BOcaB5+XeVUxTvYqrnKQb5Y85PjDm+OExx3XMP6k6Z5Wb8MzVxdou5syMPdU65qqr6gun+VwLrFc9oapVucpuD9ZzT47Zw95lqgXWp3iqVTFzOb+rLayzh3HGfs7J9V3MXHex70ncm/tVueVkTVVbdvUs17muutjHmPM67OeMKs+Ye/Gq8sxJeoH8ccaf/MD/Bk+e88nZnWpP/jZZl9c9unfP7yfr1lRO+36zb76jp/Z+aq6k/4n4jyT/Z7O73ojP8JQnZ3eq9z79HlVO9+neff77V9WY65z2/WZ/+h3l3++pvZ+aK0mvc+U/xU89PX8Sz8cz5Dxretb03qfa5Gr/b/Ot9/PJb3nFk7MlSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZJe5j8y9z37Lq/uzAAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAZCAYAAABD2GxlAAAAhUlEQVR4Xu2SUQqAMAxDd/9LK/2YlNBs7RwOIQ8K9lViPmxNCFHiIpO9f8boo8dKeUYFVDAD/mPRHAXLRHOEWYGq385vCjLYjfnt7C7I8qr+YfYCu418dCv5LnGydwN3AzP8M8uI/CuiQOZwR2cwv0wUyBzu6Azml+mBPtQ7f0M380KIDDcLl4F/mzheZgAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAYCAYAAABA6FUWAAAAn0lEQVR4Xu2UUQqEMAxEvf+lVxBcZh+ZRKFgt+bBQNOME+OH29Y0TfMwn0JLsexiymuWXJ5echX+dclL/5Hqh+PuZyF79y+vWtLherzXj+Uy2aeHdQQ9Uc4BB2Uiek8v/VpnnqjnfNn5BwZnItEA59c680Q958vOQ2CYG+YGVx6t3fmso+eHoOFO9CmVh1l3NAwGR6JPqTzMuqOmaSZmB/enxDyluJ6FAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAArCAYAAADFV9TYAAACvklEQVR4Xu3WyY7cMAwFwPz/TyfwQQDxQNrqwbTTSxVgxFwsiZOD+s8fAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4In+xrNb+yRns+3MvtPzE89Ys3rk3Lt9r2Jntp2ew04PANxiupSm/CdYF/Y0Y81PPctV/Seeseby6GxXPa9kZ7aVv5rtqg4At5kupSn/aaYZ8+Kf+g5ntVeU5834neUsZ3HWAOBlTZfWlP80O3Pu/mCb+lb+rLbeMzeZ6lO+6vac5FnqLF2+vk/xM+UeXbx7luyr33b5+j7FAPAjeQm9ywWTZ+2eHTt9Vz25Xxd370vtz3/PZE/GZ9aeO9/k+TOu77neVZzquabnzCPnyVrnrD9rZ/UuBoBt0yUy5e9w595Xe13VD9nTXd6Hs3zqcp215m7/ofbufDvV89uuL3MZ/7b698jzHa7iNNVz7a4vcxkDwLbpEpnyd7hz76u9ruqH7MnLfDnLpy7XWWvu9h9q7863Uz2/7foyl/Fvq3+PPN/hKk5TPdfu+jKXMQBsyUtnmfJ32dm7XsjTs+Os76xWZV/uX+PsPezmOo/Oe8jejFM3SzdPt07mMk51/el5RPZfxSnnq2fIWspcxgCwZbpAMp8XVeauntq/ZE/W7jLtlfmMq6ztzF1lfOhyKXsynmRfxilnmebp1slcxr8tz5Yyl3HK2atXmx2AD7Mumrxw8ln5JS+crrbbU/eotXx/lpw198xa1pesd99krq7V5btcejRf7axfnZ23e5bMZfwM01mqq3o1zTM9XV/mAODX1QsmL5t6GWUu32vcXV7dWryGb/4/+ebZAXgj9cdV/tDKH2A1l/ka7zz8X9P/6Tf45tkBgDfzzT+ev3l2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeDf/AMVF+xOo7ToMAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAYCAYAAABXysXfAAAAoUlEQVR4Xu2TgQqAMAhE+/+fLgYtjkvdLKNt+OBgu07ToG1LkiQ52RuakukXQJZbZhlymVH5ehmtv+Y/ovXja74XrY/XN1lyGQ1+hstjbU8fKSPd2Sto/m0YSwj7nGUfwbt19tReRq8Q9jnLPoJ36+ypfY02dM+5og1daNWGgoNIL+4R5xHOSgqDG9fm7FniPMJZSSGENRqB8K/zJ0stMxwH05y9Q40repoAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAArCAYAAADFV9TYAAAC3UlEQVR4Xu3WS2ojMBAFwNz/0jNooRnx6JZkEhs7VIFJ+qn1ixfK1xcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwBH/i0+Xr2Kfb3Wc3NpzGv+NZ6w6PnPu27910d+zy6TS+uu0DgKfoHqIu/0TzYe4e6JnteoYu/65XrHvaY3fvd7X7Xk93P42vqvUB4GWqh6h7AH+D6l6PPtyfJM9b3f83qO6V32v27PoB4K1Uj1Q+bL9JdbfqMe/Mnt2cdWwdX+ubdaZuvMpStWen2qc7X+bV79W8ZzntVZ0nz7zTzc18Havqbg4AbOXD844PSp6r+tyq+tc6x9Jp/qle52d+8mj/NPe8mZM9pz1z3a6nsp6r+9w69Xdjj+y19uScnF+tW/UAwJXq0ciH5hHVvMyyfqXqblWd2VTlVTbMddbxXe+NXO8k9z7N78a6eZllPVTZT+vON9zku/lTN17NzXrILGsAaFWPRvUA3armZZb1K1V3q+rMpiqvsmGus47vem/keie592l+N9bNyyzrocp+Wne+4SbfzZ+68Wpu1kNmWQNAqXtoqvxWNa/KHrGeqfvcqvqrOrOpyjPL+d3vqy5PufZJ9p7m59jan2NDZlkPVTbMtXefW11/lU05lnVax/OMOTfrIbOsAaBUPRhVNlQP1Fpnlvn8mXnV/0zVXlWd2VTl1Z1Wa5ZjU5evcp8b2Vedb5V77OqZ7eqhyn7a7dnyPqus0xyf6+RaWafMsgaAf9bHZn1kMsvHZ+1b5fzMu99znWfLu1XnzSxVPads96l6K91YlaWb9VfZk/Pn+CnLOtf9KbnHbv88R5d3dnPXNU5Z1jMDgG9bH5pVPkBrntku5z34Xnr+NgC8ve4frTXPnqxnlmPZw2vld8Z//jYAfAwP1e/nn+aevw0AH8GDBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw9RcZaizwuGz6rwAAAABJRU5ErkJggg==>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAYCAYAAACsnTAAAAAAtklEQVR4Xu2U2wqEQAxD/f+f3kWhEGI607m4sJgDgTbVOuZhjsMYY8xP+XT0ahyEwKEIHIbAoQgciuCpUPCe+ps7q3fBZn6V3aG03t+x/8KhCHqLslnVr4RS8aNGIdhnNXLzeXlLDPordYD9aB29Es6R9Dy8oCUmWzpaB9iP1tEr4RzpnWeYbAH7K4fj95hsln2rUi+BP7uiE/ZmhPBMPcc+z6fgZbM6YW9GCM/Uc+zz3BhjtvAFQQ0BDrmXvqUAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAArCAYAAADFV9TYAAACuklEQVR4Xu3WyW4bMRAFwPz/TyfQgUDjoZtD21JseaqAgdQLt9GB+vMHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeJG/8ZzW7uT07K94T8+eL31kz6d9P0Xutztrl+uc9ADAy00X0pS/k3Wp12eyq33Gs+er6txX61yd+ye6+s1WbqovV3UA+C+mC2nK3019B1fv46r+k+ReM353u/N85DcFgB9hurCm/J1dvZNVX392s3/KP9T8ri9NPVN+yfV2ci91fzk2c7lO1l9lt9aulrKvjs3xNZc9GQPAh+QF9JsuljxP95w66e3mrPH0fanju7km2Zfx5CPvIfeecdXN2/VM6vjpuXK6dtY6u/4u7nK7GAAuTZfHlN9ZY74ytupy3+VkL13PlJvyu3hnzXk6pvadjJvq3diMHzKX8Svlu8m1M05T/R3ODsAvMV0eU35nuhBPdGO63Hc52UvXM+Wm/C7eWXOejql9J+Omejc244fMZfxK+W5y7YzTVH+HswPwC0wXTpc/MV2IJz4z5ko9y/ScOO3temquznPV28U7nznTLk7dOaazZPyQuYyrOv/0XKk9OS7HZ5y+OlfmMgaAre7iqJdRlRdVl8vPpeubnq6+5Pesv8rpOl1Pnqnmu1yV8ST7Mu5kT8Ypz5H7zjhlLuNny/3UPebaGac8e5W5rD9kLmMAaNULLC+jzK9aNdXzc33Pp5P5rr/O39Vf5WSd3E+3x8yd1GpPZ6pN+eV0/qX25Ng6x1Uu45V7tqs1drVUe3LeOkfGXS5jAHiavFzywskLqbqKl8x3F9u0Bq9353d+57MD8Ebqn6fu6XqWzF89y/re1bscz5fv/E7ufHYA4M3c+U/xnc8OAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7+YfvQQNEIYE2ygAAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAYCAYAAAB5j+RNAAAAfElEQVR4Xu2TUQrAMAhDe/9LbzAQupCodKU48EGgjaLpR8domkZyBSpBuUAz5cOVpcOtcjJcelf0EZSv8Pq9PZRfhFOoGvpsDrubx/ofrJARwhZgf3RGvcCiJ2T2sRd9dUZtB4fjnZHpWcZ7MdaYDOV/whuKNSZD+U1znBvLCY5yyLP+vQAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAArCAYAAADFV9TYAAAClklEQVR4Xu3Y22rrMBAF0P7/T5+DHwRiMyM5ECduvRaYZi4aS+mDSn9+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBv4Vzxd7e5yjxkPV5zn3fPSK3s+23dH1d6fcnYA2Oouui5/R+NiP3PB7+qveve8Ic+ye0/2/ya59ypeyX4A+FO6i67L39Ure32l95uq30HGf0WeNeORA4BH6i7BLn9X44I/s+/R0/V3szKfcaerd/kh55/tzzjzc23+3MVXq85XvT/jWfavzlCdNWvVOgD4mvmCyudT8r3VszP37PpzZvavaod5fc7q5Mwza4bRf2ZNvmdWxVVuFc/mfXXPTrXfbn3GqZo1PufazGU8cgBwC92l1OXTqq+6BD9h996sZTx0czKXcaeb18n+jCtVfazLWsaHzGX8bnm++XO+O+NU1c+e/UwPAHxNdyl1+bTqqy7BT9i9N2sZD92czGXc6eZ1sj/jSlUf67KW8SFzGb9bnm/+nO/OOFX1s2c/0wMAX1FdUocu/6qzM+ZLtXt25p7dmqxV8chl7ZC5jDu7faWqP+O0+h5ybcaHzGU8G/NXz0r2zmuq9Rmnuf7qrDM9APAV3YVU5ceFlk9XH7m5dqVqL52srdZmPHKruLKbWan6Mk6j3q3NfaTMZXyl3Fu+O+PUnX3EmZtlfeQA4GvmCywvucwPVX5eW8n+K632Psueal3mVvnsqXS1Lj/k/F3/Ye7JtfOMVVzlrrR799k9zD25tpudcZUDgF/p7KW2qnGNJ3/fTz47AJT/gRj58bN65hrXqL7vp3jy2QGAX+jJfxg/+ewAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwl/0HdiLpJcvXLd4AAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAYCAYAAABurXSEAAAAiUlEQVR4Xu2TUQrAIAxDvf+lty8he8uqOBh29EGhTUOtgq0VRbEdxyC2Js2iStql01FLf0WqpUcfkHrkXWFpVuqln9CeXnBG1x5xejTn1oyCqO58s/lojuqXYiaI6s43m4/mqP4aN8jVTmPtNJe/Ql8kOoA+Bj0d5uwv4Q7vukIfg54Oc/aL4jec/t2aZqAtqFsAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAArCAYAAADFV9TYAAAClUlEQVR4Xu3Y4UrsQAwGUN//pe+lPwrhI5m22NVdew4UN5nMdKJCxK8vAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4Bf9i+fs2ifIO2e8e0V/d5+Xrtz5bN27me79hN4BoDUNtin/CfbBfmbAH61fdfd5VT376D1nen9H072f0DsAtKbBNuU/xZW7X6n9bXnXjP+C6XcvcxkDwJ81Db0p/yn2oX+mj71m2jPlNzW/qqum9Slf5ftW8i71frk3c/meXH+VVW+Zy7jK+9Yect+q14wB4FfkIHuHAZX36J4jteaovjtz2p91m7q/O6uTNRmvfOf7kHHVndvVTOr+6Vk5em+XWzk6L+Mut4oB4MdMQyjzGV/xnb136IZx1a1NuSm/iif7eWfrN7X2zN5pvdub8SZzGd8pe0uZyzhN6+/YOwAsTUMo8xlf8Z29d+gGdNWtTbkpv4on+3ln6ze19szeab3bm/EmcxnfKXtLmcs4Tevv2DsAjKbBNeV/Sr3D9BypNUd7urVp/1FtF0+u9LPL2oxT18fUS8abzGVc1fOnZ5J1Xf1RnOp6npl7M95kLmMA+BHdAJoGZQ67Ve4orvlXqecfva9by3vXfJerMu5kTcaTrMs4ZR9574xT5jJ+le49mcs4Ze9V5nJ9k7mMAeCl9mFVh1bmcjh1dbmWnzOePr/Cqpcqa7p9mTuzVmvS1Xx15vyq1uTeesZRLuM9d7fVO1ZrnVqTe+sZGXe5jAHgLXXDrMbd5z2uQ69+5fWe/L1+cu8APFD+d6H7gy2fupafs4Z75c/qSZ7cOwDwYZ78R/GTewcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIC/6D9iUd0xpQcQHwAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAZCAYAAADJ9/UkAAAAaklEQVR4Xu2SUQqAMAxDd/9LK34Uamw6UGj8yIPCloRljK1ljJCDzCjjhRmXS5CUy374xS/KGdnbZZFtngUqvdPQY/oNZlZ6p6HH9IfRTZVHLcjr2KP2muowVo65z0jK8xPHoewibIyZ5wTJDV+hL3EH4gAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAArCAYAAADFV9TYAAAC00lEQVR4Xu3Y62rcMBAG0Lz/S7foh0B8jC727mbdcg6YZm7WbCgoyc8PAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8Iv+FM9J7dvu7rSbebX+TlfOOumtelbfx9Pcp1RnrfZtVrV02gcAj1JdYFXu23KnjGfGvmrmtH7lh4K7druMTnqr3bO3ivP5tNV5V+JqfrSrA8AjVRdYlXuC3Ol0z+w5jfP92fcJeUbGo6yt4tnXPV7Vf1ueX8W7fascAPyzqoutyj1RXtwz2VPFPZc/CIzPiarvlfmMR1mr4pOzs+fK587e7M/4xG4m6xk3Va6Z7XiSr76u5gDg7fLi+eQFlGfkc9XJTPXujJtqjyo+cXcmz+v5yknv6R5Z28Wj2R6zz3Oimpm9r8o1Va7L2hhnrckzZj0A8DHVRVPlmlm+29Xf6cpZ2buKx8s5L+qeO1HNnsiZjEdZuxo3VS7d/Sx37c7Kfar+KtfNavneLnMZN1UOAN6mumiqXDPLd7v6O105K3tX8XhpVxd4xjPV7ImcyXiUtatxU+XS3c9y1+6s3Kfqr3LdrJbv7TKXcVPlAOBl/XLKi6bKndrNjWdWz4krvV32n8bVWRnPVLMncibjUdauxKv9Mr/rzWeU8YmcqeL8LKnKdVkb35e1JnMZN1UOAF6Wl143y40X2u75lOrdY66qN5k/javPk3HlZKeZ7F+9626c+WZ3Tua6qtZzVe1EzlTxat+mynU5u4p7bhU3VQ4AbusX0vhU+ZSX2vj1+I5Pyh1z14y7WX93pb5T9ZzONqtdMr/q7ap6zp3UPy3PG8/NXO6TtaynrOfs7NzMZZzvBYBfl5fU+G+X8Tc8YQeezf8RAP5b4yU3++vCE/7K8O3zeabqFw4A4AtcxKw84RcKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4DV/AZUi/w9dqlQFAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAAEJklEQVR4Xu3X64obMQxA4b7/S7fMD4E4SLKdZJJs93xgEl1seVKYsn/+SJIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSfqV/jIhST/d9WLj6mrfaOduOz3P6s6fZk+1Z1Xndrkq/2rVjJhd1e7AOZ+cfVnNX9Xv0M3r7tLlK7t9r/DorJPnkaSPqV5UVe5b5Lt194z8yYv4pC8v6u7H/mrvZKefd6v2RK6rd056L9X5q7hTnbVS/Qbd9x0n/dXsyOfvq/o7dPfo7tJ9r/CcO3EO45XTfkl6m3iZ8kVV5b4J7zbFrE1OekO1h/Mjrn5XxpOd3lUP73bikX7uYXypclSdtRJ7pmdmPDnpDdzDu7zyfo/iHaZc/gyMP2X6HXc8skeS3qJ6KV+q3Dfh/aq4e7bJaf9ltSffg/da7aWd/jyj6p9qKyd7umdkfKlydHrn3Nt9r+LJSW+Y9lTPtIpfbfp3qnL5MzDOeE7E1Z6cr75Xe7Kqv5tdncX9GXM5rr5zvyQ9hS+wd75sOI9rkutVP+u7TnrDak9V331O2ulnzxSztrLb383onrnKUbe3wr6IqzMYT056Q7WnuselyjPOor9bK7mH/TxjOpsx8Zzqe+D57GEcmGd82Tl7Ve9i7o2cJL1E9ZK5MMf40+LeeWWr+ML91dox9bHGcxlnvEu1drCX+xhnnMfVOZ3X5Varw9rpfQLnce2Y+qqz2M/4lVZzqxW1jDFVdT53YG4VB+YZUzX/mZi1S5WTpIdUL60Lc4w/Le6dV7aKL9xfrR1TH2s8l3HGu1RrB3u5j3HGeVyd03ldbrU6rJ3eJ3Ae146przqL/YxfaTW3WlHLGFNV53MH5lZxYJ4xVfOfiVm7VDlJOhYvLL5Uutyr5fnVOsH+VdzZ7cu6PVW+ejbGk51e9nBmVd+10xvzuHKdqhzxnA7n8g48g/HkpDdwD38LPtfUT3w+rgl7d/fkz8CYcj3PqfYxt4ovJ7lp/jMxa5cqJ0nHupdJlc8vuOqlN8V3OH1RMu7s9mXVHub422SMJzu97OHMqr7rpDdwD+NLlSM+x4lvff54JuYyxnfhnOleVe8k6tWZ3HsaX6YcZ0/zec5JzNqlyknStvziyi+sKhe6XHzyxcXeV5vuGlb1ym4v53MO81Fjbnde2Onn+dWeqTY56e/uwPzumSe9F86IvVVu10k/53TzeeZUu0M3j/mptjLt7Wo7cWAc2Mu509lVT5Xnqnok6S3ySyg7jX+Cb7/zp+/3yfnf8J/fp+f/VHf+bneeLUk/Sv5LMS/WqljS78T3wl3uPFuSJOm/944/3u4+X5IkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIk6Zf7B1y/ZMaorO7cAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAZCAYAAAC7OJeSAAAAfklEQVR4Xu2QAQqAMAwD9/9PKwqDcqTb0HVM6UFgpqUJlpIkP+JwNDoPoRWwpIClFZZleloGg5XC6YV5fghblvFozZ7i3nxTxv5VdYc+d7mvTUNvRlnoc/f2afAQfc4v6I+8K/yeghfKohXlTUMVsG8GK28KPGoLKHk7SfJdTrLpiHjorhsGAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAAD4UlEQVR4Xu3X26rkNhAF0Pn/n07wg0BsqmT1Gbtt5qwFJl1bt7IzaJI/fwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgH/SfxkA/GbHpTg/Xf6WyzN7WvX8pOzlrX2u/KS/szWr8dXY1bpzVj2sxu7wyXnVvMx29tud8w0/PWe8w0/XA7xadbm9+dLrequyp1U9VdmbzP3t9nq2ZjU+6vHvNcev1O2/09/4neNXmr/B7jm5Jtdl/5WRV+uH1diVujO6PH2rT4Cvqi637uJ/g663Knta1VOVvc3c326/OWe3zrPu1r1PZmd9VdmVuj4rZ/NyPN8t66dVPVRZJ98J4J9QXWxV9hZdb13+pKqnKnuz3b/8ck5Vj2weG3nOv0N1/pBZ9piq7EqffJP5G1ZrMst3W62dVXOqtXNd/c75qdor12U9q+ZVY1WdWTUO8Ij54pufO+QZ1XMm53+y9tuyv2/1medVz66dudWeWR+q87vfVzs7J8dHnf0OVXaY37F7dnw6d7fOfat6Jce7tTv77maHzFd7j7O7OdX8tFoP8IjqIqqyHXnJ3aHbv8uHrrezfPWcqeZklvWbfNJbzl3V8/er5mU25Pevnk6en3Kfnfl3yh4+kWvzvaqxWdazbiz3yXlZH3azwyrPsS6rflf1IbOsAb6uuoiqbEd1UV6t27/Lh663s3z1nKnmZJb1m3zSW85d1fP3q+ZlNuT3r55Onp9yn535d8oePpFr872qsVnWs24s98l5WR92s8Mqz7Euq35X9SGzrAG+qrvYMtt1tnaMr56Vbk6Xz7o5Vfa3uvfpsqvN53fPmZ05s5y/W1d5Zn8r333nO8xj1bwqO+T+1bPj07lZZzabx6q5Wc9ybF6f+86yPmSW9SzHunNHXWXV76o+ZJY1wFdVl1CX5dPl8/jVun2rPPvJ3rK+UrfvTpZ9ndV3yL3P6kNmu3WVZ3a1av85y/GsD1V2pe477GS5tvs96irrjLGxLveex2dZHzLLerZ7blWPrPpd1YfMsgb4ivnSqy7C6nLKCy+fOb9addYqn8eqOvOrZD/zeZkNOWcnzz2ulv3meausGjusxrv8atnDfF6XV2M5fqU8J8/Les6q+YfV2HA2PuR47p1PNSezIfdO3fpVntmQ81bzswZ4tfnymv85e+OllpfunOXvb8s+sp6d1d/29Pm/2ZPf/q6z79oX4NfJ//A5e56UfWRv1fOEVY+ZVfWT3tDDb/Xtb59/Bu9w174A8Gv5y/U5T337u/9H4c69AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADj1P3L7SeHYIKoQAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA2CAYAAAB6H8WdAAADQklEQVR4Xu3Y4YrzNhAF0H3G0r7/o7T4h0DczsjOt3FiJ+eAwJqRY2sT0GV/fgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALipf4vR9T5F7mVvf3t9AICX6AJJV7+rDF/d9bDXBwB4iQwxQ1e/s9xT7u/ROQDAS3QhpKvf1diPwAYA3M74r1M1PkUX0vJ6NR81AICX60JIhpc76/Yyh9MjAS3nAACnq0LKJuvVmjvIMNYFsyHre3MAgNN1ASTrGd4y9GQt51eS711dD1nLOQDAaeZAVYWsDFvzmqyN69X8Cqq9VbXZXv9Trfa66gEAT1QFkazNB/O8JmvjejW/gmpvVW221/9Uq72uegDAm8wHdHc9ZC3n/M5eeFz1Zrmm+l7nZ+09FwB4s/mgzoO7OsxzznPk33M1z16qvre5182zBwDAJMNShq28zvWzI738jNU9APB1xkHpgPw883dbfb9VrdN9xqarD0feIfvVWgD4SkcPyPnArcad5Lvn+CS5n9xr9leqtUc/Y15Trc/a3noA+Cp5MJ5xOP7zpnGGv3/+/5x3j79+znXkd3FkzbC3Nn+TWQOAr5IH5+pQHGu7sZIB41Wjk++eY+VugW1vb1VtturPve7zh9+szRoAfJU8BHPO/eV3OsLSPDpVrwpT43pvPl93n92tq9YDwFcYB2IelLDJ30f+Trp69nKeazdVbTPfDwBf6V2HYB7e83t09Sv603dc3bfqbfb6d7Xa06oHAB/v3QdhFz6q2tXM7/jI+67uW/U2ozb+btUaAOCDvPuw70JHVbuiDFdH3znX5efMul6uAwA4RRc6uvqVPTOwjXm17pHnAAD8Whc8uvqVPRKkcp3ABgBc1hxActzN0Xeu9lfN99ZlDwDgFF3o6OpDFWY2Xf1sjz4z13dBLPdT3Zc1AICn6cJGV591a6ra2f7kmXnPXiirrsc8awAAT9MFjao+gkk1sv9K+by9+ZD1ef5oL2sAAL82h6sMI1V97lXzrL9SvnM+v6ptjtxT9TarHgDA242QMgeWObhcMcRc8Z0AAJ4q/6OU/4GqxpVc7X0AAJgIawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFzNf9KpTxuLYb7PAAAAAElFTkSuQmCC>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAZCAYAAAC2JufVAAAAhklEQVR4Xu2S4QqAMBCCe/+XLvpRiOgtwo1R++CgeUNltG2LxQ/ZzTzdd6UKGloEqUJXKYT/GTXD4QJqhtEKdXpXpi7lqHbdeFuq9cInbu/0m9YFt4uXQkNlzjruKw1hP/xW9yO4UipQnVmL4IqoQHVmLcJlzOaoq7KsR4gbJpi61JTlvs8BaZmDfZOnetkAAAAASUVORK5CYII=>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAADA0lEQVR4Xu3Y7YrbMBAF0L7/S7foh2C4jGwltRO3ew6YeK5GH+kuaOmvXwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8IP9zgAA/jXjMqvP7ti37ZzpbPxv7O5fe7I/6zvkGc7s9nbrdtnKbt8V3t3rle8DAB+xuphW+bfkJbo6X/ZdaXf/+Znvd56t2jlnyjN2Z83vU7N873Rr3iX3yfrMq/0AcJvVBbrKvynPlPW0yq9wtH9Xd++fkPvl2Tpn512NZ+/OXp9wdMYd78wBgFusLqVV/iTdHwazzjx14112JPvneVbn6vK71L3e2bObs/oOXZ3ZlGN1zZyT3yHfuznVqr/O6bKpm1/HVvXRGAC8pV5G+dwh9+ieXdlb6xzrvNo/rc6Z+c77Sv6bdM+ZV3qrVX/3Hbr1u6zq1jmqj/qHnSzr6Wjt3Htm3XvWc25mAPCW1SWyyp+iO987l2Neqq/IuVnPLHV9V+vOtbvnqi/zWXd5ZlU3tjrjWT3sZFmnnb2HmuX40djQZQCwZXWJrPKn6M53dmF2uot6V87Nemap67tad67dPVd9mc+6yzOrurHVGc/qYSfLOu3sPdQsx4/Ghi4DgFPdJTWs8ivMtY+eM11PrvHKWjt9U+3NuVnPrH7O9+xL+T2650iO78wZjvoyn3WXZ1bVsezNeWf1kFnWQ5cNdf/syXrYPWuODV0GAKdWF0iXz4stL6XMs75St27W0yqv8rvsyDlH9czq53zPvqvl+rlnjk/ZV2XefbdZZ1bVedmXWTeeMst66Pbs9so6HY0fjQ1dBgBL82LqLq/M69h8r5/zPde5Q56v2+torOrGuiztrN+N78y70tl+r+ZTt+bZXulobl3jlTrX7Kx688l8OstWT/YBwG3qxVM/53teRFnzPN/6Gd25751rA8Dj5f8QZL3KeK5P/pzyd+cud64NAI/mEvz/fONn+ok/5u9eHwAe6xMXLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/Gx/AAW5Le/GFwDgAAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAYAAACBbx+6AAAAoklEQVR4Xu2QUQrDQAhEc/9Lt+RjYXgddQtLpMUHA+s4Rsl1DcPQysuIsO8yj5Md5Lx2fvJg9141vTbcMa6m14Y7xtX02oiOUT/KtBAds3zXW2jmG93Qo0KiwM4wl+zqhh4VEgV2hqMDFJfJ3hb9eBWuepTCWuFclv0IZuGqRymsFc5l2WNUi6oe+6yPwL/CJexphp7TcbiAS9jTDD2nYfg73kXmwT9htXSZAAAAAElFTkSuQmCC>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA2CAYAAAB6H8WdAAADcUlEQVR4Xu3YUY7rKBAF0N7IW9bsfynzlA+k0p2CxOk4IZ5zJBRzARunI1Hqnx8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4+TfavXxHR/d5ZF7OPfosAICX6QqQLttN7jH7nVp0zQqw0a9jszkAAKebFSyZ7ajbY5dVOb7qz66HLgMAeLmu6OiyHWVh+cy+c824Z5enLgMAeLlaoMyKlZ09u+/Z/JqN60fmAgCcpis6umxHuc9ZYdWZzc2sFm2pywAAXqorWrpsV90+uyyNd+zmZqZgAwA+qis4ZllX5GSW/bN1z8n9dVb7zKy+W+oyAIBfq8VKLVq6rOa1Xz8ze2cRk3vOZ3fZzWz+0I3nc2ZrAQB+LYuOUXh0Wc1rv35m9s5CJvecz+6ym9n8oRvP58zWAgAfNjusr36QZ+Eyy2b9T9ppL8/Kd8j+TM676u8TAFrdwZf9KxnvW9/7Xn8Xu+3nGd33f0/OnV0DwCXVAqXK/lV883t9896rZ95jVbB1fQC4lFqwrQ7Eq8j35Jjx/dVWZb8zWztTf6OZzfoAcCndIfjuwy8LgK7tLvfbtSvo3uPoe9Y5q/l5v9X16j4A8NXykBv9Ln+0reaf4Z83tjP8+fnvc3Zo77L6beRYXmcDgEvqDrnu8JtleZ2fVZcNefB2bSYLjTPbSu63a51vK9jynfK9st+pc7p73OQzZs8bZjkAfL3ukJtlswMz+zer+Xy37u959O9d59Q199bmuu4aAC4hD9c87LJ/szpUs3/jMGVl9vvL/tDN7zIA+N+6dxjmePZvuuwss4N8lu/oyB67eZmt7vct3wkAMLEqcrqxzHL8nbpndtlOnvnOck2uq/17YzkOAHCarvjosl0d2eu9eTk++rMcAOAtuuKjy3Z1tGCrLWVWC7bVOgCAU3UFSJft6kgRda/wykzBBgBsIYuRbytKjuw356369b6reQAAp+uKjy57xLPrfuNIwZZy7ejXNvLUZQAAL5cFyyx71LPrfuPIfnPevbUKNgDg47qio2ajoMn26Pg7zJ75SJZrH7keugwA4GW6AqvLRl6t5ufcM+Xzu33nfnLuvfFHxwAAPiqLoO566LJP2m0/AACnyCJt9PM/Tjv+92mnvQAAEBRrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvNJfGryXar9eBFcAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAAAvklEQVR4Xu2UUQoCMQwFe/9LKwiROLw22dWf1jcQaJNJui3iGMYYY1o8GnEsnQt2nK3pXLDjbEv3p95xtuXYi13BjzD8CC86j0DnuP+HzmXo/NUjqMtGblUj7AmHOdUbsKbmZNSe8QGLUkqoOvs4q8oHal/1VuuV/4ailBKqzj7OqvKB2le91Xrl32Y2ZHbQVT9Qe+XHOvur3q/JB3IoawyS88pj/8yvIvs/QR0wqzGI+sjssX/mV5F9Y4yRPAENne0Tzad9ywAAAABJRU5ErkJggg==>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAAEKUlEQVR4Xu3Wga6jOgxF0fn/n34jpOeRdeRjDKUtoXtJqMR2gsOdpvPnDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7nv/8v/Lbu30CXu6sVewZwsfiByz90v3Y4PPUdPHVfnbzXPM7711hw8RXovqrrV8Redf8rv4dV+wZwkeoQWPlQO6Pa6x3fwdF+qvo77mti2rOr07h7D1VsFbn32J/GfoXuW8erWrl3AC9wX34XfyK3Vxf/piM9uVoXv7tp365O4/ojHqrYCrRvHW+q2FPFXnXPOl7N6v0DOMH9YG1c/Eli/26vLv5N055W29fEpO+uJufiXmPd/E9zvbi4mtbdnduHi4fqb1yNV/SEPQA44Clf+vih7a5Kl7urab/TupVM9tTV5Fzc6+fdaM9H+jxSe3dn34PW6TqrWrl3ACdMvvSTmlVND/6uzsU3XW4inttdTpcLkxpn7/mbvXxH91ldFRffRC7XVLGpM3PO6PbrnJlzd6/sSee+8nev6PqVvfwRV64FYAGTL/2kZlWTQ3bT1bn4pstNxHO7y+lyYVLj7D1/s5fv6D6rq+Lim8jlmio2dWbOGd1+nTNz7u6VPencV/7uFV2/spc/4sq1ACzAfemrg+3O4rDsrsperrr/tmkvru6u+5qY9NvVRE7fQTenc3beUWd6PFq/gjPvIejc6t/CKybrTGqmrlwLwALclz4fZtUV9up0jsZyPLh8Hl+lW9P1pDEda63GXG5qWuvq9p6t8W5cXXs1mYs7k7qupnpWFQvaXzXONK8xnavzK9VaE65O+6hi2q/mtcbRfLX+lK5zdm6Mcy85Vj1H67txx63tYjrOqhiAh8uHQnU4VAdKjk/ndDFdq7reSZ+lz9M+g/ad5bHL6efE0Vq9smrs+j57X8V0rHFnUtfVVLkqFvL7qPZRxfJ9nq9jzVVc3sU3sa5eOZdV/Wldnh+fGnO07sjc4OpcPHM12o/2pPGci3sd79FnVPfdOHNxAD/MHSAaz/ZqNK+fysU/xfXn3keMq1wXmzhSu6day/Wl9/mKWDbJV/edq+um8j6qccT27vO4WuMT9JlVr7m3Kp/vdT1V1VWxd+mesddTfg8xzvc67rjaap7G9sYA8O9QyoeZXhHPuvpcqzGtc+t/0l6/OZe5nM7P409yz6561VqtiU8Xj8/qWVX8VVesp73lseZcPuJZVfNJ+kztR3vLnxqf7MGtOZn7SVVPblztQ2uVm6fjKqaqGADgzX798H3X/t2P3Tflfu7Y35T2rf/h0HzW5b7lyp70PVy59ubq9QAAO951oK/iV/f/hD2/sodX5r7LHXsCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADOX5KcNPbYekcYAAAAAElFTkSuQmCC>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAYCAYAAABXysXfAAAAvklEQVR4Xu2SgQrDIBBD+/8/vbHBQfaINq6DafHBgcZcTmmPY7PZbMAjrKlJLnp2Pg23eMzI75N4/sr0FxxhP0a40vtz0sfQk/QlniL1dUkH0pP0JZ4i9XVJB9JTfVqK27NUV5yPtPQ3DGAR1d1ae6gx2+mK83D9AcNZpBXqeqgx2+mK83B9ibNQt6f2wum6d2e9ucMwoEJ5iWQwfaXpupXDvq9gAAc6jecFfaXpupXDvmVZ/hH8Sktzq8c0eQIYkcM973VvVAAAAABJRU5ErkJggg==>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAYCAYAAABN9iVRAAAAvUlEQVR4Xu2SQQ6DMAwE+f+nW3FIZS3j4g0n4oxkyWwmpq44js1ms2nOp1hLUVns7vy1tFze+ZwrzqtYbiGHvbyGXagur071noM70/UvVAeoU73n4M50/QvVAdEZd+iuntE5UZ0/cP2T9FwHaCmUq+/0WpEnfsyo/wX/SqFcfafXijzxY0b9FPSCE8rpmbK7PpI5rm8zfny2RJZRZQ7lkRmfepvsxfGMMqrMoTwy41PfBvpTlib7ElrQennkC6N25RvWlZLXAAAAAElFTkSuQmCC>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAYCAYAAACsnTAAAAAA1UlEQVR4Xu2TUQrDMAxDe/9Lb+zDYMST12xNKYkfGFwhq7Whx9E0TdPcwuuHWhq3oFve6UvhFnTLO30p3IJueadvwdbLO/ooQhykj5LoYwB9FKA6Sv613C9GuptRX+D8Fd+8Q5lq1iJffs44P/koh/w6S+gc9UOZeYiKfPk54/zkoxzy6yyhc9SPZp5GwwPS3UeQjzTqK3LOVZmnoJd9CL2qQHvnIb1CZ3TW6X/jAvWFVIH2zkN6hc7orNMfj/tgXcj5iBHvIxld+AwzMm9lxgIzMvfiDelm5By8kDqKAAAAAElFTkSuQmCC>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAYCAYAAACyVACzAAABAklEQVR4Xu2T2wrDMAxD+/8/vb0soJ3KubXZ2JwDgVpRYkfQ49hM83itGj2eFPQE0eP5axhAqd1KD4NgQDsswQURaelhMAyF+6lhGAyG+6lhGAyG+5vDh+JqailxQbiaWnpcKLVfdQVlht5eI95bcY2/FVYvo/7bcI13WAY2LEPUwlKPeqnN6j04f3TXqH6iZeCl+q1n2ZB3ujryUavhZlC0bvWkfqJlYjP9doNSL7g68lGr4WZQtG71pH6ixxR5okGd39WRj1oEfe4s68Kofhl9sA4aDU2f050ngl6en9WXwEYcQnE+pztPBL08P6vfzrKLBT5k6YNW8tPDf5od1uadJwe8G/OwEVVFAAAAAElFTkSuQmCC>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA4CAYAAABAFaTtAAADjUlEQVR4Xu3dO6tjVRQH8I16sXDGGccXvrDw3aqNYKeM7RQzIqIiIiKCgowgoq1iYWUr+A0srAUrBRH8BH4YXdvkMOcu905yc29yT5LfD/7FWWslhzvV4jwypQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDkXBnlngPPbfMAAEzGhcjnkZvzfHzguTQPAMBkXI88EzmaBwCAifkgcn8uAgAwHTfK7NmtQ/RPLgAATM3lyIeR+3Jjri40QzZlfI5tnK8an2Mb5wMAWNu1MrvCdndulONLzCaXmt53t2pnofW9rRoAwCTUhe2pyB25UU62sLV6rVpLb65XH7T6rVrW+lvyMQDAZLxeVnt+rbXkZHnBW1VvtlcfO805V/mbAADO3ful//za2KqLzTpLUG++V8/WOefgNJ8FANgKC9v6nwUA2Lj622tXIxdzY+SkC81ZzffqLSedzVo1AIBJeCfydGm/cFDlRSYfZ+P+stlBa27dBWyVz7RmWjUAgEn4KvJQLo4Mi9M4Pa1eq1bl78xZVWu2VRvL51o2DwBwrt4rqz2/BgAwOfkKTM5Y7rVmqtxfNLsN9craq2Xx82sAAJPWW6aGWq9f5Xo+HlvUOwv1N9Yeixyl+rtl8fNrAACTlxepvKgtW9jyfM+y/mm9Efms/P/W55eRh1MNAGCnLFrM8nGWF7ZFWt9/Fh6d59vIz5HHj7fLR5EHUg0AYKeMl6i8UOXjbNFns0X98cLYS8/z87wW+a3Mbn8O6i3StyNXRrWx7yLfH2C+KQDAzugtQ0Ot1Rvkz55kNsvLWSvLXI78Hnm53Hpe7c3IC5E7h6GkXnk71AAAO6K3CA31Xr/KvfFxXrLy7Kb8Gvk0cml+fKP0r64BAExavnqVM5Z7rZlB7uXjTavPsf1Qbr1kYGEDAOhoLXbbWNyuR36JPFFmt/1uRh48NgEAwH8sbAAAO6K1uG3Sc5G/Ii9GXolcjVw4NnG+xv8eeZlt1QEA9k592eDPyLXIJ5EnI7cfmzh/vaWsVQMA2Es/ldmbovUFhPr/iE5NazHrLXEAAHup/ijsj5EvIvem3hTk25+WNQDg4NTboX9E3orclXpT0FrOWjUAgL31bOTvyEtlN55fa9UAAPbaxcjXkUdyYwJai1mrBgCw9+rLBke5eI5az6u1agAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMT9C2B2ctaCPhJmAAAAAElFTkSuQmCC>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAZCAYAAADXPsWXAAAAPklEQVR4XmNgGAV0Af9JwAQBPkWDzxB8asAAnwL6GEJQAQNheeoagg8QVENIAT45OCDbEORwIIRHwSggGwAAwk07xanCKocAAAAASUVORK5CYII=>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAaCAYAAABsONZfAAAAS0lEQVR4Xu2OMQoAIAwD+/9PK4JDKNdqXUTwIEvSlJg9TRNtUyrR4fIBhWEJzUnkXyiRShwV0xKaAuZoCpijacm0gW4nIf7I6/MYHbHdPMRaE5/AAAAAAElFTkSuQmCC>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAYCAYAAAD3Va0xAAAAVUlEQVR4Xu2PMQ7AMAgD+f+nm81qT4AZKmXhJBZ8wUrEco2nmDfMMkdYIfpM/HqoYlIi+P9sRvBRNiM6cXTINbpcONHlwkld9mnJGrlnLihQ5J75shyhw1OtFz5OkAAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAAQ0lEQVR4XmNgGAVUAf+JxCgApwQSwClPtmZiNIIAVjUYAqSAwa0ZpxqcEkgApxqcEkgArxrk6MKG8QJ0xeh4FAxNAABWBjHPSA8oiwAAAABJRU5ErkJggg==>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA4CAYAAABAFaTtAAAGjElEQVR4Xu3du6skRRTH8VpdfIHKyq4PdGUFxQeKIKuYKGukiKIoIogsmAg+VsV3aKSJiquZmYGYmBgJYm5iZiBoZiaI/4LWsbu4Z3+equreOzP39tzvBw6zdc7p6t7hTk/dudMzKQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAVjmU41iOI8SBiksSAABYBFusHc3xWY4zxIGK+xIAAFiEwzlO5zipBQAAAOwPtmB7VpMAAADYP2zB9ogmAQAAsD/Y+9euyvG2Fpx/JNahN3dt/7V80avvRu9+adVMr+7Vemv5olcHAAALYK+uPZzjCS2M/BP9up78y3y1eaNj0HwZa6+n493S/Xmanzsuon20/v9zxgAAYCEuyvFyjmu1MNIFULSA8KJab5ui1hMdg+bLWHs9HXtRLcp5rbrW5o4L/T+VnL8t5o4BAMBC2OdwndVkRVk89J74fb3X603p9fvXfj22qN7S2jbi7w/t3+24aM1dy08dAwCAhbg4x5uarIgWDzVzeosp/X6xov0+V6v3RNtNMWffvXpR+rTWypfbVh0AACwMC7ZzRdtNMWffvXpR+rTWypfbVh0AACyEXR1qcUOOx6Smoif/nvPdpiaaLxr7XFTv0TladF869uaOC5235PxtMXe8V54c4z3if3FvAgDAsVfWLF7NcbXUvOhJPsp5rYVLS61X860FS2vfOlatbSPar2Nv7rjQeUvO3xZzx3vh9hzPjHFr2vk5JIa4MAEA4Fw6xqdaEGXBoFET1aZso+FprdSjnNere1E9ynmt+Vs1U6vXxq1ezRe9+l6wK5Lt+0stLpAaAAAQ5Tf6N7QArMmdafgKtBNjAACwK/rKRBSF5rXuaU+rd53slY2bxuArqbApr+W4J+28f7JoPRbmPFZafedbU73eWr2W3wS/79r+Na/baH3V1j0/gC3WOkmVfK/uRTlTy6+CLczs/WnHJW+vrL0+xlGpAetwTY7Hc9woef/zr4+56LER5YzmW/P0aporND91XMvPMee4PK1F87Rymt+UvdovgAXSE4Y/efVOZlrTsdeq7dZlOc7keFfy9t61j8cAVsleOXspDVcfe2/luFtypvWzH9WinNG8Pv68Xk1zheanjmv5qfR49Rhb82mttm2vb5P2ar8AFsqfGKMTSJQrdJs5vatiV5vdleOrHD9Izb7d4P0xgFX6IMefabi44MoxZ6/0Pp/jlnHstR5nOjZRzmi+9fjr1TRXaH7quJafqtbfOtYa3aZ1jBqRqOZzOof2a67WBwBVelJRUa7Qmo69Vs3oCUyjxr4j9ME0vMn7V5e3J8/b0vB+IovIozk+J7Y6nk5t+nOm0WKf6/dtGn5hMO+k4YKDiM5VxrX91HKabx1vax9RzkR5nSeq1/Jz+Hl2O5/vrf07Eu23iPKtuXVsWv0AUDXl5NSqa03HRdSrSk8tWsri7K+081lrtpA7neP+MSLWS2x/tOjPmUbLdTl+TsN7JI+l4c+hd5zTsUPn8mOtmShnNN+ap1fTXKH5qeNafqqovxxn63iLqE+3r9VrYy/K67aejk2rHwCqWieMUqv1RPnaySjqXTW7qOC3HE+NY1uwPbdTBtbC/tz+fY6zafjFwP4MH9HHQO/xEeWM5lvz9GqaKzQ/dVzLb0K0ryk5vR907EV53dbTsYn6oz4A+E85KbXC05rWPV/v9a7SFTm+zvHJOLYrRF/cKQNrYVeFfpfjmzR8o0FN6/GjNV+vjTW/m5rx+am9Wq/lN0H3rccwNd87bu2NQvt07PehYwDYOD0RrfukZFeE2nvVfkzDn0hPpOHrqLZFdLL3enWv1Xu+tYPswxynUv3VNQAA9i19Yl/3kzwLtnbda/Web+0gY8EGAFi0TT7BH87xUI7fc1yVhg8vPeUbFszff9F9qvevjj2t9eYpuagGAAAwi72qdnOOP3KcTMNHLBw5p2O5dFHFgg0AACyWLdB+yvFCjo+kti1YsAEAgEW7PA3fePBlGr42aBvpQkkXbyWnooVeyZfbqNbbDgAAYBZ70/crOX7J8YDUli5aNBWa17GnNT+Oan5B5+kYAABgErvw4FSOv9PO9ztuA10c6eItqtdorTcPCzYAALBSh3Jcn+MLLSxcWThp1Oqe5qb0zq0BAADMYleLHtckAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUPwLHbFZ94sKyigAAAAASUVORK5CYII=>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAADGElEQVR4Xu3Y0WrcMBAF0P7/T7foQSCGmbHs2LvFOQfM1lfXkrwNKOTPHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAX+JvDF7mE+/3iTXwPQNw0jg4sitzpXPUv1NcI67/yb1cEfcY9xnvn1CtEfeV7e8t4js+8b53zgXAL5EdHjGL90OWTXHs7gMvquY+m/8Pur11Y5kz/a4bx+L921TvV+VX3DkXAC9X/SK15tn4sPNsl90pm7tbs8q/rdvz0I1lzvSzbrafLHuT7v2q/Io75wLg5apDY+ZHh1c2tpvdpZq7yodu7CfOfCeZnd5OZ9rtnukddavxKo/mGjtrVbLnsizT9bqxK+6eD4CXiodjPCS7A6Uai3NVvSl243Wk6lT50I3dYZ3/zFo73Z3OtNvd6e3+fwyxu/Pc+sxO/8jZ9aeu241dcfd8ALxUPDDOHLTVWJU/pVqvyodu7C7xu9wR+/F+yLJprtldmSpfrZ2d/tCtuco6VbY753CmO3X9buyKu+cD4KXigREPuDi+qsaq/CnVelU+dGN3id/ljtiP90OWTXPN7spU+Wrt7PSHbs1V1qmy3TmHM92p63djV9w9HwAvlB1mMYvjU+xNVd6Zz1TXkazTPVvld+v2kMn68X7Isspu96gXx+N9JXunqOrsZp1q7krVr/KfemJOAF4mHhbzUFrz2JnO5k/K1syyIb7fms08u8/yztrZ6Q9Zbzer7HarXvW+WbaKz3X9bCzLhirP7K6/ynrzXeLYmq/j62cci6ocAMqDJObVwRMPmTgWx5929A7dvuKz83PtV5+ZnXVWcX/xylR5Zreb9eJejvY1VeNVPuzO342tsl6WTXH9o72seezGz/jvVZUDwCtdPfiqQzUewHHsW86ufaZ/pvsNcX/x/pOyn4fq52VmUZYBwKtdPfzm4bpeWR6zb3ly7Sfn/qn4//Htvca9xCvrRFkGAK/3iQPwE2tUPrH2J9b4TfyyBgAf1P2lBKKjv64BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOT+Aagh6yP1pWPQAAAAAElFTkSuQmCC>

[image38]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAZCAYAAAC2JufVAAAAfklEQVR4Xu2RgQqAMAhE9/8/XRQMjmOeRrIt8oEQ5+lJa60ofsjxoKajQusoRIUue0IVWEddRAK9fjpbH6WIeFLxAq2e94dRZ4+au/EMVi/9KFzoFTPSURvNRr5foQIR9vBc11Pg5dZi9vBc11PAAC6Edfayfzl1lGLbZ/sWJ8ireYcbgjhJAAAAAElFTkSuQmCC>

[image39]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAYCAYAAADKx8xXAAAAM0lEQVR4XmNgGAVEg/84MNGAJMXIYDhrJCskQYCQJpxyVNeIVRzZX4QwCkCXxIdHweAEAOOfLdO27uSuAAAAAElFTkSuQmCC>

[image40]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAAR0lEQVR4Xu3OQQoAIAhEUe9/6QLBheHPEDeBD2YzKigyWqyHIBpS79AS9Ypeoj5VOjKl4/ZXqXdoiXqVvYozO7wFnYtRxp82EAkt0/5CzwAAAAAASUVORK5CYII=>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAYCAYAAABDX1s+AAAAz0lEQVR4Xu2QwQ4DIRBC9/9/uk023cYgOGhTvfASD4swMntdIYQQ/s7LOKdY6YGZmeyNMit9B2wJdznXJ1FBpe+ALeQu6vo6VEjpFU6R0V2Fm606TLEyiBVQPwe/K9o5bhYzM9mOlSB7UBXB74qVpTAzk/2yFPpQZZdLAb/kpzook9KR9rHqYaU7VLMfmMfN3iiT0hH8EaOHle5QzX5gHitbGUZ3LWpOW8Iq1MC87gzmKbNYkp2TYBfWydGVpwPN7JwEu7BOjq48IYQQQtjLG1iqxTvXm5MnAAAAAElFTkSuQmCC>

[image42]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAZCAYAAAAxFw7TAAAAV0lEQVR4Xu2QwQoAIAhD/f+fLggEGS41gg75wEPTTVKkaT5gBFUGA7BKoOEoxILm40BmZLpCT+GKwnWF9piR6cqut7BfCIclN5PCW4jvElcD8SyVEzWvmOfLOMi1MPCJAAAAAElFTkSuQmCC>

[image43]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAAAdklEQVR4Xu2MUQrAMAxCc/9Lb6Rso1hNK+wzD/Lz1EQ0P3FNd4q9sQdhbrA0jzFLmJd9KkP7xPXymfKJ6+Uz5RPXf8/wKrC73WBxO4i1e7JZcIduf+COyj6VD2zE3AzNqIzas0z5gQoqzzLlB2/IjoEdvKZpDG4MK2yURQK1eQAAAABJRU5ErkJggg==>

[image44]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA4CAYAAABAFaTtAAADbklEQVR4Xu3dvascZRQH4MUvREg0mgTUoKgI0cIyKEIKEQWtFBQsNH4iCqlEYogfha0g+C9YiI2lpZWNpY3/jp7DncXx8M7emcvOzu71eeBXvOd9d2fYLfYwOx+rFQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJw6d0TOR86dIGdXAADM7qHI95HrJ8hbKwAAZnN7l0uRl8scAAB74IEub0culjkAAPbAw12+rhMAAOyHC10+rBOdvxsBAGBH8ty1R7u8WOb6NGoAAAvJc9eudclbegzRrAEALCRv5fFVl000bAAAC8mrQj/psomGDQBgIRo2AIA9lo+ieiryQZchrQsOWjUAALbs/tVRo/ZclyGtxkzDBgCwA3lV6Pu12LNuyloBAJjNmGZjzJrTIBu2a7UIALCU/pGhoaNEY9ZsUz1qtYttruUNcy9HPqsTAABLaDVBtVbHqVXbpvr+dbwNt0Xuizxe6mcir0auljoAwCJaR65a41ZtLvW967iltaZV6zsbeS/yZann36EfRc6V+rYN7d9QHQD4H1s3ZJsahTFr5jBle/21x73ursizkV8iP5W5ByO3Sm0udZ+P2+/U/y6W+l4AgIWM+eGfsmYoY01ZuzZ2G/dEXoh8Hvm9G6/lEbZ3e+PqjcgPI/Na95pNxu5zquumvBYAOECtH/paq+PUqvXVBq1mjLqujodM2UZeXJD3WPsz8mRXyyNvT0eeXy9qyCcgTMlxpuxzXdd6bf286zwAcEBaP+S1VsepVdum1vu3alV/zZj16YnIb5FXuvGFyMero4sRdqHu86b9rnN1vFbrdQwAHJB1g9BPVedba7apbmvsNltrWrXqUuTHyDfdOM9fu/nv9KyG9m+onsZ8JnWujgEADkpeCXoj8nM3Pg03zK0NWh0DABwUDRsAwJ67O/J65I/II5FnVpsf9t7X/3tyKLtUt73EPgAAbF1eKXplddSwvRn5NHLvf1a01UaojlOrBgDACTwW+TXyXeSLMjekNmN1nFo1AABOIK8UzXPY8vYe75S5sTRnAAAzymeKXl8d3UA3/x6dyrliAAAzuzPyUuSvyJkyN4ZmDQBgZnnhweXIt3ViJA0bAMAO5FG2fMrBFPX2GRo3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4pf4B+Sz3pGDMSFQAAAAASUVORK5CYII=>

[image45]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAAAXklEQVR4Xu3QQQrAIAxEUe9/6RbEQJn4sRpEkDxw4RhHsJSU0nnPYC3Ri6GyLy0JF1MB5Ua/yc27oKHcaKGbd0FDuemd677Cl0FvTvfVtuIZVED5b1RA+ZB+l650gxdSbEK+hmsDEQAAAABJRU5ErkJggg==>

[image46]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI4AAAAVCAYAAACQXNaIAAAAzUlEQVR4Xu3SQQoEIQxE0b7/pWdwIRRFJcqA0D39H7gwiRtT1wUAAACg9ZHT0bn0JtXwx6oguJ0ZvAjBwU80CFUodsOFF+mCo0GpQlMFysOWDh5MF+jL1AVXy66C4CFJBw+Ulpfus7aaT73V21R3OrdzcFj6aL2nntfUqud9v1c8GKuDw9JH6z31vKZWPe/7veLBWB0clj66WkBVH7SeZvw+ab2awU1oAFIYfIE+5/NDVZ+6evcON+IB8MX5En3O54eqPnX17h0AAABwzBfum8I+AbAiDAAAAABJRU5ErkJggg==>

[image47]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAVCAYAAAD4g5b1AAAAYklEQVR4Xu3SQQrAIBBDUe9/6XZVKGE+CoUO0TzIJiCa0jEiIsxcC7FHQ6i3RqOot1aN2urXJUeMfBwz9uvQ9/mVtKIHUK90zCyt6AHUKx0zSwu6nHpb+rWrbEOHVYmI+M0NGThcpAlu/3MAAAAASUVORK5CYII=>

[image48]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEoAAAAYCAYAAABdlmuNAAAA3klEQVR4Xu2SUQoDMQhEc/9LtyzLBjvkjf6EpcEHgp2M0bgdo2mapjmWTyFOQ99XemPF7M7+DXoL6ZNe1A3pk9Qwap5dVD+kO4+Qj/RJahg1zw60Ly1tpRHkI32SGkbNswPt24sCXF9aGpH5SU8LLyqencT+bhbSV5CPdNv4oeLZiS6IZiF9BflITy93gz3oWfSvavV3BvnjbJU5I+T70fViF47o0TrVXf4GOutyHj104YgerVPd5W+gs26bRy+lJVTyo9EvkUWs0fxodBFZxBrNG6AXZNB/VwP0ok7lC71t4h51M4fbAAAAAElFTkSuQmCC>

[image49]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAATklEQVR4XmNgGBHgP7oAKYAszSBNMEwyGBjNyBqI1ozNJnQ+TkC2ZlyKcImjAOQAQscEAboGojQTUoAhh24yNgPQ5eDy6IIkaR4FQwIAADSKO8UfcpJAAAAAAElFTkSuQmCC>

[image50]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAARElEQVR4XmNgGAVUAf+JxCgApwQSwClPtmZiNIIAVjUYAqSAwakZOTxI9jO6Rgy1GAJYAF416KZjwzgBukJseBQMPQAAWFU7xWAW0IAAAAAASUVORK5CYII=>

[image51]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOwAAAAYCAYAAAD50BEbAAACsklEQVR4Xu2US47kMAxD+/6XnkEWAgy2RFL5lVGtB2gRk6ZkJ1U/P8MwDMMwDMMwDDb/ktqNN2d6s9dd7DDzzt/PV4E/1h0v/M2Z3ux1FzvMfPv3gx9lVX8NdW68n8zf0Vit4Do+383ZfDxDltHRWK3gOj5fBXtnVcE0iduA6d+Mc3blYVrA3sOqVZ6AaVdweleofUwLWH+8m8wTMK1L1UvNUa1bqPADpX8zztmVh2kBew+rVnkCpl3B6V2h9jEtYP3xbjJPwLQuVS81R7UuUcGB4/lWnLMrD9MC5lnfk3pn1foV1swz+WzeA6YFzIP3wvpV611YDut/wDTK6Y1/COfyHY+i8lT56zpqd5Fl47PCmZFpQeWp8p++H8zv9HI8Kac3/iHUS3BeFNOCylPldz+SM2TZ+KxwZmRaUHmq/KfvB/M7vRxPyumND9E9+AruVeXg+O70ZOXQ9TtUWdV6heN3PVk5dP0OLEv1YhqFbcSLQe+V9apW8FmBWaoYru+AeZyMN3t1wPvqzLnC/E5epy/zuBkKZx5XV75fMDOGovfKelUr+KzALFUM13fAPE7Gm7064H115lxhfiev05d53AyFM4+rK98vHHPlubqOQ6O+C2o2pTH9wPEEzNfJYagcpmUwv+p14HgC5uvkMFRO6MpzmrVBVRm4zrwHbibTP4GaB8/lnAF9yh+gv7OXgVlZJmqh4zOCe5T/AH3KH6C/s5eBWaoUjqcEm2WVgevMe+BmMv0TqHnwXM4Z0Kf8Afo7exmYlWWiFjo+I7hH+Q/Qp/wB+jt7GZilSuF4bgebqmErDddVztvsNk8H/JCyuos7s94C7yKrJ3gql+IcjHlQyzw7sOtcuzD30+cj9+X80JgHtcyzA7vOtQtzP33mvh4E/1DmsoczzPczDMMwDMMwDOf4D17d/R/3ndJkAAAAAElFTkSuQmCC>

[image52]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAXCAYAAADUUxW8AAAAP0lEQVR4XmNgGNngP4kYBaBLEsJggNUkBiLFiVKEBKinGRcgShE2ANM4MJrJBiRrRnYqOiYI0DWQpHkUDGoAANTpQb+ubZYjAAAAAElFTkSuQmCC>

[image53]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAZCAYAAADNAiUZAAAAeklEQVR4Xu2RSwqAUAwDe/9L68ZFLE30YT+CDhQkrRlBs58hNpg22qVeVPoBrJjlKbBylqfAylmeAv47nFK8rEUaMSIvlarSJ1L5LluoXBba+Sa8C0PTOS07uCVlg7CMEd0vgyVXhWq3xKjUD+7xObpJp7Sc8R3pO9kBJ0BinnLmf04AAAAASUVORK5CYII=>

[image54]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAYCAYAAAAs7gcTAAAANElEQVR4XmNgGAWDHvzHgnECdIU4FaNLYFWMyxRsYuQpRge4DAEDZEl0jAHQFeBVPApIAgBiIinXFY1iSAAAAABJRU5ErkJggg==>

[image55]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAYCAYAAADH2bwQAAAALklEQVR4XmNgGILgPxTjBDRSABNElkBRRFABDGAVRAbUVYBVMTbHogCCCoYxAAALiBrmoq/g1AAAAABJRU5ErkJggg==>

[image56]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAYCAYAAABTPxXiAAAAnklEQVR4Xu2RwQrCQAwF+/8/reBFmSbdeQq6QgZyaScvCXscwzAMX+QmamvMgsb5KWZB48TwqVmGxG8dDv44MMTOu4TL21DjGOy8FjYngdZbkcwsYXMSyJerytC5zOq808dWLGB4VYbOZVbnnT62YoH1VqxmXv17wCtXgYR9rAT26hzKqukF9rES2PtWTiTvAC+NL94BLv+XRwzD8OQOUBCWagwyGcYAAAAASUVORK5CYII=>

[image57]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAYCAYAAABUfcv3AAABHklEQVR4Xu2RwQ4CQQhD/f+f1swBgx0KxbiKybyEg9B2u+vtdjgc/pg7Ln7AhA5tJpSe0EFmlZ1UeFofyrSi0/pQphWd1mdjekG1m71HNh+lCsWHR6PA9NHOk90MRfMO+J4vXZXi1SgwfbTzZDdD0bwDvudL16w47r028yFeh54qJ7sZiqYLy5Q+HNLRMtBfZWY3wzKq6cD0z30ntKNloL/KzG4GfiA2HZj+ua9C/T3S4m9G5F2wvZHdDEXTBTO3ntvCYbdsPGzvyfwRimaBudF0QO+WsS0caIrGw/aezB+haBaYG00H9NIMemjSycl0nZxvQPvQQ4PMj/9cpl0omivAjmWPUiCQ+bFIpl0omivAjnIPSXQxEzocDof/5gEz/gEOPnvslwAAAABJRU5ErkJggg==>

[image58]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAYCAYAAACFms+HAAAAoklEQVR4Xu2QgQqAIAxE+/+fLgoKO2+XsxkJezDQud0dLkuS/JYVG7MwXfA98HShdzL4lwwNfP4Iq7d4NZR/1cNha7EHr4byv3rWIzsr0KylLJS/3DUfBBiqpRRsBu8VjwMEDNVSCjaD94OyaZ1bYaZemMbtjr/AykvvXglmqDTxgZWX3r0SzBChKRkpPlI7TBx/OkrXJMoAQ0fpmgw3SBIHG7szlGwYhD0cAAAAAElFTkSuQmCC>

[image59]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAApCAYAAACIn3XTAAABxklEQVR4Xu3Yy47DMAgAwP7/T+8qh0gWgsbOa73JjJRDKAaUi1E/HwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACY1U/yzCDONMtci6tnqerP9h0AgBtkl38WO2q0Zsy/Y1HpWQx7cs5Q1Y+9qzwA4CGqy76KHzFSM8uNi8qZ9tQezd8j6xFnzXIAgAeJl/+VRvrcMdfaY2+fvedGtDPGWas4APBA8eK/6vIfrXvlTGfUO6PGltgjvi+yGADwcL0LwFZeXLiyp9cVuaMzREfOjlj7ZP2yGADwAr1LwFZeXM6yp9cVuaMzREfOjlj7ZP2yGADwINVlX8Wj3rxVb36Wl8UqI7mLdXHbc+4OFjYAeLHqsm/j7TLTE//mSF7WO8bX95GZopHzWU4WO0NVt/oOAMBDtMtJtqhsLQNVvNKbH+eJ59pY/G2Rxc4UZ2v7xfezVDWv6gcA/DPVchTft4zmf1PNtMhid/rr/gDAi7T/IMUFKfvtTrF3Ntc3cf7s2evIWQCAw2ZYRtoZ2kVtBrPMAQC82CwLSfwXbJa5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC4wy8uJOIeIdtgZQAAAABJRU5ErkJggg==>

[image60]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAARUlEQVR4XmNgGHTgPxQTBAQVoivAqZhshQQB0RrwKoRJImOsAN0T5CvEJohNDKsgNjGsgtjE4AAmiYyxAnRFOBWOAvIBACEzMNBuyryNAAAAAElFTkSuQmCC>

[image61]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAYCAYAAABOQSt5AAAAu0lEQVR4Xu2RgQrEMAhD/f+fvnGwG5JprB1XJvWB0BqFJhVpmmaSDzZ2ZesgvuZ/Zd2rMuwjGmLam7E+lRINMe3NTAfhDXr9SjB/N3Qgw0tFSHnqIAxWB4KfEFUWukdFiXVGdheNRpWF7lFRYp2R3UWjUWWhe1QUWx950MjMauhb8MFYGt3zzhqvvxL0g3WBApZG97yzxuuvBP1gPaZKEH8B07SMombNlAfNWSZRs2a2YFvjSAdx0kFU5QAHosU7L6MiAgAAAABJRU5ErkJggg==>

[image62]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAYCAYAAABp76qRAAAA+ElEQVR4Xu2SUQoCMQxE9/6XVhQL9ZHJtOzSjzYPAjqZ1GTwuoqiOIxXV8UNKsgHYHgV6mQGyqj0U+DtNg9lUPop8HabhzIo/RR4u82jGVinojKItD8YoB3YHJVBpFnUYyuZ2YF/AlcZyqf0L6H4Qw4N4GZdL+tH9EeO1Aj0pbOycZlBg5t1vawfwaBcjUBfOqsas3rPyNJK/zAyvwL+droPl1YHRDo9PfQS1eP7yrcC5pHuQ5MaiHR6euglqsf3lW8FzOPRfXhoBHUuElWDn/nWNkTHN73/rHyNTGdtiTqwghykPyo6kN8ds/7tUAEovRCowJReFJ43LFDvERi6Jj0AAAAASUVORK5CYII=>

[image63]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKkAAAAYCAYAAACBQ93/AAAB8UlEQVR4Xu2T0W7DQAgE8/8/3SpSiMiIPbg7O7YURtoHL7CG1H08mqZpmqZpbsGfU9Pckv5Imzf+Yzjjo5jNjPr5vEo1h7/HSDswy/LonfGekTx8/jpqAeVXUQfPsDPr2d0lm83qCjWj/BXUbrP+paiFlF/Fjt3J2Zn17O6SzWZ1hZpR/gpqt1n/UtRCylfYcUceuZLDPVYySJaT1RVqRvkrqN1m/UtRCynfYwdVemfwmZX8s/YwfH6kqM9Dn/OZDPq+To8iyvdE88ytKII9o15ZUL4nDV/EZ1byz9rD4A9JRX0e+pzPZND3dXoUUb4nmmduRRHsCXtl4YXySZYzC3Nmso/excgyfV31Rj6fDfrqLuVViGYV7FOzFX/mljeqoPwRaoEZOLuad8QuRpbj66o38vls0Pe3ZHcpn4wyCPvUbMXnDWrmA9Wg/BHllw7g7GreEbsYWY6vq97I57NB39+S3aV8Msog7FOzFZ83qJkPVIPyq3CJLE/1KH+GmT0isjlfV72Rz2ej6s9kkmhWwT41O+NHz/TeWJG6irvuMVIEe3Zk0Pd1epx9whpFWI9k7Pqsf8CmYfMXuOseI0WwZ0cGfV+nx9knrFGE9UjGrs960/wO/C/IdBZ8T6bmh+AfP9NZ8D2ZmqZpmqZpmqZpUv4BP+2Kkg3MCPkAAAAASUVORK5CYII=>
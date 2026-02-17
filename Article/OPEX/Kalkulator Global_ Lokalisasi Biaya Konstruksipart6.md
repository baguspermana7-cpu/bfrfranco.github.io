# **Konsep Globalisasi untuk Kalkulator Maintenance Data Center: Kerangka Kerja Pemodelan Biaya Multi-Regional dan Logika Penyesuaian Dinamis**

## **Ringkasan Eksekutif**

Dalam era digital yang terdesentralisasi, infrastruktur data center telah berkembang melampaui batas-batas geografis tradisional, menciptakan ekosistem operasional yang sangat kompleks dan beragam. Tantangan utama yang dihadapi oleh operator global saat ini adalah ketidakmampuan model biaya konvensional—yang sering kali bersifat statis dan "satu ukuran untuk semua"—untuk memprediksi Biaya Operasional (OPEX) pemeliharaan secara akurat di berbagai yurisdiksi. Sebuah fasilitas Tier III di Jakarta, Indonesia, memiliki profil biaya, risiko lingkungan, dan dinamika rantai pasok yang sangat berbeda dibandingkan dengan fasilitas serupa di Virginia Utara, Amerika Serikat, atau Frankfurt, Jerman.

Laporan ini menyajikan cetak biru komprehensif untuk pengembangan **"Global Data Center Maintenance Calculator"** (Kalkulator Pemeliharaan Data Center Global). Konsep ini tidak hanya sekadar alat konversi mata uang, melainkan sebuah mesin simulasi algoritmik yang mengintegrasikan indeks tenaga kerja regional, volatilitas material rantai pasok, kepatuhan regulasi yang ketat, serta faktor lingkungan lokal. Dengan menggunakan data dasar operasional dari fasilitas Tier III di Indonesia sebagai "Baseline Index 1.0" 1 dan membandingkannya dengan skenario CAPEX Tier II/IV di Amerika Serikat 1, laporan ini membangun logika matematis untuk penyesuaian biaya global.

Analisis ini mencakup pengembangan **Indeks Kualitas Pekerjaan (Quality of Work \- QoW)** untuk memitigasi risiko *rework* (pengerjaan ulang) di pasar tenaga kerja yang kurang matang, serta **Logika Penyesuaian Iklim** yang mengorelasikan data polusi udara (PM2.5) dan psikrometri termal dengan degradasi peralatan. Tujuannya adalah memberikan visibilitas total terhadap *Total Cost of Ownership* (TCO) bagi pengambil keputusan strategis.

## ---

**1\. Pendahuluan: Urgensi Globalisasi dalam Pemodelan Biaya**

Pertumbuhan eksponensial data center, yang didorong oleh adopsi kecerdasan buatan (AI) dan komputasi awan, telah memaksa industri untuk berekspansi ke pasar-pasar sekunder dan tersier (Tier 2 & 3 Markets).2 Namun, ekspansi ini membawa serta variabilitas biaya yang ekstrem. Metode penganggaran tradisional yang menggunakan angka "flat rate" per kW sering kali gagal menangkap nuansa lokal, menyebabkan varians anggaran yang signifikan.

Sebagai contoh, biaya konstruksi di Silicon Valley mencapai US![][image1]12,4 per watt.3 Perbedaan ini tidak hanya berhenti pada konstruksi (CAPEX) tetapi berlanjut secara dramatis ke dalam fase operasional (OPEX). Sebuah kalkulator pemeliharaan yang efektif harus mampu menormalisasi variabel-variabel ini melalui sistem pengindeksan yang canggih.

Laporan ini dirancang untuk membedah setiap komponen biaya pemeliharaan—mulai dari gaji teknisi hingga filter generator—dan merekonstruksinya dalam kerangka kerja global yang adaptif.

## ---

**2\. Membangun Basis Referensi: Profil Operasional Indonesia**

Untuk menciptakan indeks global, kita harus terlebih dahulu menetapkan "Titik Nol" atau fasilitas referensi. Berdasarkan data empiris yang tersedia, kita menggunakan profil operasional fasilitas di Indonesia sebagai baseline.1

### **2.1 Analisis Struktur Biaya Baseline**

Fasilitas referensi ini adalah data center berkapasitas 1.000 kW (1 MW) dengan spesifikasi Tier III, menggunakan pendinginan *Water-Cooled Chiller* dan redundansi generator N+1. Total OPEX tahunan tercatat sebesar **US$1.631.765**, atau setara dengan **US$1.632 per kW per tahun**.1

Distribusi biaya baseline ini memberikan wawasan kritikal mengenai alokasi sumber daya di pasar Asia Pasifik (APAC) yang sedang berkembang:

* **Energi (42,3%):** Komponen terbesar, didorong oleh efisiensi pendinginan (PUE 1.50) dan tarif listrik lokal.  
* **Ketenagakerjaan (30,1%):** US$490.879 per tahun untuk 23 FTE (*Full-Time Equivalent*).  
* **Pemeliharaan & Suku Cadang (10,7%):** US$174.350 per tahun. Angka ini secara signifikan berada di bawah target industri global sebesar 15–20% 1, yang mengindikasikan potensi risiko *deferred maintenance* (pemeliharaan yang tertunda) atau ketergantungan pada tenaga kerja murah untuk perbaikan reaktif daripada preventif.  
* **Kepatuhan & Asuransi (6,0%):** US$98.500 per tahun.

Dalam kalkulator global, nilai-nilai ini ditetapkan sebagai **Indeks 1.0**. Semua biaya di wilayah lain (US, EU, LATAM) akan dihitung sebagai pengali (multiplier) terhadap baseline ini.

### **2.2 Rasio Kepadatan Staf (Staffing Density)**

Salah satu metrik kunci dari baseline Indonesia adalah kepadatan staf yang tinggi, yaitu **23,0 FTE per MW** dengan model *Full In-House*.1 Di pasar negara maju, angka ini dianggap tidak efisien. Kalkulator harus mampu membedakan antara "Kepadatan Staf Berbasis Biaya Rendah" (di mana tenaga kerja manusia lebih murah daripada otomatisasi) dan "Kepadatan Staf Berbasis Kebutuhan Teknis" (di mana kompleksitas Tier IV membutuhkan lebih banyak spesialis).

## ---

**3\. Modul Indeks Tenaga Kerja dan Arbitrase Keterampilan Global**

Tenaga kerja merupakan variabel paling dinamis dalam pemeliharaan data center. Biaya seorang *Facility Manager* di Jakarta sangat berbeda dengan di London, tidak hanya dalam hal gaji pokok, tetapi juga dalam struktur tunjangan, pajak, dan produktivitas.

### **3.1 Pengembangan Multiplier Tenaga Kerja Regional (![][image2])**

Untuk mengglobalisasikan biaya tenaga kerja, kalkulator menggunakan algoritma yang membandingkan "Biaya Total Perusahaan" (*Fully Burdened Cost*) untuk peran-peran kunci.

#### **3.1.1 Amerika Utara (US & Canada)**

Pasar AS, khususnya di hub utama seperti Northern Virginia (NoVA) dan Silicon Valley, menghadapi tekanan inflasi upah yang ekstrem akibat kekurangan tenaga kerja terampil (*labor shortage*) dan persaingan dengan perusahaan *hyperscaler*.4

* **Indeks Tenaga Kerja (![][image2]):** **4,5x \- 6,0x** dari Baseline Indonesia.  
* **Faktor Pendorong:** Serikat pekerja (*unions*) yang kuat di sektor kelistrikan dan mekanikal, biaya asuransi kesehatan yang tinggi, dan ekspektasi gaji teknisi yang kompetitif.  
* **Implikasi Kalkulator:** Meskipun biaya per jam sangat tinggi, efisiensi sering kali lebih tinggi karena penggunaan alat bantu canggih dan otomatisasi, menekan jumlah jam kerja yang dibutuhkan.

#### **3.1.2 Eropa (EU \- FLAP-D Markets)**

Wilayah Frankfurt, London, Amsterdam, Paris, dan Dublin (FLAP-D) memiliki karakteristik pasar tenaga kerja yang kaku.

* **Indeks Tenaga Kerja (![][image2]):** **4,0x \- 5,2x** dari Baseline Indonesia.  
* **Faktor Pendorong:** Kontribusi jaminan sosial yang tinggi, aturan jam kerja yang ketat (*Working Time Directive*), dan hari libur/cuti yang lebih banyak dibandingkan APAC atau US.5  
* **Implikasi Kalkulator:** Harus memperhitungkan "Coverage Ratio" yang lebih tinggi. Jika satu posisi 24/7 di Indonesia membutuhkan 4-5 orang, di Eropa mungkin membutuhkan 5-6 orang untuk menutupi cuti dan batas jam kerja tanpa melanggar regulasi.

#### **3.1.3 Asia Pasifik (APAC \- Mature vs. Emerging)**

APAC bukanlah pasar tunggal. Kalkulator harus membedakan antara pasar matang dan berkembang.

* **APAC Maju (Singapura, Tokyo, Sydney):** **3,5x \- 4,5x**. Biaya hidup tinggi dan ketersediaan lahan/tenaga kerja yang terbatas memicu kenaikan biaya.6  
* **APAC Berkembang (Johor, Mumbai, Hanoi):** **0,8x \- 1,1x**. Mirip dengan baseline Indonesia, namun dengan variasi lokal. Mumbai, misalnya, mungkin memiliki biaya tenaga kerja teknis yang sedikit lebih rendah namun dengan *overhead* manajerial yang lebih tinggi.

#### **3.1.4 Amerika Latin (LATAM)**

Pasar seperti Brasil (São Paulo), Chili (Santiago), dan Meksiko (Querétaro) sedang tumbuh pesat.

* **Indeks Tenaga Kerja (![][image2]):** **1,2x \- 1,8x**.  
* **Faktor Pendorong:** Inflasi gaji untuk teknisi bersertifikasi (misalnya ATD, CDCP) karena kelangkaan talenta lokal.6 Biaya keamanan fisik (*physical security*) di wilayah ini sering kali jauh lebih tinggi daripada rata-rata global karena risiko keamanan regional.

### **3.2 Logika Penyesuaian Shift dan Rostering (Pola Kerja 2-2-3)**

Biaya tenaga kerja tidak hanya tentang gaji per jam, tetapi tentang berapa banyak orang yang dibutuhkan untuk menjaga fasilitas tetap berjalan 24/7/365. Kalkulator mengintegrasikan logika penjadwalan *Panama Schedule* atau pola 2-2-3 yang menjadi standar industri untuk meminimalkan kelelahan.7

**Algoritma Kebutuhan FTE:**

Untuk mengisi satu posisi "kursi panas" (24 jam):

1. **Total Jam Operasional:** 8.760 jam/tahun.  
2. **Jam Kerja Standar per FTE:** \~2.080 jam/tahun (40 jam/minggu).  
3. **Rasio Cakupan Dasar:** ![][image3] FTE.  
4. **Faktor Penyusutan (Shrinkage):** Memperhitungkan cuti tahunan, sakit, pelatihan, dan istirahat. Rata-rata industri adalah 30-35%.9  
5. **Kebutuhan Riil:** ![][image4] FTE per posisi.

**Verifikasi Baseline:** Dalam laporan OPEX Indonesia, terdapat **5,0 Maintenance Team Lead (MTL)** dan **5,0 Security Guard**.1 Angka ini mendekati rasio cakupan 24/7 yang ideal, memvalidasi model ini. Namun, di negara dengan hak cuti yang lebih tinggi (seperti Prancis atau Jerman), *Shrinkage Factor* bisa mencapai 40-45%, sehingga membutuhkan 7,0 FTE per posisi. Kalkulator akan secara otomatis menyesuaikan jumlah staf berdasarkan input negara.

## ---

**4\. Modul Material dan Rantai Pasok (Supply Chain)**

Pemeliharaan membutuhkan aliran material yang konstan: filter, oli, kapasitor UPS, refrigeran, dan suku cadang kritis. Di pasar global, "Harga Barang" hanyalah satu komponen kecil dari "Biaya Barang Sampai di Lokasi" (*Landed Cost*).

### **4.1 Indeks Biaya Material Terkirim (![][image5])**

Kalkulator menggunakan indeks yang memperhitungkan logistik, tarif impor, dan risiko ketersediaan.

* **Tier 1 Logistics Hubs (US, EU, Singapura):** ![][image6].  
  * Akses langsung ke gudang distribusi OEM global. Waktu tunggu (*lead time*) pendek, memungkinkan inventaris "Just-in-Time" yang rendah biaya.  
* **Import-Reliant Markets (Indonesia, Brasil, Nigeria):** ![][image7].  
  * **Tarif & Pajak:** Bea masuk untuk peralatan elektronik dan mekanikal presisi bisa sangat tinggi. Di Brasil, fenomena "Custo Brasil" dapat melipatgandakan harga perangkat keras impor.6  
  * **Logistik:** Hambatan bea cukai (*customs clearance*) yang lama dan infrastruktur *last-mile* yang buruk.

**Ilustrasi Kalkulasi:** Jika anggaran *Consumables* (filter, baterai) di baseline Indonesia adalah US$8.000 1, maka di lokasi dengan rantai pasok sulit seperti pedalaman India atau Afrika, kalkulator akan menyesuaikan:

![][image8]

### **4.2 Model Inventaris Suku Cadang (Inventory Holding Logic)**

Risiko rantai pasok memaksa perubahan strategi dari *Just-in-Time* menjadi *Just-in-Case*. Kalkulator menerapkan logika *Economic Order Quantity* (EOQ) yang disesuaikan dengan *Lead Time Risk*.11

* **Fasilitas Baseline:** Menyimpan suku cadang senilai US$41.400 (UPS Modules, Kompresor Chiller, Injektor Genset).1  
* **Logika Penyesuaian:**  
  * Di wilayah dengan **Risiko Rantai Pasok Tinggi** (misal: peraturan impor ketat atau ketidakstabilan geopolitik), kalkulator merekomendasikan peningkatan stok suku cadang kritis sebesar **1,5x hingga 2,0x**.  
  * Ini memitigasi risiko *downtime* yang berkepanjangan akibat tertahannya suku cadang di pelabuhan. Biaya modal (*holding cost*) untuk inventaris tambahan ini dimasukkan ke dalam OPEX tahunan.

## ---

**5\. Modul Infrastruktur Teknis dan Redundansi**

Biaya pemeliharaan tidak linier terhadap kapasitas IT (kW), melainkan eksponensial terhadap kompleksitas topologi fasilitas (Tier Level) dan teknologi pendinginan yang digunakan. Kita menggunakan perbandingan dari laporan CAPEX Scenario A (Tier II) vs Scenario B (Tier IV) untuk membangun logika ini.1

### **5.1 Multiplier Redundansi (![][image9])**

Semakin tinggi tingkat Tier, semakin banyak komponen yang harus dirawat.

* **Tier II (N+1):** Memiliki satu jalur distribusi utama dengan beberapa komponen redundan. Beban pemeliharaan adalah standar.  
* **Tier IV (2N+1):** Memiliki dua jalur distribusi aktif yang sepenuhnya independen.  
  * **Dampak Biaya:** Laporan CAPEX menunjukkan biaya sistem elektrikal meningkat **90,6%** dan sistem UPS meningkat **118,4%** saat beralih dari Tier II ke Tier IV.1  
  * **Implikasi Pemeliharaan:** Ini berarti ada dua kali lipat jumlah *switchgear*, dua kali lipat jumlah *string* baterai UPS, dan dua kali lipat jumlah genset yang harus diuji dan dirawat. Selain itu, prosedur pemeliharaan menjadi lebih kompleks (misalnya, melakukan *switching* beban tanpa memutus layanan).

**Rumus Kalkulator:**

**![][image10]**  
Di mana:

* ![][image9] (Tier II) \= 1,0  
* ![][image9] (Tier III) \= 1,4  
* ![][image9] (Tier IV) \= 2,2 (Mencerminkan peningkatan volume aset \>100% dan kompleksitas prosedur).

### **5.2 Dampak Teknologi Pendinginan (Air vs. Liquid)**

Pergeseran dari pendinginan udara (*Raised Floor/CRAC*) ke pendinginan cair (*Direct Liquid Cooling \- DLC*) mengubah struktur biaya pemeliharaan secara fundamental.1

* **Skenario A (Air Cooled \- CRAC):**  
  * **Fokus Pemeliharaan:** Penggantian filter udara (biaya material rendah, frekuensi tinggi), inspeksi *belt* kipas, pembersihan *humidifier*.  
  * **Keahlian:** Teknisi HVAC umum.  
* **Skenario B (Liquid Cooled \- DLC):**  
  * **Fokus Pemeliharaan:** Analisis kimia fluida (*fluid chemistry*), deteksi kebocoran loop sekunder, inspeksi *Quick Disconnects* (QD), manajemen tekanan *manifold*.  
  * **Keahlian:** Teknisi spesialis hidrolik/fluida (Biaya tenaga kerja lebih tinggi).  
  * **Efisiensi:** Mengurangi kebutuhan perawatan "White Space" (tidak ada pembersihan lantai angkat), namun meningkatkan biaya layanan spesialis pihak ketiga.

**Logika Kalkulator:**

Jika pengguna memilih "Direct Liquid Cooling", kalkulator akan:

1. Mengurangi anggaran *Consumables* (filter) sebesar 60%.  
2. Menambahkan pos biaya "Analisis Fluida & Layanan Spesialis" yang setara dengan 15-20% dari CAPEX mekanikal tahunan yang diamortisasi.

## ---

**6\. Modul Kepatuhan Regulasi dan Keberlanjutan**

Setiap wilayah memiliki "biaya lantai" (*floor cost*) untuk kepatuhan yang tidak bisa dihindari. Kalkulator mengintegrasikan database regulasi regional.

### **6.1 Matriks Biaya Kepatuhan (Compliance)**

* **Indonesia:**  
  * **SLO (Sertifikat Laik Operasi):** Biaya tahunan sekitar US$6.500.1 Wajib untuk setiap instalasi listrik baru atau perubahan besar.  
  * **AMDAL (Lingkungan):** Pemantauan kuartalan sebesar US$3.500/tahun.  
* **Amerika Serikat:**  
  * **NFPA 70E / OSHA:** Fokus berat pada keselamatan kerja listrik (*Arc Flash studies*). Biaya pelatihan dan APD (*Personal Protective Equipment*) sangat tinggi.  
  * **SOC 2 / FedRAMP:** Audit keamanan data yang mahal dan berulang.  
* **Uni Eropa:**  
  * **GDPR / ISO 27001:** Standar perlindungan data yang ketat.  
  * **Direktif Efisiensi Energi:** Pelaporan wajib mengenai penggunaan air dan energi (WUE/PUE).

### **6.2 Pajak Karbon dan Keberlanjutan**

Baseline Indonesia memperkirakan biaya karbon sebesar US![][image11]5/ton.1 Namun, di pasar global, varians ini sangat ekstrem.

* **EU ETS (Eropa):** Harga karbon dapat melebihi €80-100/ton. Ini mengubah emisi karbon dari sekadar metrik keberlanjutan menjadi kewajiban finansial utama.  
* **Kalkulator Logic:**  
  ![][image12]  
  Kalkulator akan secara otomatis menarik data *Grid Emission Factor* (kgCO2/kWh) dan harga karbon terkini untuk negara yang dipilih.

## ---

**7\. Logika Penyesuaian Kualitas Pekerjaan (Quality of Work \- QoW)**

Ini adalah fitur inovatif dari kalkulator ini. Biaya tenaga kerja yang rendah di pasar berkembang sering kali dikonpensasi oleh risiko kualitas yang lebih tinggi, yang bermanifestasi sebagai *rework* (pengerjaan ulang) atau kegagalan prematur.

### **7.1 Koefisien Rework (![][image13])**

Kami memperkenalkan koefisien untuk menyesuaikan jam kerja efektif berdasarkan tingkat kematangan teknis regional dan ketersediaan program sertifikasi (seperti *Uptime Institute Accredited Tier Specialist* atau *CNIDP*).

* **Pasar Matang (US/EU/Jepang):** ![][image14]. Standar pelatihan tinggi, SOP dipatuhi dengan ketat, budaya "right first time".  
* **Pasar Berkembang:** ![][image15].  
  * **Rasional:** Laporan baseline Indonesia menunjukkan investasi pelatihan hanya 2,3% dari OPEX.1 Investasi rendah ini berkorelasi dengan risiko kesalahan operasional yang lebih tinggi. Kurangnya teknisi bersertifikat senior memaksa rasio supervisi yang lebih tinggi.

### **7.2 Rumus Biaya Tenaga Kerja Efektif**

Kalkulator tidak hanya mengalikan gaji dengan jumlah orang, tetapi menyesuaikan produktivitas:

![][image16]  
Ini berarti, meskipun tarif per jam di Jakarta lebih murah 80% dibanding New York, total biaya penyelesaian tugas mungkin hanya 60% lebih murah karena membutuhkan waktu 1,4x lebih lama atau melibatkan lebih banyak personil untuk pengawasan kualitas.

## ---

**8\. Logika Penyesuaian Iklim (Climate Adaptation Logic)**

Lingkungan fisik adalah pendorong utama degradasi aset. Kalkulator menggunakan data meteorologi dan kualitas udara untuk memodulasi frekuensi pemeliharaan.

### **8.1 Indeks Kualitas Udara (![][image17]) dan PM2.5**

Data center di wilayah dengan polusi udara tinggi (PM2.5 \> 35 ![][image18]) seperti Jakarta, Delhi, atau Beijing menghadapi tantangan operasional yang unik dibandingkan dengan wilayah udara bersih seperti Zurich atau Dublin.12

* **Mekanisme:** Partikel halus menyumbat filter udara HVAC, melapisi *heat sink* server (menyebabkan *overheating*), dan dapat memicu korosi pada sirkuit elektronik jika bercampur dengan kelembapan tinggi.  
* **Logika Kalkulator:**  
  * **Baseline:** Penggantian filter per kuartal (PM2.5 \< 12 ![][image18]).  
  * **Polusi Menengah:** Multiplier 1,5x (Ganti setiap 2 bulan).  
  * **Polusi Berat (PM2.5 \> 35):** Multiplier 2,0x \- 3,0x (Ganti setiap bulan \+ Pembersihan Coil Rutin).  
  * **Implikasi Biaya:** Anggaran "Maintenance Cooling" sebesar US$32.000/tahun di baseline Indonesia kemungkinan besar sudah mencakup faktor polusi tinggi ini.1 Jika dipindahkan ke Swiss, biaya ini bisa turun drastis.

### **8.2 Suhu dan Kelembapan (![][image19])**

* **Iklim Tropis (Panas & Lembap):**  
  * Chiller beroperasi pada beban tinggi sepanjang tahun.  
  * Risiko pertumbuhan biologis (*algae/bacteria*) di *cooling tower* meningkat, membutuhkan dosis bahan kimia (*biocide*) yang lebih agresif dan siklus *blowdown* yang lebih sering, meningkatkan konsumsi air.1  
* **Iklim Dingin (Free Cooling):**  
  * Penggunaan *economizer* udara luar mengurangi jam operasional kompresor chiller, memperpanjang umur aset mekanikal utama.  
  * Namun, ini memperkenalkan pemeliharaan tambahan untuk *damper actuators* dan sistem kontrol kelembapan (*humidification*) di musim dingin.

## ---

**9\. Metodologi Algoritma Kalkulator (The Master Algorithm)**

Untuk menyatukan semua variabel di atas, kalkulator menggunakan pendekatan "Layered Multiplier". Berikut adalah struktur logika matematisnya:

![][image20]

### **9.1 Komponen Biaya**

1. **Biaya Staf (![][image21]):**  
   ![][image22]  
   *(Di mana SER adalah Rasio Efisiensi Staf, yang menyesuaikan jumlah personel berdasarkan tingkat otomatisasi regional)*.  
2. **Biaya Pemeliharaan (![][image23]):**  
   ![][image24]  
   *(Menyesuaikan kompleksitas Tier, biaya material lokal, dan keparahan iklim)*.  
3. **Biaya Energi (![][image25]):**  
   ![][image26]  
   *(PUE dimodelkan secara dinamis berdasarkan data psikrometri lokasi)*.

## ---

**10\. Wawasan Tingkat Lanjut (Second & Third-Order Insights)**

### **10.1 Paradoks "Biaya Rendah"**

Analisis ini mengungkapkan bahwa "biaya tenaga kerja rendah" sering kali merupakan ilusi dalam total TCO. Penghematan gaji di pasar berkembang sering kali tergerus oleh:

1. Kebutuhan jumlah staf yang lebih banyak (![][image27]).  
2. Biaya material yang melambung akibat inefisiensi logistik (![][image28]).  
3. Risiko operasional yang lebih tinggi akibat kualitas pekerjaan (![][image13]).  
   Kalkulator ini akan memvisualisasikan bagaimana penghematan OPEX tenaga kerja dapat dengan cepat dihilangkan oleh biaya risiko rantai pasok.

### **10.2 Trade-off CAPEX vs. OPEX dalam Iklim Ekstrem**

Logika iklim menyoroti sebuah *trade-off* strategis: Berinvestasi lebih besar di awal (CAPEX) untuk sistem filtrasi canggih (misalnya *Pressurization Units* atau filter kimia) di pasar dengan polusi tinggi dapat secara drastis menurunkan OPEX pemeliharaan jangka panjang. Kalkulator dapat mensimulasikan skenario ini: "Apakah lebih murah mengganti filter murah setiap bulan (OPEX tinggi), atau memasang sistem penyaringan industri (CAPEX tinggi, OPEX rendah)?"

### **10.3 Redundansi Tier IV: Biaya Tersembunyi**

Beralih dari Tier II ke Tier IV bukan hanya soal membeli satu genset tambahan. Ini menggandakan seluruh ekosistem pemeliharaan. Kalkulator harus memberikan peringatan dini bahwa **Ketersediaan Tinggi \= Intensitas OPEX Tinggi**. Biaya menjaga 99,995% uptime bukan linier, melainkan eksponensial dibandingkan 99,7%.

## ---

**Kesimpulan**

Konsep globalisasi untuk kalkulator pemeliharaan data center ini menawarkan pergeseran fundamental dari estimasi statis menuju pemodelan dinamis berbasis risiko. Dengan mengintegrasikan indeks ekonomi regional, realitas rantai pasok, kepatuhan regulasi, dan keparahan lingkungan fisik, kerangka kerja ini memberikan peta jalan yang akurat bagi operator global.

Alat ini tidak hanya menghitung biaya; ia mengukur **kesulitan operasional**. Satu dolar yang dianggarkan untuk pemeliharaan di Jakarta kini dipahami memiliki daya beli, profil risiko, dan hasil operasional yang sangat berbeda dibandingkan satu dolar yang dihabiskan di Frankfurt. Implementasi logika ini akan memberdayakan organisasi untuk membuat keputusan lokasi, desain, dan operasional yang jauh lebih cerdas dan tangguh.

## ---

**Lampiran: Tabel Data Terstruktur untuk Input Kalkulator**

### **Tabel A1: Baseline Staf & Biaya (Indonesia Tier III, 1MW)**

1

| Peran (Role) | FTE | Biaya Tahunan (USD) | Catatan |
| :---- | :---- | :---- | :---- |
| Facility/Operations Manager | 1.0 | $58,233 | Kepemimpinan Kritis |
| Maintenance Team Lead (MTL) | 5.0 | $174,700 | Cakupan 24/7 (Shift Lead) |
| Electrical Engineer (HV/ME) | 2.0 | $46,587 | Spesialis Tegangan Tinggi/Menengah |
| HVAC/Mechanical Engineer | 1.0 | $23,293 | Spesialis Mekanikal |
| Electrical Technician (LV) | 2.0 | $23,293 | Teknisi Umum |
| Mechanical/Gen Technician | 2.0 | $23,294 | Teknisi Genset & Mekanikal |
| BMS Operator | 2.0 | $23,293 | Monitoring Ruang Kontrol |
| Security & Cleaning | 8.0 | $54,157 | Layanan Pendukung |
| **TOTAL** | **23.0** | **$426,851** | **Densitas: 23 FTE/MW** |

### **Tabel A2: Baseline Frekuensi Pemeliharaan**

1

| Sistem | Frekuensi Dasar | Basis Biaya (per kW) |
| :---- | :---- | :---- |
| Generator | Bulanan \+ Overhaul 6 & 12 Bulan | $40.95 |
| Cooling System | Preventif Bulanan (PM) | $32.00 |
| Electrical System | Kuartalan | $28.50 |
| Fire System | Semi-Tahunan | $10.00 |
| BMS | Kontinu | $14.00 |
| Building | Kuartalan | $7.50 |

### **Tabel A3: Matriks Indeks Regional (Ilustratif)**

| Wilayah | Indeks Tenaga Kerja (MLabor​) | Indeks Material (MMat​) | Risiko Rantai Pasok | Risiko Regulasi |
| :---- | :---- | :---- | :---- | :---- |
| **Indonesia (Base)** | 1.00 | 1.35 | Tinggi | Menengah |
| **USA (Tier 1\)** | 5.20 | 1.00 | Rendah | Tinggi (Safety/Labor) |
| **Jerman (Tier 1\)** | 4.80 | 1.05 | Rendah | Sangat Tinggi (Carbon/Data) |
| **Brasil (LATAM)** | 1.40 | 1.60 | Sangat Tinggi | Tinggi (Tax/Labor) |
| **India (APAC)** | 0.90 | 1.30 | Menengah | Menengah |

#### **Works cited**

1. OPEX Report — February 17, 2026.pdf  
2. Global Data Center Market Comparison | Cushman & Wakefield, accessed February 17, 2026, [https://www.cushmanwakefield.com/en/insights/global-data-center-market-comparison](https://www.cushmanwakefield.com/en/insights/global-data-center-market-comparison)  
3. Data centre construction cost index 2025 \- Turner & Townsend, accessed February 17, 2026, [https://reports.turnerandtownsend.com/data-centre-construction-cost-index-2025/data-centre-cost-trends](https://reports.turnerandtownsend.com/data-centre-construction-cost-index-2025/data-centre-cost-trends)  
4. The cost of compute: A $7 trillion race to scale data centers \- McKinsey, accessed February 17, 2026, [https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-cost-of-compute-a-7-trillion-dollar-race-to-scale-data-centers](https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-cost-of-compute-a-7-trillion-dollar-race-to-scale-data-centers)  
5. Guide: 8 Vs 12 hour shift patterns | Totalmobile, accessed February 17, 2026, [https://www.totalmobile.com/blog/capabilities/rostering/guide-8-vs-12-hour-shift-patterns/](https://www.totalmobile.com/blog/capabilities/rostering/guide-8-vs-12-hour-shift-patterns/)  
6. Global Data Center Trends 2025 | CBRE, accessed February 17, 2026, [https://www.cbre.com/insights/reports/global-data-center-trends-2025](https://www.cbre.com/insights/reports/global-data-center-trends-2025)  
7. What Is a 2-2-3 Work Schedule? Explanation, Implementation & Template \- Parim, accessed February 17, 2026, [https://www.parim.co/blog/2-2-3-work-schedule](https://www.parim.co/blog/2-2-3-work-schedule)  
8. Guide to the 2-2-3 Shift Schedule \- TimeTrex, accessed February 17, 2026, [https://www.timetrex.com/blog/guide-to-the-2-2-3-shift-schedule](https://www.timetrex.com/blog/guide-to-the-2-2-3-shift-schedule)  
9. What is Call Centre Shrinkage and How to Calculate It?, accessed February 17, 2026, [https://www.callcentrehelper.com/how-to-calculate-contact-centre-shrinkage-90353.htm](https://www.callcentrehelper.com/how-to-calculate-contact-centre-shrinkage-90353.htm)  
10. What is call center shrinkage? | Freshdesk Contact Center Blog \- Freshworks, accessed February 17, 2026, [https://www.freshworks.com/explore-cx/call-center-shrinkage/](https://www.freshworks.com/explore-cx/call-center-shrinkage/)  
11. Economic Order Quantity (EOQ): The Complete Guide to Optimal Inventory Ordering, accessed February 17, 2026, [https://bizowie.com/economic-order-quantity-eoq-the-complete-guide-to-optimal-inventory-ordering](https://bizowie.com/economic-order-quantity-eoq-the-complete-guide-to-optimal-inventory-ordering)  
12. Quality Assurance Guidance 2.12 \- Monitoring PM2.5 In Ambient Air Using Designated Reference or Class I Equivalent Methods \- EPA, accessed February 17, 2026, [https://www.epa.gov/sites/default/files/2021-03/documents/p100oi8x.pdf](https://www.epa.gov/sites/default/files/2021-03/documents/p100oi8x.pdf)  
13. PM2.5 Data Discrepancies Explained – Part 1 of 5 \- Air Quality Portal, accessed February 17, 2026, [https://airquality.climate.ncsu.edu/2024/03/08/air-quality-data-sources-for-pm2-5-part-1-of-5/](https://airquality.climate.ncsu.edu/2024/03/08/air-quality-data-sources-for-pm2-5-part-1-of-5/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAQCAYAAACr6iO2AAAE7UlEQVR4Xu2W0YrjSgxE9/9/+l78ICgOVd1y4iT2oANNS6WSLHuysP/+DcMwDMMwDMMwDMMwDMMwDMMwDMMw3I3/KFzBMTQNrlqqkzPeO/CkXZVv761/16f9ja+g+87J53SnXcknZ9+Zq77rO3Pe6f0lV+zdneE87GV+F7hT2rN0PTu6vkTqT/qT6bxTx6Mkf/o7rjTGb6NDSVog8ZEFP8xT9iTf3vvbz7sj3W9wte9VPj3/zlz17q/OebXvDnxr985zOp5f0NnLeZzm6PoS7/Y/he57dn0HK6+rOY10PKfYDdzVlTPeX/OkXZVv7V3P+dbz7kznG5z5Xme8r/CpuXfnqu/6ypxXeu7Gt3bvPKfj+QW7vY668ySddDyJv/Ab3HH2Hbu+g9XsVzXmb5MG1g8s1Yl6tTfNYS0d9RYprjz1u9Mh+TkrHXoVet1xPsXVqLEv6VWr28War2a4mtOoV42aqxWMnZdHSTX6DpyXMTWFOudxFv0F/TyKq1Hr9LlDWE+HXoWa87OXsUJ/OuqtuHDe0utWXTXWnEY9+UvvaJ05pSsr30pX6DvbW3eqJ213CurpOK9qCvOCXs4qjbjnJrgbNcXNpZdx8vMULld2fU6vuzOLngPnY61ipytJS/5L2A3e1RW+LF96FXfvMzFzF3fo7sC7YuZnYze32Hl5u5i5xm5mQW+KmevtYnp2d1djzenMuzXGq9lO07ti5gprbkax8+7qXb1yjV/t22msdeZpnO4UO83FzDVmrvfZmBp13i5mnnCzNOddOL3r0f3Yc6D1yhnz7mq8i1VPwbyg7vqTJ+WEs9wzmJfPeZNG3dVTLcXJr3lBnbGbxdzNYO5iJekHnHcZu6FnHkyvi8tDb+G0AzerGzNnbQf3PfMOrHdmpH76Ds7Ui9TDXdi7yjtx5avn0H/gtAPXl7wHzs+YOWO3f9V2scuVM33JS9/Bq/WzMfNXa0XXX3HS9JCdxn5X01zZ1bQ/PaNqZDX7YKexzlzRHZVOzvehp3Ce5D3Qufoc18PZPMRpB06nxvzAPcc933lWOUmz2He25jRlVU+1q2LmKWa+qjFn7aCjMb8EN5TLOo9SdfWyhzOV1FOkXsbMeTtth5vJWPOka8y70B1Vq5t99Ls6WfXsatQU531X15tQrzlO17vYPb/iVV1z5+HtYudhTk/ayc1befUuUl9Bjf70rNSnsdM0dz7NU3/Hr7heemuf5E21blw556iuubuVVQ+fQ1/SFXqSd1Xn/YrG/F1doYc344Ka8x93Hc0L5g760+18jCtPft5Fek5pdaeZr+id2sqnt9O0VnQ05m+hL+ReZqWTlZf6qkafwh72HrDG2ZXv6spuntMV1tTvZrh+5y84gzUH/ezhUb1wnlTjDPZQZy2R/ElXtJ56tMZ8pVNTUr3jSxrndL1VUzqzFFfnKV1JPQrnrGbxKKlGX5G8Hb1Tc9pZnRr9DvrZ4/Kk8RnUknelaa5xepbzXaEn6GdvkWYXqZ7ypJOul3OdP2muprg6Nepap5ZmrXTOKuhhTWM3hzrpeL5Od5Gu7048cedfcadvdeUuV84ahr/KU/6dPGXPs3z6va6ef/W8oUHno9/yf5kNnrTrr7nD3/eqHZ76e/00810G5Wm/h6fte4ZPvc/V3+vqecMwDMMwDMMwDMMwDMMwDMMwDMMwDMPf4n94Nw1IFXSdPAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAVCAYAAAAAY20CAAAApklEQVR4Xu2PCwqAMAxDvf+llYqDGNMRcf7GHhTWNO3aaRoMBl0yQ9RAn9vzCO5CjucVujhAvRH3yFeoHYALf3L54LcHqIVUfucBl2aqZsxVjbWg6BguZ/07VHMXB5zRg0xHMk9tbnDQsUE1cwP72B8oDXHmO+81x2RX2Mg+4ECUhjjznTf3NkMNzz51jsn0puBnKhwPR4F1rjeBh3M4Ho4C61z/LwsUbs8xK1CpgwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKIAAAAXCAYAAACI9ZTdAAACB0lEQVR4Xu2UgW4cMQgF7/9/upWrEpFXBrAv1e7dMZKl7GOMsRPl8RiGYRiGYfjv/NJgGK5g/hBfnPUL1NVB91T7f8ohyH+2Z7W34yzUy9y78Mycete0DxUp95CjeTSEDhc5C8o95ES5nkuQczqzfhuU34HuW0XonrIXFSj3kKN5NIAOFjkLyj3kRLmeS5BzOrN+G5Tfge5bReieshcVKPeoQwdR7iGHcg85UW6Z5go5Pu84Poug/Eo6d6zQPdZH8294qZSBbI/2js6IsgXlRlaLoPMVcqI8u5exm1+Jv0d2px2q9/mDPmQqA9ke7R2dEWULyo2sFkHnK+REeXYvYze/En+P7E47VO/zrVDKCdke6unPqxwiq0V0/O480c+6h3KDco/v0VnPoPt/ouei7ENFyonMpyF83nEispphPTquQf7pzPptUO7x83fWCdojWrts7SWJciLzaRifd5yIrGZsPchfyD+dWb8Nyj1+/s46QXtEa5etvSRRrnQOo7rPO46Hcg85lHvIOZ1Zvw3K70J0lw60h/Kvg3QpVKPco70jX2uR46nqC+2lSx2PuqeOoU7mXo3OGM1KuaF7K/8fiWSqUe7R3pGvtcjxVPWF9tKljkfdU8dQJ3OvRmeMZqXc0L2V/5K81WVenI/+XXz05W/C2/13O+HjH+AGzB/iYx5gGIZheDt+A53HLe/inVGCAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGoAAAAbCAYAAACUXxrzAAABlUlEQVR4Xu2Ua07EMAyE9x+n4JScgzPDrlBW1jATO27SbsCfFKl2x4/YVW+3+Xyhg/DQtFNcRGT4tagLiQyeLciLKSZyZPCj+lcDP7wM7ANeQi3qGMsXxZKjrWCxu8AGm7kL5mi+6diGWfOKoxe8GnZPtCPMyuOCC2KFGbWoH2blGUItyvqsRul3APvP3oHFon0arJkzwYH2+lF+i8qBtkcvD/Mv55KiBntxbwjKb1E50Pbo5WH+J++LTiuK/hnn7eajLm0HojQKpkfbQ9VV/icf9/O52YksagVskGhHSOWpRcVJDZgwK8+fwP5K7GEoP8JyMBt9CNOg7eJdKkJkOA9Qh9reOw8VgzmZRoFxLJ75EIyPxPwiHWiINoA61PbeeagYzMk0Coxj8cyHYHwkRpIJZAXRtli9em6g/eqc1m+m0OiAmx41yrcDrPelZIqxJtG21KImgMXsUNmxGgvaill5rob1vpRMMdYk2o2mZcsZyfPvyQxmZMC1qIPYAbKBRVDx+MyOpfeuWEgNexNqUZtQixrkG0LlkQYYwtPkAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAVCAYAAADb2McgAAAApUlEQVR4Xu2PUQqAMAxDvf+llX0UQkzWyjZR2INBFx9dPI7NZjPMKU4PdjN/KpVHK85SKgUqzlJ6BTB3zlIqBfAHnLOU35XELJtfxZV0uUP5DbfrEWqBW8x3RPkNt+sRagHfA5c3XBmVNVIfBSfirA7CPs6ZH3fObg+y4B6q+jhnftw5m06vmCrAPqL8IbhQZDjzd87ZUf4Q/EBkOPN3ztlR/je5APyyp1mvsSTqAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAAAYCAYAAADnNePtAAABR0lEQVR4Xu2SgQrDMAhE+/8/vZGBw93u1LVlaYoPAlXvjGbbtqZpmqZpGuBBTgRqM/0dOGvX3X0qxormTvhdj+zNvBiHVB6+orkTS/w4Zw35D6I9jKimyHpGMC/GlMrD+4WVZjZsLjUvxhVYnwqHZvBG1mTgL1Ca2bC51LwYV2B9KhyaITOq76vB9vCoR6qy16vuVfkPmEAZMfYoj5HVkarO8P2ze6KaIusZwbwYU5RR5RXKY2R1pKozfP/snqimyHpGMC/GlF+MKj9Qj6LyBua9PvIhTIt9mKbK2V6M3+CwKPQx6ph+wGrq22LLoc9ys8Gd2ZyGyg/QH/X5EqHQx6hj+gGrqW+LLYc+y80Gd2ZzGio/QH/U53T8Repy1Hgy/SqwPaaB/wQbDHM4NOazswKXmxMf0QbEHD4y5rOzAqvM2TRN0zQvnkckQswZeQzlAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALIAAAAYCAYAAABeDafgAAACAklEQVR4Xu2TUY6EMAxD9/6X3lU/iixjh0A7FGbzpEqD4wSnYn5+iqIoiqIoiqIoin/DL5wI9GV7voFZu/K98TyuKc/dzMjB+xzNzHgk2caM55vAXUf35l51l0pbCWe7iutl3e3u9B14gVFDxvNN4K6je3OvukulrYSzXcX1su52d/qOTGC8ZOdZSSbbUT1ipFeh5vHzkxjJxr1q98ZZfQeauAGHpAfeDGfqOZ1+hZHeDuZS87imPKuYlSOa4/Z1+g40cQMOSQ+8Gc7kPgKlZRnp7WAuNY9ryrOKWTmiOW5fp28og3rumvI/gShTzxx5MsyYgWTmncmO3sw5y5UehZsTZXP6hjLgs6qx1ohCNI7qTNbXwfnRu5yeYaRXoXLyfOVZxawM0Ry3q9M3lCFzsczRhR/Vmayvg/Ojdzk9w0ivQuXk+cqzilkZojluV6dvKIO7PKc3XM3pCNbRf9SHOB/POjOTGeltcK/Kk/GsYjRDZhdXlzoOVMO5gX3sbyjd/Uacx/nvhnfmw54I7lU9XFOeO+EcLpPTkbOeQz+b2MyN7GN/Q+nuN+I8zn83vDMf9kRwr+rhmvLcCedwmZyOnPVk/FPBF7mXq2elqd9v4Y2ZZ/PKO+B/TV+CNffRZs/TeUvOT/LqO+APri/CmlqSa9F5Om/J+UnqDoqiKIqiKIpiMX/4YwUYx0GfYQAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAADH0lEQVR4Xu3Vi2rdOBQF0P7/T8/gAYG62Ud2Eoc2w1pgrPOQrKhF99cvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+M8/meCRN8/tzbW+00/ZJwAvuC799uwy5nfT2WW83PVPc+60uS23TPk33H33VP+MXCvjJntWnPk37X/7/p2Ml9Z7yk+e9E49H80D8A3apdtynLXzylzGl5Xb33n+03jXerK39eT4Lac9ZO6r2notl049p9pXPVn71LOf7ZPzzH/r1p+5jJf927uMAXhZu2jzgt89ufCzPs35P2l/X+ZO57BqrX6qLe38s7/15HiX+YxPTnvI3FdMa0353drL1Dvlv+rJunf7OtVPpnmZy3hZ+axnDMDL9ss/L/O8hLP25PLOcfb+bfIs2rmkqT7lpjWn/GXKX7I2rbPirGXfbp/zEW3eR9d4Ylpzyu/u9tZyl3V+7bnztO9yWnvK32n9bZ0Vt/ypH4Bv0i7alrvs+annMvXlONdoud2pllpvy71hWnfKL62+ziDPaq81U/+u9eS4uauntva0RvubWm7JfMbLlJ+0b2b8hs+u2eatPbdac+rLWsbLymc9YwBeNF32e26/oFu+xU/mZG3lTu7qd57MX/tqz6TVMpfxJc+jvU/jXevJ3taT4+auntra0xpXPmsZ77KW8TLld7nPnJPxsnrbc6f1ZC7jS+61vU/uerKe8TJ9M2MAXtQu2fzhWXHLT+82XvE+PsWZW+OMs5brZN93aOtmLuNL7rO9p3Gu99meHKdprZNcO+Ndq7c4n73eZD7jS66TPRm/oa2ZuYwvudf2nmS9zZt6UpvbYgBecl2w7Ul5qeezO+VyTo7395NcPrs2t8Vvyb2072Q9e57WMpfxlHuyZspaxql9b9pP5ta4vafcFOez53etb9dyX5XfbN/IevZMtaf5VWvjnJu1lst+AH6AJ5d3/kjsuaXlW26K84cke/5WP2Wfb7j7f9DG7Xxarnnad/lI75/yE/YIwF/Gjwd/0t3/v7v67iO9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA4F+t6ljE7fqugwAAAABJRU5ErkJggg==>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAAAYCAYAAACcESEhAAABFUlEQVR4Xu2RSQ7DMAwD8/9Pt/BBhTCgl7Ry3AMHMKCFkh3muowxxhhzjFc6I7JudcZMWDVzRWNuYvMPks3sGbv6g8xNRuZns238Bmz+AZSZKn/K/NhfeceOnSWoR+Vc9Vhr5A9U5y7fzMzYsfMnlDk2/yGUOT3TevWGqjMPRvW8R+3MZH1PN+qr+srOhuozl/ACLuIS6qhvsMd+I9dnMfeomHcoDeMg5+o+9ljLsZrlzAcOzAapo77BHvuNXJ/F3KNi3qE0jIOcq/vYYy3HapYzW+HlUbsTRx61Xhz09ihd9R7FaLaceEw+vXrlCRhXnYA16pRexVvgI2aPrDoB46oTsEad0qvYbET9IPMwNv0gNv+feQMpM3eXlBumjAAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAACC0lEQVR4Xu3W0W7kIAwF0Pn/n97VPFiyrgxJO6NO05wjRWBjAuSFPB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHB9/4YnTbm7yG8zfYsp95eszv20+y4AwJtMl23Gd5bfJ+M7qPNO555yAMCb7S7c1c9J5qe4y/hKcu95zt14ybrsT3N+ypm1qyZrP713ALiNunT7U/neltXPRuaz/8nLPc/XnyOr+n6uKZfjq7qeO7OfV+WaZ3xyvwDA4/jSzfGMS17m2c9504Wf8WRVs8q/Kt+7i1dnfTqqyzn1fabv9KqvvHPaY7blK3s+U5O+MwcALu/oAszxjEvmq9/zOS/nvGr3rlprenammh7n+Xq/y/dM609zpv475No70z6yLUdxtxtb+c4cALi86QI8uqBzTuZ6nP1sc15X41mfT469U74v11itv2qrn/WVz3aqWeV6v4+nnHsk6zPuci+rfD4l89Oco3iXrxwAXEJeZHmplV0ux6Zc5qf66ndZN/UzzrFX5J5z7yXzu/opn/U5NrVTf3rOWtVO71ut23O9rf6Z2myrn3G3GpvmTe8HgNs6cyH2y3O6SHf9qX6Kf6sz+8wzr3LdlPtJub+jfef4UZv9jLN+VZt5ALiN5yXoIlzzfT5r+rEDAOCX8dMMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwzn+0CZJ8FlNu3QAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXMAAAAYCAYAAAAI/h2/AAAETUlEQVR4Xu2WAapbMQwEe/9LtxgqWIZdW04C+a/VgMBejWwnbUN//RqGYRiGYRiGYRiGYRiGt/n9t4ZhGH4K87v0AvOlDcPw0/jI71IdopXoeo7OXMdZ8B0nX3E+96/yyns+xTfvXnz7/ld44pt/Oqfv9NR/AvoZ0udhj/2F67msBQfSQbuMOVEn+R2nYK/7jkVyUn7Lp855h2+94Vv3vsMT3/x0/qXvfPdZTr9Jp96ub+FAHZJylzEn6iS/4xTsdd+xSE7Kb/nUOe/wrTd86953eOKbn86/9J3vPsvpN+nU2/Vb3BzS9ZTO+R1HufGTl/Jb9JxPndlFv4eb7+Qdvvl5P8ET3/x0nv53Rtm9//RvsPrOSfkRPfR0SNdLdOZunO5bnMN55yzYT96CfefS0VzXpyKuR49n3JSiWXIKnpNc9rtOtxyaJ5+59pm5ctBJLvt0drmuT5U8wj6dlCt0ks976DF3pbDnnAX7zku5cuoveMfJP8LDdgd2vURn7sbpvsU5nHfOgv3kLdh3Lh3NdX0q4nr0eMZNKZolp+A5yWW/63TLoXnymWufmSsHneSyT2eX6/pUySPs00m5Qif5vIcec1cKe85ZsO+8lCun/oJ3nPwrbg7sekrn/I6jdPzkpLxgr/zbfLcudJ/WtU/zLnPr2rv3pHXh9slLGfPFO/emWXfOgnPOd7Of9As6SppN60L3aV37NM9ske5Na+XmLren11nXntnC5W6fPGak4yjprpe5OfDGLTp+x1E670j9lBfsJf8TOfcFcze7cHllrhKpn2ZdtnA59wrfR9ftmS1SrqiTfJdzr3T8jqOUr0Vczn3B3M0uTvntexY3udszU04913e52zNbpLw49U79j1AXdQ68cYuO33GUzjtSP+UFe8n/RM59wdzNLlxematE6qdZly1czr3C99F1e2aLlCvqJN/l3Csdv+Mo5WsRl3NfMHezi1N++57FTe72zJRTz/Vd7vbMFikvTr1T/yU4WBel3GXMd3T8k8Pe6R0pX+icW3PWOVwXuk9rhXe6MxfJcX73XrcmfB9zXe/c07r27kyl4yScy/d0HLdW6Lxz5mlW4V1uduHy9Abnucyta+8yXWspmqV1wjlunzx3l3OVU+/Ufwn9EOkDLdh3Xid31XUK9pyjnHoshb2T57JOj6UOoefybt85Jzi/O2tXCns3jnqcSXBOs8p5B0vhvqDPM1gKe85ZsM9Sh7jczbuc/UXKFy5PZzF3zsJlhPO7GTrJZ4+1gy7rZXhQOpB953VyV12nYM85yqnHUtg7eS7r9FjqEHou7/adc4Lzu7N2pbB346jHmQTnNKucd7AU7gv6PIOlsOecBfssdYjL3bzL2V+kfOHydBZz5yxcRji/m6GTfPZYO+iyBsN8OcMwOOZ34WHMj/kw/N/wf73zm/BQ5g9uGP5v+CM+vwkPZf7ghmEYhmEYhmEYhmEYhmEYhhN/AJaf22ueSG7ZAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAAD9klEQVR4Xu3V7W7cIBBG4d7/TbfiB+rk5B2wN/Z+KOeRkGFmwJhN6Z8/kiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiTpDfxlQJL0u4z/CNgoxfQfz4/tCleudSV+K9vO0bqzuA+2Rxydd7TujDvWHNKZXHFWj+B757s5fsRP5krS2+Blli5vfcUzqn2OV3b56kzts6W9pRitala5o9IaKbbD37VztO4Rz1w3xZ6F7+ZYkn6l9B8Mx/punhHPajemXb46U/tM6W9oSDFa1axyR/xkX+/ojn2nM0qxZ+G7X7UPSXo7qwuRl2cXG2qcF26q/2Sr71nlhnkebMwnXfwqaf0UI+6fjn7T7KdzqXGOGZ8YS2O+k/00rpjr6q7SrZ/iKUapJsUGfmuNpdywiidHzzKtu9rLLp7GzEnSS/GSq5dVfaY+a7rn7L/b5cfvrm1lle9y3bo8o9rn+BkeeefRs0t5zk3vT/GaY2zq1p25+ez66Vkxl95ztdX6Nbeqq+ae2Yhr17ru+3d91tdYyk1c68xeVvmUY50kvczuMuKllvpTuhSnrp6X41Fnaq/WvXt1uac4Y6vzYi6N6zmyz/VWHqlPfWJu9Z7Vmqtc1dWd7afxkPafxmxHdLUpVnXzOql2F2Oe44GxNJ81Q6qjVQ3HE9/Jum5N9mfr7PLDLi9J3+wul5pnLeel2lX9sMuvnK1P6j7ZVrr8Kp5y/H6Oq1Vu6PKzn+Z0uJeVXW3aC8dpjUdzU5djrNsf+5w3Mdf1pxRLurouPnE/O6xN8xljn/UDY3Nc61PNbm3G2Gf9xPezjuvs+p2raiTpi3RxpAsqXXI1x+eR+tlnXRdnbDVmu1q3Zhcf+C18cq8p181jrHvW9TtpDyu7mrQenymWcrOfaqjLca2K63bPVb+OGa/md9TGeNLFh9WejkrzuJ+uX3U1/Nb0rBjr9sI48R1cI8U5Zm6Yczmfsd06khTVS4atYoy1V9TXZ9fnXPa5DvNX45r1+7jXKeW68a6WuRnjs5vfSfkUG7jPrm7o6tjvxmnujCd839H53fu6uV28Pqc67uaxJjkTT7GJ+6/jNI/5Oi9JtV2Oravr4jNXa2i1RpXG3fpcbz67OGOS9FJHLyPW7S62VZ9z+bzDnWvv1G/uYru87pXO+szvw/yQYp/gU/dd8Ru632sVr09JepkzF9G81NIlV3OMTynHfIpf6a51j+K3cT8pxzm6V/075bmncWoVx++q7v1T9ryTfpc0rvHaZ5Okl/Eiku7zaf+2vA8kSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSW/rH6qLZsQBgpXsAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAYCAYAAABJA/VsAAAAxElEQVR4Xu2UUQrEMAgFc/9L77KwBTs8zSuhHwkOBFIdTSylYzRN0xzKx1jH4AzkOFvhDOQ42+B+uo6zDccM8oQe+hCmM02FkTvxf+D+G97EPt+RMofD2oe+hH1+Jc2aMKf87GWo2A8VV8+Zd8VU/kZskjVUVH51AdY82XNFmGP+BsVpwZ/KjzHmWfNkzxVhjvklVEP1rLyLmFN71imHZLXLxMaxOWP0eBHm6FRxBR3WLVFdJsbo8QLM0aniCjqsa5rmML4oAdAw5fGaXgAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH8AAAAYCAYAAADTTCLxAAABdElEQVR4Xu2S0a7DIAxD+/8/fa/6kM0yMTjrpI4tR4oExoYs3XE0TdM0TdM0P8mfUY3Pu+bm3MPfaeV/4BgdT/MEZ3VlbpxV36H0wREn5HiaJ1t8fDfkeL4BZx6zs4yqH+Gs6k3pU8qBLyUbnvoj8H5F1X8ye5u1E/Qrz4Bl+gGygalB8n5F1X8ye5u1E/Qrz4Bl2gj7hxOrXGmoxKuZ7D2lZyw9S8OhPdgI1x1ceZf7n901O8uo+hHOqt4ynfcDS8OhPTwsrDu48i73P7trdpZR9SOcVb1lOu8HZobsQoTPlD/TeR+wrrJYqGdrB74LNa4qr2QCzqoeMp33KfzjsosyHD/qyu+unWxWd8A9qF6UHnBe+flc+QY44AYdP+rK766dbFZ3wD2oXpQecF75+Vz53gZfjg+qdYB7Xlf8iMruwBY944D5gzgVsO5UgOvYh8YZ9n4aO/T4QA2WdVUB604FuI59aJxh76exQ49N0zRN02zIP816e5MqJskWAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAL8AAAAYCAYAAACr8yxQAAACCklEQVR4Xu2SgaqFMAxD7///9Hso7N4QktnqnIo9UJhpu6Wbn09RFEVRFEVRFEVRvIi/YBQxRt4ZvwHvyTlVM5szfGztl54/UryVL37gXY24N+5X76W0K2FvI+jNmNW/9DZtbOWLH3hXI+6N+9V7Ke1K2NsIejNm9ZXehkik5ulE7mIrz2TrFdyvfHLNnTjqDWfluRtZfcUmXgbfg/rBUI+SrY+gvKGm8ldy1AfO4ubK6is28TL4HtwPpLQe2foIyhtqKn8lR33gLG6urL5iEw+lO2yHXs+Rn2lvX4/InhnPWBuJLHt6GtyrPPS8OX3FJgBXw5fSMzGDI+eyfzeH0x3ZekfP0wLrW/Uz2eOB30EForQFp6/YBOBq2IwzNosj57J/N4fTHdl6R8/TAutb9TPZ44HfQQWitAWnr9gE4GpYdwcpnb8brLteDNTVOoKr57P4zC2y9QrX35t3j9ezGOnBzZTVv+BFqXBE6lB39dF1pFfFbPh8DsTpCPerHtY5Pxv24Tw5HeF+Vc85VSPhBg5HpA51Vx9dR3pVzIbP50CcjnC/6mGd87NhH86T0xHuV/WcUzVD4c3xQLdu4DevM/WI6707T/Q8mkfMjz8Y/5CRaLAeiQau23fTuIdr78bd/Z3NE97oi/uxWHfRYD0SDVy376ZxD9fejbv7O5snvFFRFEVRFEVRFA/iH+yUNuYxAwoZAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAADaElEQVR4Xu3Wi27cMAxE0fz/T7dQAQLMdEjJieT1JvcARiySph4uvP34AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA81B8N4GVOvIsTPXEW7wzAY4wPkrsyHeOMfM76Pqp3c5V7fkffE7p17TqPyom+rufOd/tTuDN51dm8al4A+I/7oXAxnJXPuzv7LvcVu/vtVP1Y3/Xvc+ccXa+79vOuXn02r54fAP5xH6P8Q1nlc9yNMx3js6+ejzv3fGUa62rvsDJn1GjtnWuu5nFxFxuqeHB5t8ccq+6fRtel46zKVfE7PWENAH65+NjnK+vG+qOR43rvev9Uep7V2YYq3tEz1vdQxZSLnaDrXeHWvfrsLt18q+vqcoPmXd/8190/me6hMsu/0pPXBuCXcB8i94PhxlfuXZ/ZD06Xc3JP19vFgltzlvfh8t/R9aty1Xqr+kFzbi8Rc7nvutLT7al6dmW9Xa4ze24273A17/buxprL8plEXVdfWdnfipUeqzW71hRW+s3yAHBU9aHKH/icd+PVuM6jY2elJtP62bjS1XW5EPt2l1PFB5fTXnGv8czldDy4vru4NVTcOqpnq3i2UuPMnlvZU5fX590463JB47Pz63zlGWelj6vR2Mr+r1rps1IDAMe4j9CI6Qc+/9UPZhVz9+5vVvXSfnoFFwsad7Wub3W/U9fT5XQdeX0VV+Pqdf+zWL53/YI+O6P1Os50PLhnujVrfXCxoP0rLpfnzXQdusasquvGenW5rkcez+T6jstrTNegsWp9Vc7FnCoOAEfpx0o/XKGLac7FNK71WYz1b9x34+CeDe753EfzmavZyfV1a8w0X9UFl9fxoHvNNXrvrlVVretXzZtjWTd2z2p9VuVc3MUGF3f7CDmna800p/lBa7Iq5+41Vs2ntEbHKvd2tRrT+vycjmexziwPAG9n5cOmNfqRzX/jvhtHbHWsuaHLx3wa3+lk74rO6c7AxTIXu5PO796T7kHHlS531c5eM9X+dA0uV9Ws1J62uoaci8vlcsz1CV0OAN7K7IP3BDvWt6NH53T/cNc87+zEGZ3oibN4ZwBwk13/mdzRAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvKe/yetyqrG4/Y0AAAAASUVORK5CYII=>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAZCAYAAADJ9/UkAAAAdElEQVR4Xu2TQQqAMAwE8/9PK4KUsKRNVzTrIQOCDWOngpo1jZBjcpVSHvR0XIIkznzhmUf/MYyceY/jO8xcdj5IBcvfiJ0PUsFejuNmoXTj55GHa0/kb+EfXB0SDxfd08jiGMI4bhy55awO+DnS+IUs/G9OCXBslOmXa6QAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAYCAYAAABA6FUWAAAA5klEQVR4Xu2SSQrDQAwE8/9PJ/ggEJXukWwsk8UFOky3VuPH4+areCJ+ko87cnqJ6f4tppeY7t9iYomP+VUnllDHnT1jF1zmDP7uSHXwGy5B6WyqcjL0WKcicPohXBOlc7DKydBjnYrA6YdQTdSb2obTA3o5X9W6o/jeTaepytlwelB59PkOnN6mM0zlbDg9qDz6fAdOL1FDgqxHHnP5zqj8jPOo5z5VT0lefhWrXEfHV1DnPPolLHaxynV0fAV1zqNfcqgo4Wqdfjl7vgy/ZFW38i6ls2zA46q6lXcpk4tM9r65+UVewhLWKpPE0TsAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAYCAYAAABurXSEAAAAmUlEQVR4Xu2TUQrAMAhDe/9Lb2xQCFnU9mdV8IHQxuiywcZomiYdV1CpKRMUKRu6HB36L0qFVj8galYdRQXhgKqOokKo+9SU/0Hp1otGPu6/sME0DltHOJC1EzX2sf6BzaZx2DqCHm+nCsdeNbeNtyB6GN5VT82qPUvMQS6G++zzzlFtwwusRdxnn3eOKjXpAyrKfF2kZOglbvP7qFg5c55TAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAmCAYAAAB5yccGAAADXUlEQVR4Xu3Y247qOBAF0P7/n54RD5asPVWOA00gPWtJEamLbxx1gs7PDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF/inycvAAAu8swPsLP9AAC84Nn/Ncv+jOH/yt8CwKbqgbmTm3+4ZO0hc/lDJ+t3kmc5I8dl/PDK/K/YXTP7PrXf2e76VV+V+5SdvVQ9Ve4u7rx3gEt0D8rMVy/kkatqD6tcVbub7txH5jHd+C7/bjvrVj1V7mo7e9jp+bSjPR7V7+gvngng16x+cGQ+44eRy1rGs9WadzPOcuY82Zvx0OXf7Wjd7rxV7mpHe+j2/m1We7zLGZ7xV88F8LLVAzJr40UxX11tZafnCrnn3f2ns+N2+z7laH9H9U862ttR/Vus9rmq3d1fPhvAS1YPyKxlPJtr3f0cZ3545Odr5J71ytgz5v0e2e1L1Xezkn0ZDznv0RpdPlVzZJy6+iq/ulKVSznHzphX5Xp5zTLu5By74yo5NuPf8q55AW6ve0DmAz7jVNWq3FDN18WZP2M1duyhup6xO26nL3vmeHeP2ZNx56ivqne5Kv+M3XmO+rp6fr+zjK+wWrOrrc7wUOV2vTL2jKvWAbid7gGZ+Yx3HI3JesZDvojGNcdVbeSucGadnd6qpztnxnOui1eO+qp6l8s9zPfVGbKW15Gjnq6+2lvmRv5MnPkjq56uNudXPav95Ry556OevLr8PMesywPw898H6fzQ7PJD1qveo1zW0qhV4/N+xNX9u5xdI/vze8j6LL+L7qw5R8YrO707+51r3d66+6Eav7LTl3vPMd2ac767ZlX/nF856sl15/5ubPZknJ/dnqvckH3Zk/OmLg/Al8gHdfVSyPu5J2vz5zs9u8bZcXmm/FzdV/HKmd5O9W+Tn9V9xtX9ym5fJ8d3e8i+hyr3kOfu+mY7PZ1qbH63Izd/VvfduCr/kHNWPZ0zvQB8UPUimOOsV/fV9S6vzH1mbJ4lz5f10TPL+J1yP6s487Psyfpvy7VyzXmfec31oarnnO/S7S/j/Mx65kZ+fGa9q1VXqnIA8JKzL5ez/c/Kl2HGXCe/+4y/2Z32CgCl3RfZeOl5+QEAXCx/iO1eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwLX+BRBmeqI809SVAAAAAElFTkSuQmCC>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAYCAYAAABTPxXiAAAAvUlEQVR4Xu2SQQ7CMAwE+/9Pg0AUbVc71IRDLJqRcsjYcTZVt22xWFyGW2G1pRKw0jOVSsBKzzSqv0qlZxptg33D5R+hv+IvcxSaRf4JFgTvSQN1n+oV6IOQf4MFwXvSwLaPoINnni6teK2783MHvPH0wAvqJef75BLkD3j4dEGCesn5PrkE+WFoID1oR32lRyE/jIb14O48eFqK73fID+MhNIw7vdy91x/4fod8Gz49KPm2UFjyLaGw5P+HOwsprVNTl18eAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAnCAYAAACylRSjAAADx0lEQVR4Xu3Z247bOgwF0P7/T/cgDwJ4NihfY8cu1gKMkUhdKGeqCdA/fwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7t74kHAICbHPkCtnc8AAAnHPnC9lHnHJkPcIT7Bjgl/7vwTZfK0S9tQ355O/JUmcvnyWa1Zrwb85G5zL9B1v+ts8zmf2PtqyzV9q33coes9Zc1/3Jv4OXyAnnLJVwdrXc2r4vX2KxddfEu9hRZ21r/Y2vsjfLfwZlz5VrDiHW5p1ir/emyztl57vTr/YEX6i6OLvZ0Ry/hbk63VsZm7SHHD13sCbq68oxrY0a/i71FnrnK/jdcseY3jfqyzu5zfqKuxi52tyfUALzI7NLtYk83zvKN2usas/Vm8SHz2b9Kt08XS2vvLnPZH2bxX+nq6WKdpXHd+xqxWbyLdbkrdHt0sTTG5Ni76l6zVMOsxi72C0+pA3iBp1wY+cerPnscnZe21DCLD1vWuErdb8/eSzUv5aoctzT2LmfeRyfXy3PWfv5Ms/gVssYtuvq3zr3CnjrW8r/29PqAB9lyYYw/PvVZk+Oyf6Vv7JW1py17zNYY7fo+19Y64uy6Obc7Q7bX+kfPvGfszJE9Z+PzTFt043KPfD/dnLP2rJu1ZazaWvNafost+3xsHbO19iOW1lzKAfzPlgujXmTdxZaxWf4uZ/faMn9tzCzfvZe9scx3cv6abkwXSzmm62ct9RwZzzPO5s+emVxji9m43Gu0M17VMVXXn50n4zm2m5Nqfm3sR47PfpX9j66u2s989ju51pIun7HcP+NdflZv9mexoYsBTOXFNLtE6qWUsdrO+dm/0pm98h10a+3N59MZ8ZrPdh2ztNZHl+tiVdbZ7d89szFdfPTrz9FeGpex2u5iqYt3saqrqcp8V0+1tM6sv9bOfWd7DF2ui33U9eoeQ+ZGrOpyXWy0c72t1ubUtbuxs9ryGfGaH3Jc1cWGpRzALnkpzWK1nZdQ9q9ydJ+j885Ye29dTZ9YF3+LPF937uyPcXn2nJtrvMVS3d15s931fyFrWPu8Zu1c52pZw1odNZ9z68+qi33M4gC7jUspL7JZP3ND9p/m7vpm7yrj+eSYN8m682xr+YwNmXuLrt7uzLNcjsv+nbKerqa1Z6jtq+X+WdPe/BhT1bmpiwHcKi+i7F/hyB5LFy2/9y9/Jv/y2Vjn8wd+Lr8E3XUx7d1n73juM35vfEYA8A/Z+oe9fhHYOgcAgJPyS9ieBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAK/wHbXvcli3a11AAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAYCAYAAABa1LWYAAAAtUlEQVR4Xu2TCwrDMAxDc/9LrwxWUIWlqp9BAn5gSCxFcaAdo2ma5iafoJYhGTjxTEUycOKZhvTTSjzTsMygV+hHrULyKOVx/6PTHKnfZksBUB43uNMcqd9mS2GcHBx6cNVHWKv8mIOa6h9gkzUD7FVrpPKoHD5feSQcfHrgB3vVGqk8KofPV57XqML5AtXjPecguK807t0GH8GXVoWwpmqH16oeowK5z/oX1lTt8FpV0zR/YAPr48BAqBnSYwAAAABJRU5ErkJggg==>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAAEg0lEQVR4Xu3Wi47zNgxE4X3/l26RFgQGg6EkO5bX2ZwPECyRtG6N9+/PDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD85x8PAF9u1zexa15gFb9BfK3Xj79ajT+N71nP5OcrPsZ70h2X7r/BtxndwdV3dNU8zufVfXdn8DGuN7r/u/gedu1j17zAo/kPf+dHtku3X4/r2T7xnJ8g3WuKfbN0Hyl2hdU5363zuJ/H89jjKfd8xz7uWAN4jPSDT7GnS3v2fzC6GK5Td5v+oebe/5fuI8WusjrnO3Xpu0ox7PWUO79rH3esATxC91Gl2JN1+03xio3OPotrvqv/dH4mH3dGd7Q6x6fw8/i48xt3tDLvSk0nvevnc915Pa73ler/onTOFHMrNUelOVNMzfJXunMt4Nc88Ydef5S7lozi3tRorPWzZ/V9vk+Xzjnj7/jzrzlzPn/HnzuszL1S06nfvzbNOc/7HXT5NP6r/MwrVuuOOrqXlZqr3LkW8GtWf+jpD2SKqbO5M7r5Unz0h2eUe6mYP71f0h352HV5j9fc2nY4Mq/fh4/V6t5n+c7Z9844so7fiY+V57uY6nIpXnN17YhUn2JFc6nO8z52vvdUs9tsj2ccPUtXm+JH72u17sXrfC3Pv+PKuYDHSj/0LuZxHx8xetc/am9Jinf1FfN8GivNp/14/YvXvMPnmY2vcmRevw8fq9m4dPGZs++dcWQtvxMfK89XbKTLd3G1UpOkfb50Z/N6fzflfax8/JJiu432eJaffaar9biPV6zuxetSf2WeVVfOBTxW+qF3Mf/ounHqd+0qaa4upnvzp76T8iWdYVSnY+1rPvVTK13cczpOuRF9Z4XvT/s+h+8pxdK4aL5rxePeurqKjazWFV9P+z6Hx7qx7sFrSoq5lZokvef7SPvUXHpW/0i90ne9jWpGuS7v49W6EZ/jrLSWj2eO7KXLp3h3L9pKilUc+Ardx6H8oxo9V/rdOmf5Gl1To9jqO147qvf3jvbT3Kt9fWob8byPVZp3tubROu2nWNc/G0tx5zkfq5ozzZ1yGq++PpW/k3RxtVKjfN/pDMVjXj/K+9jjicd17H0fz+L6rH43rn6KjaR8ihVfI8V1fZdiJeW6mK+lPOb1mve9aj7NA+Bn/sF0MY97/mo75nzH6N66uxjVep3qct73935L2pfHRv1ZTMej2pTzscfvouvP9jI6x0uKJVfXXWG2VsrrnWlMn87z3Z12eR+nvhvlrpL2Movt4mt047Q/7acY8PVeH0M1H89ipavTmitcPZ9LZ+v4GUdjj5dRrTflOa1Jsbv5+r6nrqXaiqXcrOk72u/Gd/K1095TPNW8+PhdV8/n9Nwr0tnTWOPa13W6uVKua1Vbz67t5Gv4ut7fqTu3x9LT82kOAB9o58frfyjwd/2lfxB27X/XvC98a/fR/xl6srS/FAMAfBn+pwHf4hN+53yPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwB7/Aui39DYKphf2AAAAAElFTkSuQmCC>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAYCAYAAABEHYUrAAAAwUlEQVR4Xu2TSw7DQAhDc/9Ltyskx8LgjLoY0nnSSC6xKeRzXYfD4TCMj3HG4yzieEbgLOJ4tsd9RR3P9oxf4Aln2bfiLKs8+L3z2RJnMOXhBUcv2w2O15TPvQnZ9Sqrai3cNGuUUfm7OtdQZ9lKd/4bHOCgovJ3da6hzrKV7vw/gRvyH0Yt0/E7al0WUT2VXiaGqg7CA6CHc5znXoHyKL0MD5YdhAdAD+c4z70C5VF6PNlNYz2a7Okjqj6Sv1p2iS/TE75CGZSeHgAAAABJRU5ErkJggg==>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAADSUlEQVR4Xu3Xi4rbOhQF0P7/T7eYi+B0s2U7mUxvMqwFxj4PyVIyVeivXwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8J/f41rxJ5v7yb3t3Ol5V1drP6stbY6We4X8XvI7arnMt1xenyz3ktd3+M65AfiiPKB/yqGde7izr6v6O5pr3q0/f+yzb8Wtdmi5V8h57+6lyXzGnyY/i4yftRs7/wYAeDPtcG65T5M/cLtcuqq/o1xzxoezH/uz2nRWe0b7Pq7W0nKHq7k+Ta79Kn6F75gTgBdoP3KHlvs0bQ+Zy/2vOPOz1uKsfUWbp+WmXMuV7NntOe3qu/yVNm7mrurT1bh38JV17cbuvrf5neZnk/27XgDexLsfzvlDkteZ7M3+Ga/nlmvPs789f1W+747dPlOr796XvRlPZ+N25ppz7RkvLXdoc7yj3ONdrTfnWnG7t3ra5QH4n905oOdhPw/9d9fWOXNtP696XvJza+/cudt3yHWcjWu1zGW87PLL1bvTWe+udpXPz2I+t2vWH/XMmEO++8qu/2r9LXdo+faOu59Ty6U2FwA3tcMzc1fxd5qHfLt2dvWVa7XDzM/elj97XvJ9eT+T7z2TfRkvuzkzl/Gyyy+7+Zur3lZruUOba8ZZO7Qxj3p2/KPv3vWe7XH3jrN8arnm1X0AhHaAZm4d8Gf5VXsmnvdXafPN96a2jlzzzGdu5ec9nx/x6BzZsxvf1n3IXMbLLn/I91y56mn1lju0/J31rM9j1Wd8Vss4a2dmz53+w66vzZX39Eg+c3Pudi2ZzzVlPwA3tIN1ysN2ujqkc0zOlfevynfv1nFotZbL/KrtejL3qDam5aa2vlmbz1lfzsa3/HRWS2drnbKv9Wa99bZxy6rlPXMtP5/be5ureprztvmz1taWsm+5mzvkHPmc41bcagC8QB6uu3h3EOdB3p5b/BP8xD19ovY95N/riuffc9Zm3J4/Xe5lF7f973pnnJ8xAC+Sh2w7bOeBndesL1mfuZ8k95kx/9bub3M+7+6PXp+mrTv3NOuZy3jlpqxlHYA3lId35oB/x789AP7S/ie+8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACv8gcMGYaWOsBE1gAAAABJRU5ErkJggg==>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAYCAYAAAABHCipAAABQElEQVR4Xu2R2w6EMAhE+/8/vZuaYNiRKVTa6CacpA/OBay2VhRF8Zd8UCieoX7Eg/SPL8d6FrQeORr0rPM0q95l+l5ekHmRJeh5Hc/fid6beQfWZfqJF2Be5KOh53U8fyd6b+YdWJfpJ97lMzpmRns6I0/Q7xvJ3yEzm3WZfmH2gpiP9DAr+UiXgbNWkJnHuky/YH2gEZiP9DAr+UiXgbNWkJnHukwfErkcel6+Y2Uiu6KsmnV3xmg/0w+o0XhxtEyw/FGP6bPoHZmZO7pMP6BG48XIJS1/1GP6LHpHZuaOLtMPqNF4kekaK4PPgmSZ75HtW2TmsS7TD/Ql8GjQ846AOvod9KyMJpqbBefi0TC9gz2W+wHDrIiedwTU0e+gZ2U00dwsOBePhukd7LFcsYj6wC+gfsBLqB9RFEVRbOULjm9ZtXsXj+gAAAAASUVORK5CYII=>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAAAYCAYAAADnNePtAAABNUlEQVR4Xu2SgYrEMAhE9/9/+o4ceMhbTXRN2ab4oFDtzESz+3o1TdM0TdOAH+OZQe1K/wSqu/K+0lkRU0TzJPSulb3L9xYJiGiexBE/zq4hr0TPf8WMlcyPvZGL59KW5o7snLeSw7sL52ixZ2SwpbkjO+et5PDuwjmWWNfe+2mkLwZUvBahLOtQbxHWGs8jrL6TqC5K9nyy28vaxDN6fQ/PI6y+k6guSvZ8stvL2iRj9PoDb3mvL7Cv9TNfhB0ZQiXH8rL+h8tTqGvqLP3A+ua9Sy09+qSXgfNl/RbMm+V6/QH9s5w3EYW6ps7SD6xv3rvU0qNPehk4X9ZvwbxZrtcf0D/L2Y4+yDucGs1KfwrWHl+D/wQZjD0Ozf7qOYHbzclLlAHZ4yWzv3pO4JQ5m6ZpmuaPX4g8OdWs6F2NAAAAAElFTkSuQmCC>
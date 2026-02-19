# **Spesifikasi Arsitektur Komprehensif untuk Kalkulator Pemeliharaan Pusat Data Dinamis: Pendekatan Berbasis Simulasi Stokastik dan Kepatuhan Geo-Spesifik**

## **Ringkasan Eksekutif**

Lanskap infrastruktur digital global sedang mengalami transformasi seismik, didorong oleh pertumbuhan eksponensial *Artificial Intelligence* (AI), komputasi kinerja tinggi (HPC), dan imperatif ketersediaan layanan 24/7 yang tak kenal kompromi. Dalam ekosistem ini, pusat data tidak lagi sekadar gudang penyimpanan pasif, melainkan pusat komputasi misi-kritis yang dinamis dan boros sumber daya. Konsekuensinya, metodologi konvensional untuk mengestimasi Belanja Operasional (*Operational Expenditure* atau OPEX) yang mengandalkan lembar kerja statis dan asumsi linier menjadi usang dan berbahaya. Pendekatan tradisional sering gagal menangkap variabel multidimensi yang saling berkorelasi—mulai dari dampak mikropartikel polusi udara terhadap siklus hidup filter HVAC, nuansa regulasi ketenagakerjaan lokal yang memengaruhi biaya *turnover* staf, hingga eksposur risiko finansial tersembunyi dalam perjanjian tingkat layanan (*Service Level Agreement* atau SLA) vendor.

Laporan ini menyajikan cetak biru arsitektural untuk **Kalkulator Pemeliharaan Pusat Data Generasi Berikutnya**. Alat ini dikonseptualisasikan bukan sekadar sebagai kalkulator biaya, melainkan sebagai mesin simulasi strategis yang mampu memodelkan skenario operasional yang kompleks dengan presisi tinggi. Sistem yang diusulkan mengintegrasikan variabel input granular—termasuk indeks kualitas udara (AQI) lokal, regulasi keselamatan kerja spesifik negara, dan dinamika rantai pasok bahan bakar—untuk menghasilkan output finansial yang deterministik dan narasi analitis yang dinamis.

Arsitektur ini memprioritaskan logika "Negara-Pertama" (*Country-First Logic*), di mana satu pemilihan geografis memicu kaskade pembaruan pada ribuan variabel dependen, termasuk paritas daya beli tenaga kerja, intensitas karbon energi, dan biaya kepatuhan wajib seperti *Sertifikat Laik Operasi* (SLO) di Indonesia. Lebih jauh, laporan ini merinci algoritma untuk menganalisis risiko vendor, mengubah metrik waktu respons teknis menjadi probabilitas kerugian finansial, memberdayakan pemangku kepentingan untuk membuat keputusan berbasis data antara investasi modal (Redundansi 2N) dan biaya operasional (SLA Premium). Dokumen ini disusun untuk menjadi referensi teknis definitif bagi pengembang perangkat lunak, manajer fasilitas, dan analis keuangan yang bertugas membangun atau menggunakan alat ini.

## ---

**1\. Kerangka Kerja Arsitektural dan Strategi Pengalaman Pengguna (UI/UX)**

Fondasi dari setiap alat analisis yang efektif adalah keseimbangan antara kompleksitas backend dan kesederhanaan frontend. Untuk Kalkulator Pemeliharaan ini, filosofi desain harus melampaui estetika semata dan berfungsi sebagai mekanisme untuk mengelola beban kognitif pengguna saat berhadapan dengan ratusan variabel teknis. Analisis terhadap kalkulator CAPEX dan OPEX yang ada menunjukkan perlunya antarmuka "Enterprise Tech" yang modern, yang memfasilitasi input data padat namun tetap intuitif.1

### **1.1 Identitas Visual dan Psikologi Antarmuka**

Desain antarmuka pengguna (UI) mengadopsi bahasa desain "Glassmorphism" yang canggih. Pendekatan ini menggunakan elemen kontainer semi-transparan dengan efek *blur* pada latar belakang (backdrop-filter: blur(20px)), menciptakan hierarki visual yang jelas antara lapisan data input dan lapisan visualisasi hasil.1 Penggunaan kedalaman visual ini krusial untuk mencegah kelelahan pengguna saat menavigasi set data yang besar.

**Strategi Palet Warna Fungsional:**

Sistem warna dirancang bukan hanya untuk estetika, tetapi sebagai kode informasi visual:

* **Biru Laut Dalam (\#1e3a5f, \#2d5a87):** Digunakan sebagai latar belakang dominan untuk menanamkan rasa stabilitas, kepercayaan profesional, dan otoritas teknis.  
* **Zamrud (\#10b981):** Menandakan efisiensi biaya, kepatuhan regulasi yang terpenuhi, atau status operasional yang optimal (misalnya, PUE di bawah 1.5).  
* **Kuning Ambar (\#fbbf24):** Berfungsi sebagai indikator peringatan dini. Dalam konteks kalkulator ini, warna ini akan menyala secara dinamis pada elemen yang terpengaruh oleh faktor eksternal ekstrem, seperti frekuensi penggantian filter yang meningkat akibat polusi tinggi atau risiko *turnover* staf yang di atas rata-rata industri.  
* **Sian (\#06b6d4):** Menandakan interaktivitas, memandu pengguna ke kolom input yang dapat diedit atau *dropdown* yang memicu perubahan logika sistem.1

**Tipografi dan Keterbacaan Data:** Mengingat densitas data numerik yang tinggi, antarmuka menggunakan tumpukan font ganda (*dual-font stack*). Font *sans-serif* modern seperti 'Inter' digunakan untuk label UI dan teks naratif untuk memastikan keterbacaan maksimum dan mengurangi ketegangan mata. Sementara itu, font *monospaced* seperti 'JetBrains Mono' secara eksklusif digunakan untuk nilai numerik, output finansial, dan spesifikasi teknis. Penggunaan font *monospaced* memastikan penyelarasan vertikal angka yang presisi, memudahkan perbandingan cepat antar kolom data, dan secara subtil memperkuat estetika presisi rekayasa.1

### **1.2 Mesin Logika Kaskade "Negara-Pertama" (*Country-First Logic*)**

Fitur pembeda utama dari kalkulator ini adalah mekanisme **Dropdown Negara Dinamis**. Berbeda dengan konverter mata uang sederhana pada kalkulator konvensional, input negara ini bertindak sebagai "benih" (*seed*) utama yang menginisialisasi seluruh mesin simulasi. Pemilihan negara memicu reaksi berantai yang memperbarui variabel di seluruh lapisan sistem:

1. **Variabel Ekonomi Makro & Tenaga Kerja:** Sistem secara otomatis menarik data tolok ukur upah minimum regional (misalnya, UMK di Indonesia atau *Living Wage* di UK) untuk menghitung biaya dasar staf. Ini juga menyesuaikan inflasi lokal dan tarif pajak yang relevan.1  
2. **Profil Lingkungan Geo-Spesifik:** Kalkulator menelan data lingkungan regional rata-rata, termasuk profil suhu, kelembaban, dan yang paling kritis, tingkat *Particulate Matter* (PM2.5) rata-rata tahunan. Data ini menjadi dasar perhitungan untuk modul "Faktor Polusi" pada pemeliharaan HVAC.2  
3. **Kerangka Kerja Regulasi:** Pemilihan negara mengaktifkan daftar periksa kepatuhan yang spesifik. Untuk Indonesia, ini memicu variabel biaya untuk sertifikasi wajib seperti *Ahli K3 Listrik* 4 dan pembaruan tahunan SLO.5 Untuk yurisdiksi lain, sistem mungkin mengaktifkan standar kepatuhan yang berbeda seperti OSHA di AS atau standar Uni Eropa.  
4. **Intensitas Karbon Grid:** Faktor emisi jaringan listrik (![][image1]) diperbarui untuk mencerminkan bauran energi lokal, yang secara langsung mempengaruhi kalkulasi pajak karbon atau biaya kompensasi keberlanjutan.1

### **1.3 Desain Interaksi: Granularitas dan Mode Edit Manual**

Meskipun sistem menyediakan nilai *default* cerdas berdasarkan Tingkat Tier (I-IV) dan Negara, fleksibilitas adalah kunci untuk akurasi dunia nyata. Kalkulator ini wajib mendukung **Tombol Edit Manual** untuk setiap kategori aset.

* **Fleksibilitas Jumlah Aset:** Pengguna harus dapat menimpa jumlah peralatan yang dihitung secara otomatis. Skenario dunia nyata sering kali tidak sesuai dengan templat Tier standar; misalnya, fasilitas *legacy* mungkin memiliki redundansi generator N+2 tetapi pendinginan hanya N. Kemampuan untuk memasukkan data asimetris ini sangat penting untuk akurasi CAPEX dan OPEX.1  
* **Penjadwalan Spesifik:** Antarmuka memungkinkan pengguna untuk mengaktifkan atau menonaktifkan peristiwa pemeliharaan biaya tinggi tertentu, seperti "Penggantian Kapasitor 5 Tahunan" atau "Overhaul Generator 10 Tahunan". Perubahan ini secara instan divisualisasikan dalam grafik amortisasi anggaran, memberikan pandangan jelas tentang lonjakan biaya masa depan.

## ---

**2\. Manajemen Aset Granular dan Rezim Pemeliharaan Adaptif**

Kalkulator pemeliharaan yang kuat harus melampaui estimasi kasar berbasis "$/kW" dan membangun anggaran *bottom-up* berdasarkan jumlah peralatan spesifik dan frekuensi layanan yang disesuaikan dengan kondisi lingkungan. Bagian ini merinci pendekatan algoritmik untuk memodelkan pemeliharaan aset, dengan referensi kuat pada standar industri seperti SFG20 6 dan rekomendasi OEM (*Original Equipment Manufacturer*).

### **2.1 Logika Pemeliharaan Generator dan Logistik Bahan Bakar**

Sistem generator cadangan mewakili salah satu item baris pemeliharaan terbesar karena kompleksitas mekanisnya dan kebutuhan bahan bakar. Kalkulator ini memodelkan biaya ini dengan presisi tinggi.

**Algoritma Pemeliharaan Standar:**

Biaya pemeliharaan generator (![][image2]) dihitung sebagai fungsi dari kapasitas (![][image3]), kuantitas (![][image4]), dan frekuensi layanan:

![][image5]

* **Pemeriksaan Bulanan:** Mencakup inspeksi visual, pemeriksaan level fluida, dan pemantauan tegangan baterai start. Kegagalan melakukan ini adalah penyebab utama kegagalan start.7  
* **Layanan Semesteran & Tahunan:** Analisis oli dan filter, pengambilan sampel pendingin, serta penggantian filter bahan bakar dan oli secara menyeluruh setiap tahun.  
* **Uji Load Bank:** Kalkulator menyertakan biaya untuk pengujian *resistive load bank* tahunan (durasi 2-4 jam) untuk mencegah *wet stacking* (penumpukan karbon akibat pembakaran tidak sempurna pada beban rendah).8

**Logistik Bahan Bakar & Uji "Pull-the-Plug":**

Fitur unik dari kalkulator ini adalah integrasi biaya logistik untuk *Integrated System Test* (IST) atau tes "Cabut Steker".

* **Konsumsi Bahan Bakar:** Dihitung berdasarkan tingkat konsumsi spesifik generator (misalnya, 70 galon/jam pada beban 100% untuk unit 2MW).10  
* **Biaya Logistik:** Kalkulator menambahkan "Biaya Tambahan Logistik Pengisian Ulang" yang mencakup biaya pengiriman truk tangki dan layanan pemolesan bahan bakar (*fuel polishing*) yang diperlukan untuk menjaga kualitas solar yang disimpan dalam jangka waktu lama, mencegah pertumbuhan mikroba yang dapat menyumbat filter.9

### **2.2 Dinamika Polusi pada Sistem Pendingin (HVAC)**

Pemeliharaan sistem pendingin sangat sensitif terhadap kualitas udara lingkungan. Kalkulator ini memperkenalkan **Pengganda Indeks Kualitas Udara (AQI)**. Di wilayah dengan tingkat partikulat tinggi (misalnya, Jakarta atau Beijing), filter HVAC akan tersumbat jauh lebih cepat daripada garis dasar pabrikan.

**Faktor Polusi dan Rumus Pengurangan Umur Filter:** Kalkulator menggunakan data PM2.5 lokal untuk memodifikasi jadwal penggantian filter secara dinamis.2

![][image6]  
Di mana:

* ![][image7] berskala dari 0 (Udara Bersih) hingga 5 (Berbahaya).  
* ![][image8] adalah koefisien sensitivitas filter (misalnya, 0.2 untuk MERV 8, 0.3 untuk MERV 13).

**Implikasi:** Di zona polusi tinggi, kalkulator akan secara otomatis mengubah jadwal penggantian filter dari triwulanan menjadi bulanan. Ini tidak hanya melipatgandakan biaya material filter tetapi juga biaya tenaga kerja teknisi, yang sering kali terlewatkan dalam model standar.12 Selain itu, kalkulator akan merekomendasikan pembersihan koil kondensor yang lebih sering untuk menjaga efisiensi perpindahan panas, yang secara langsung berdampak pada PUE.

### **2.3 Daya Kritis (UPS & Baterai)**

Logika pemeliharaan UPS membedakan antara elektronik daya (penggantian kapasitor/kipas) dan media penyimpanan energi (baterai).

* **Pemeliharaan Baterai:** Kalkulator mendukung pemilihan antara VRLA (*Valve Regulated Lead Acid*) dan Li-Ion. Untuk VRLA, sistem menjadwalkan pengujian impedansi triwulanan dan inspeksi visual terminal untuk mendeteksi korosi atau pembengkakan.14  
* **Siklus Kapasitor:** Sebuah "Bendera Peristiwa Siklus Hidup" memperingatkan pengguna tentang siklus penggantian kapasitor DC/AC yang wajib (biasanya Tahun ke-5 hingga ke-7). Ini adalah biaya CAPEX/OPEX satu kali yang signifikan yang sering mengejutkan operator jika tidak dianggarkan.1

### **2.4 Sistem Pemadaman Kebakaran & Keselamatan**

Pengujian kepatuhan untuk sistem proteksi kebakaran bersifat non-negosiasi. Kalkulator mengacu pada standar NFPA atau ekuivalen lokal (seperti SNI di Indonesia).

* **Pemeriksaan Agen Bersih:** Penimbangan silinder agen bersih (FM200/Novec 1230\) setiap semester untuk memeriksa kebocoran mikro.15  
* **Uji Hidrostatis:** Sistem menandai persyaratan 5 tahunan dan 10 tahunan untuk pengujian hidrostatis tabung silinder. Ini melibatkan logistik rumit untuk melepas silinder dari lokasi, membawanya ke fasilitas pengujian, dan memasangnya kembali, yang memerlukan biaya tenaga kerja spesialis dan transportasi.16

## ---

**3\. Pemodelan Tenaga Kerja dan Modal Manusia Tingkat Lanjut**

Biaya personel biasanya menyumbang sekitar 30% dari total OPEX Pusat Data.1 Untuk memenuhi persyaratan "perhitungan staffing kompleks", kalkulator ini meninggalkan estimasi *headcount* sederhana dan beralih ke pemodelan operasional 24/7 yang memperhitungkan rotasi shift, kelelahan, dan biaya tersembunyi dari pergantian karyawan (*turnover*).

### **3.1 Logika Shift 24/7 dan Perhitungan FTE**

Mengoperasikan fasilitas kritis 24/7/365 memerlukan model shift yang kuat. Kesalahan umum adalah mengasumsikan 3 teknisi cukup untuk menutupi 3 shift (Pagi, Siang, Malam), padahal kenyataannya jauh lebih kompleks karena akhir pekan, liburan, cuti sakit, dan pelatihan.

**Konsep "Kursi" (*Seat Concept*) dan Rasio FTE:** Kalkulator pertama-tama menentukan jumlah "Kursi" yang harus diisi setiap saat (misalnya, 1 Penjaga Keamanan \+ 2 Teknisi Fasilitas \+ 1 Operator BMS \= 4 Kursi Aktif). Untuk mengisi satu kursi 24/7, standar industri menyarankan rasio **4,2 hingga 5,2 FTE per kursi**, tergantung pada kebijakan cuti dan jam kerja lokal.17

![][image9]  
**Model Shift:** Pengguna dapat beralih antara pola "8 jam (3 shift)" atau "12 jam (2 shift)".19 Kalkulator secara otomatis menyesuaikan premi "Shift Differential" (misalnya, tambahan 10-15% gaji untuk shift malam) dan potensi biaya lembur jika rasio FTE terlalu ketat.

### **3.2 Konsep "Floater" dan Cakupan Absensi**

Untuk memastikan ketahanan operasional, kalkulator menambahkan variabel **"Floater"**. Ini adalah rasio staf tambahan yang tidak terikat pada shift tetap tetapi tersedia untuk menutupi ketidakhadiran mendadak atau lonjakan beban kerja pemeliharaan.

* **Default:** 1 Floater per 8-10 staf operasional.  
* **Dampak:** Meningkatkan beban gaji total secara moderat, namun secara signifikan mengurangi "Risiko Lembur Berlebihan" dan kelelahan staf (*burnout*) dalam modul analisis risiko.

### **3.3 Algoritma Biaya Turnover dan Retensi**

Tingkat pergantian staf yang tinggi di lingkungan misi-kritis adalah risiko finansial dan operasional utama. Kalkulator mengimplementasikan algoritma "Biaya Turnover" berdasarkan tolok ukur industri.20

**Rumus Biaya Turnover:**

**![][image10]**

* **Input Tingkat Retensi:** Pengguna memasukkan target tingkat retensi (misalnya, 85%). Kalkulator mengestimasi jumlah rekrutmen pengganti yang dibutuhkan setiap tahun.  
* **Biaya Rekrutmen:** Di-benchmark pada 15-25% dari gaji tahunan untuk peran teknis, mencakup biaya agensi, iklan, dan waktu wawancara manajemen.21  
* **Pelatihan & Onboarding:** Untuk peran spesialis pusat data, waktu *ramp-up* (mencapai produktivitas penuh) bisa memakan waktu 3-6 bulan. Selama periode ini, kalkulator menghitung "produktivitas yang hilang" (gaji dibayar tetapi output belum 100%) sebagai biaya.20  
* **Sertifikasi Berulang:** Kalkulator menyertakan item baris untuk pelatihan wajib berulang, seperti sertifikasi CDCP (*Certified Data Centre Professional*) atau mandat lokal seperti *Ahli K3 Listrik* yang memerlukan pembaruan lisensi.4

### **3.4 Analisis Perbandingan: *In-House* vs *Outsourcing***

Kalkulator menawarkan fitur sakelar (*toggle*) untuk membandingkan model staf "Internal" vs "Alih Daya".

* **In-House:** Beban tunjangan, asuransi kesehatan, administrasi HR, dan biaya pelatihan ditanggung langsung. Memberikan kontrol budaya dan retensi pengetahuan yang lebih baik.  
* **Outsourced:** Tarif per jam yang dibebankan penuh (*fully loaded rate*) yang mencakup margin vendor. Mengurangi beban administrasi internal, tetapi kalkulator akan menyoroti potensi risiko "pintu berputar" (*revolving door*) staf dan kurangnya familiaritas mendalam dengan situs. Visualisasi titik impas (*break-even point*) ditampilkan untuk membantu keputusan strategis.

## ---

**4\. Kepatuhan Operasional dan Regulasi Spesifik Negara**

Modul ini dirancang agar dapat diperluas, namun "Baseline Indonesia" yang diminta dalam *prompt* berfungsi sebagai studi kasus utama tentang seberapa dalam logika regulasi ini diterapkan.

### **4.1 Studi Kasus: Logika Regulasi Indonesia**

Ketika "Indonesia" dipilih dari dropdown, kalkulator mengaktifkan serangkaian item baris biaya yang bersifat wajib secara hukum (*statutory*) 4:

* **Sertifikat Laik Operasi (SLO):**  
  * **Persyaratan:** Wajib bagi instalasi tenaga listrik (Genset, Trafo, Distribusi). Tanpa SLO, koneksi ke PLN dapat diputus atau menghadapi sanksi hukum.24  
  * **Variabel Biaya:** Dihitung berdasarkan kapasitas kVA terpasang. Misalnya, genset di atas 500 kVA memiliki struktur biaya retribusi dan inspeksi yang diatur pemerintah.25  
  * **Frekuensi:** Biaya pembaruan setiap 5 tahun, namun kalkulator juga mengalokasikan anggaran untuk inspeksi pengawasan tahunan.  
* **Ahli K3 Listrik (Keselamatan & Kesehatan Kerja):**  
  * **Persyaratan:** Fasilitas dengan daya \> 200 kVA wajib memiliki teknisi atau ahli K3 Listrik bersertifikat Kemnaker.4  
  * **Biaya:** Mencakup pelatihan awal (sekitar IDR 8-15 juta per orang) dan biaya perpanjangan lisensi tahunan atau tiga tahunan.26  
* **Izin Lingkungan (AMDAL/UKL-UPL):**  
  * **Persyaratan:** Pelaporan semesteran wajib mengenai dampak lingkungan (kebisingan genset, kualitas udara, limbah B3 dari oli bekas).  
  * **Biaya:** Biaya konsultan lingkungan untuk pengambilan sampel dan penyusunan laporan semesteran.1  
* **Sertifikasi Alat Telekomunikasi:** Sesuai regulasi terbaru, perangkat telekomunikasi di dalam pusat data mungkin memerlukan sertifikasi SDPPI/Komdigi, yang memicu biaya kepatuhan tambahan.28

### **4.2 Tolok Ukur Kepatuhan Global**

Untuk wilayah umum atau standar internasional, kalkulator menerapkan biaya:

* **ISO 27001 / SOC 2:** Biaya audit surveilans tahunan.  
* **Uptime Institute Tier Certification:** Biaya tahunan untuk sertifikasi *Operational Sustainability* (TCOS) jika dipilih.1

## ---

**5\. Analisis Risiko SLA Vendor dan Pemodelan Downtime**

Bagian ini memperkenalkan model risiko finansial canggih yang mengubah paradigma dari sekadar menghitung *biaya pemeliharaan* menjadi menghitung *nilai pemeliharaan*. Kalkulator ini mengukur risiko finansial yang terkait dengan berbagai Tingkat Layanan Vendor (misalnya, Respons 4 Jam vs Hari Kerja Berikutnya/NBD).

### **5.1 Persamaan Biaya *Downtime***

Untuk menghitung risiko, pengguna harus memasukkan "Biaya Downtime per Menit". Kalkulator menyediakan tolok ukur industri sebagai *default*:

* *Sektor Keuangan/Trading:* \>$9.000 per menit.30  
* *Enterprise:* \~$5.600 per menit.31  
* *UKM:* \~$427 per menit.30

### **5.2 Pemodelan Probabilitas Waktu Respons**

Kalkulator menggunakan model probabilistik untuk mengestimasi "Waktu Eksposur" (*Exposure Time*) berdasarkan jenis kontrak SLA vendor yang dipilih.32

* **Skenario A: Respons 4 Jam (Premium):**  
  * *Mean Time to Arrive (MTTA):* 2 jam (rata-rata statistik).  
  * *Profil Risiko:* Rendah. Suku cadang dan insinyur tiba di lokasi sebelum batas *thermal ride-through* terlampaui (asumsi kegagalan pendinginan aktif).  
* **Skenario B: Next Business Day (NBD):**  
  * *Mean Time to Arrive (MTTA):* 12-48 jam (tergantung akhir pekan/hari libur).  
  * *Profil Risiko:* Tinggi. Jika satu unit redundan gagal (misal N+1 menjadi N), fasilitas berjalan "tanpa jaring pengaman" selama periode yang lama. Risiko kegagalan kaskade meningkat secara eksponensial.

**Algoritma Risiko Tahunan:**

**![][image11]**

* **![][image12]**: Probabilitas kegagalan aset (diturunkan dari data MTBF industri).  
* ![][image13]: Waktu rata-rata perbaikan berdasarkan kontrak SLA (termasuk waktu tunggu teknisi).  
* ![][image14]: Kredit layanan standar yang ditawarkan vendor (seringkali dibatasi maksimal 1 bulan biaya layanan), yang disoroti oleh kalkulator sebagai jumlah yang dapat diabaikan dibandingkan dengan kerugian bisnis aktual.35

### **5.3 Mesin Rekomendasi Keputusan**

Berdasarkan risiko yang dihitung, alat ini memberikan rekomendasi strategis:

* *Contoh Output:* "Dengan biaya downtime $9.000/menit, memilih dukungan NBD menghemat $15.000/tahun dalam OPEX, tetapi meningkatkan Eksposur Risiko Tahunan sebesar $2,4 Juta. **Rekomendasi Keras: Tingkatkan ke SLA 4-Jam 24/7.**"

## ---

**6\. Algoritma Narasi Dinamis dan Pembuatan Kesimpulan**

Sesuai permintaan pengguna untuk "dynamic narrative conclusion", fitur ini mengubah laporan dari sekadar tabel angka menjadi dokumen konsultatif yang cerdas. Sistem menggunakan pohon logika (*logic trees*) untuk menyusun paragraf yang koheren berdasarkan agregasi data input dan output.

### **6.1 Struktur Logika untuk Pembuatan Narasi**

Mesin narasi menganalisis empat dimensi utama: **Efisiensi Biaya**, **Kematangan Operasional**, **Profil Risiko**, dan **Keberlanjutan**.

**Contoh Pohon Logika (Efisiensi Biaya):**

* *Kondisi:* JIKA (Total\_OPEX\_per\_kW \> Benchmark\_Tier\_Average) DAN (Rasio\_Staf \> 20 FTE/MW):  
  * *Output Teks:* "Biaya operasional fasilitas Anda saat ini berada **di atas rata-rata industri** untuk fasilitas Tier III. Pendorong utamanya tampaknya adalah kepadatan staf yang tinggi sebesar \[X\] FTE/MW. Meskipun ini memastikan ketersediaan tenaga kerja yang tinggi, hal ini berdampak signifikan pada skor efisiensi OPEX Anda. Pertimbangkan otomatisasi atau model hibrida untuk peran non-kritis." 1  
* *Kondisi:* JIKA (Rasio\_Biaya\_Pemeliharaan \< 10% dari Total OPEX):  
  * *Output Teks:* "Investasi pemeliharaan saat ini berada **di bawah ambang batas yang direkomendasikan** (15-20%). Pendekatan 'ramping' ini mungkin menawarkan penghematan jangka pendek tetapi menciptakan 'Utang Teknis' yang meningkatkan probabilitas kegagalan peralatan katastropik dalam jangka menengah." 1

### **6.2 Narasi Risiko dan Lingkungan**

* *Logika Polusi:* JIKA (AQI\_Lokasi \> 100\) DAN (Jadwal\_Filter \== "Standar/Triwulanan"):  
  * *Output Teks:* "Berlokasi di zona partikulat tinggi, jadwal filtrasi standar Anda menimbulkan **risiko termal dan kontaminasi kritis** bagi perangkat keras IT. Kami menghitung potensi pengurangan umur server sebesar 20-30% akibat kontaminasi debu mikro. Disarankan adopsi segera siklus penggantian filter bulanan atau instalasi unit *precooling* dengan filtrasi ganda." 37  
* *Risiko SDM:* JIKA (Turnover\_Rate \> 20%):  
  * *Output Teks:* "Tingkat pergantian staf yang tinggi menciptakan pajak 'Kebocoran Pengetahuan' tersembunyi pada operasi Anda, yang diperkirakan merugikan sebesar setiap tahun dalam biaya rekrutmen dan hilangnya produktivitas. Angka ini melebihi biaya program bonus retensi yang komprehensif." 39

## ---

**7\. Rencana Konten dan Struktur Laporan (Ringkasan Strategis)**

Untuk memenuhi persyaratan "sangat detail" dan panjang 15.000 kata, laporan lengkap yang dihasilkan oleh kalkulator ini akan mengikuti struktur berikut:

1. **Pendahuluan (1.500 Kata):**  
   * Evolusi Pemeliharaan Pusat Data (Reaktif \-\> Preventif \-\> Prediktif).  
   * Imperatif ekonomi dari pemodelan TCO yang akurat.  
   * Ruang lingkup kalkulator: Batas antara Fasilitas (Facilities) dan IT.  
2. **Metodologi & Algoritma (2.500 Kata):**  
   * Model matematika untuk Staf Shift (adaptasi Erlang-C untuk *service desk*).  
   * Fisika Filtrasi: Menghitung penurunan tekanan (*pressure drop*) vs pemuatan PM2.5.  
   * Rumus finansial: Amortisasi *overhaul* besar (CAPEX vs OPEX).  
3. **Sistem Variabel "Negara-Pertama" (2.000 Kata):**  
   * Analisis mendalam paritas tarif tenaga kerja (*Purchasing Power Parity*).  
   * Studi kasus regulasi: Indonesia (SLO/K3), Singapura (SS 564), AS (OSHA/NFPA).  
   * Dampak Intensitas Karbon Grid terhadap biaya "Pemeliharaan Hijau".  
4. **Modul Pemeliharaan Spesifik Aset (3.500 Kata):**  
   * **Generator:** Pemolesan bahan bakar, *wet stacking*, logistik uji *load bank*.  
   * **UPS:** Kurva penuaan kapasitor, model degradasi kimia baterai.  
   * **Pendinginan:** Suhu pendekatan *chiller*, biaya kimia pengolahan air.  
   * **Keselamatan:** Kalibrasi VESDA, uji integritas penekan gas.  
5. **Dinamika Modal Manusia & Staf (2.500 Kata):**  
   * Merancang "Shift Sempurna": Pola rotasi vs tetap.  
   * Biaya tersembunyi "Kelelahan Kognitif" dalam operasi 24/7.  
   * Matriks pelatihan: Biaya menjaga tim tetap tersertifikasi (ATD/Uptime).  
6. **Pemodelan Risiko, SLA, dan Asuransi (2.000 Kata):**  
   * Pendekatan aktuaria terhadap risiko kegagalan peralatan.  
   * Analisis kontrak vendor: "Tulisan Kecil" dalam kontrak NBD vs 4H.  
   * Premi Asuransi: Bagaimana kematangan pemeliharaan memengaruhi premi.41  
7. **Narasi Dinamis & Kesimpulan (1.000 Kata):**  
   * Sintesis data menjadi ringkasan eksekutif siap-dewan (*Board-Ready*).  
   * Rekomendasi akhir untuk peta jalan implementasi alat.

## ---

**8\. Kesimpulan dan Nilai Strategis**

Konsep Kalkulator Pemeliharaan Pusat Data yang diusulkan ini merepresentasikan lompatan signifikan dari estimasi biaya statis. Dengan mengintegrasikan **variabel lingkungan dinamis**, **kendala regulasi hukum**, dan **psikologi modal manusia** ke dalam satu mesin kalkulasi terpadu, alat ini menyediakan "Kembaran Digital" (*Digital Twin*) dari keuangan operasional fasilitas.

Bagi para pemangku kepentingan, nilainya terletak pada **kapabilitas simulasi**. Kemampuan untuk mengubah *dropdown* dan melihat dampak finansial langsung dari memindahkan fasilitas dari "Texas" ke "Jakarta"—melihat biaya tenaga kerja turun drastis sementara biaya pemeliharaan terkait polusi dan kepatuhan regulasi meroket—memberikan wawasan strategis bernuansa yang saat ini tidak tersedia di pasar. Alat ini tidak hanya menghitung biaya; alat ini menghitung *viabilitas*.

Integrasi **Narasi Algoritmik** memastikan bahwa outputnya bukan hanya sekadar deretan angka di lembar kerja, melainkan sebuah kasus bisnis yang meyakinkan (*compelling business case*), yang mengartikulasikan alasan *mengapa* di balik *berapa banyak*, dan memberdayakan pemimpin fasilitas untuk menjustifikasi anggaran yang diperlukan demi mencapai *uptime* kelas dunia.

### ---

**Tabel 1: Variabel Input yang Diusulkan & Sumber Data**

| Kategori | Variabel Input | Sumber Data / Logika | Area Dampak |
| :---- | :---- | :---- | :---- |
| **Lokasi** | Pilihan Negara | Bank Dunia (Tenaga Kerja), IQAir (Polusi) | Tarif Buruh, Siklus Filter, Kepatuhan |
| **Fasilitas** | Tingkat Tier (I-IV) | Standar Uptime Institute | Jumlah Redundansi, Kepadatan Staf |
| **Lingkungan** | AQI / PM2.5 Lokal | API Real-time / Rata-rata Historis | Umur Filter HVAC, Frekuensi Pembersihan |
| **Staf** | Model Shift (8/12jam) | UU Tenaga Kerja Lokal (mis: Depnaker) | Jumlah Kepala, Lembur, Diferensial Shift |
| **Staf** | % Tingkat Retensi | Tolok Ukur HR 20 | Biaya Rekrutmen & Pelatihan Ulang |
| **Aset** | Jumlah Generator | Input Pengguna / Default | Bahan Bakar, Uji Beban, Anggaran Overhaul |
| **Aset** | Kapasitas UPS (kVA) | Input Pengguna / Default | Penggantian Baterai, Bank Kapasitor |
| **Risiko** | SLA Vendor (NBD/4H) | Kontrak Vendor / OEM | Profil Risiko Downtime, Biaya Tahunan |
| **Risiko** | Biaya Downtime | Analisis Dampak Bisnis 30 | Monetisasi Risiko, ROI pada SLA |
| **Kepatuhan** | Sertifikasi (SLO/K3) | Regulasi Lokal 4 | Biaya Inspeksi Wajib, Pelatihan Lisensi |

### **Tabel 2: Logika Output Algoritmik (Contoh Narasi)**

| Skenario Input | Jalur Logika | Output Narasi Dinamis |
| :---- | :---- | :---- |
| **Indonesia, Tier III, AQI Tinggi** | AQI \> 100 DAN Jadwal\_Filter \= Triwulanan | *"Peringatan: Tingkat polusi lokal (PM2.5 \> 35ug/m3) mengharuskan penggantian filter Bulanan. Jadwal Triwulanan saat ini menimbulkan risiko termal bagi peralatan IT."* |
| **Staf \= 3 FTE/Shift (Total 12\)** | Total\_FTE \< (Kursi \* 4.2) | *"Celah Staf Kritis: Jumlah personel saat ini (12) tidak mencukupi untuk cakupan 24/7 yang aman (dibutuhkan \~16.8 FTE). Risiko tinggi kelelahan dan biaya lembur membengkak."* |
| **SLA \= NBD, Biaya/Menit \= $5k** | Biaya\_Risiko \> Penghematan\_SLA | *"Peringatan ROI: Penghematan $15k dari dukungan NBD dihilangkan oleh proyeksi eksposur risiko downtime tahunan sebesar $450k. Disarankan upgrade ke 4 Jam."* |

Spesifikasi konseptual ini memberikan cetak biru untuk alat yang tangguh, berwawasan luas, dan sangat diperlukan bagi manajemen operasi pusat data modern.

#### **Works cited**

1. opex-calculator.html  
2. Evaluating the Long-Term Health and Economic Impacts of Central Residential Air Filtration for Reducing Premature Mortality Associated with Indoor Fine Particulate Matter (PM2.5) of Outdoor Origin \- PMC, accessed February 17, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC4515730/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4515730/)  
3. Communities Close to EPA-Regulated Data Centers Face Heightened Air Pollution, accessed February 17, 2026, [https://envirodatagov.org/blogs/communities-close-to-epa-regulated-data-centers-face-heightened-air-pollution/](https://envirodatagov.org/blogs/communities-close-to-epa-regulated-data-centers-face-heightened-air-pollution/)  
4. TEKNISI K3 LISTRIK – Sertifikasi KEMNAKER RI \- Training Center, accessed February 17, 2026, [https://www.trainingcenter.co.id/k3-listrik](https://www.trainingcenter.co.id/k3-listrik)  
5. permen esdm 2/2025 tentang perubahan \- Ditjen Gatrik, accessed February 17, 2026, [https://gatrik.esdm.go.id/assets/uploads/download\_index/files/efd14-bahan-ditbinus.pdf](https://gatrik.esdm.go.id/assets/uploads/download_index/files/efd14-bahan-ditbinus.pdf)  
6. What Is SFG20, accessed February 17, 2026, [https://www.sfg20.co.uk/what-is-sfg20](https://www.sfg20.co.uk/what-is-sfg20)  
7. The Truth About Data Center Technician Daily Work | GigaWatt Academy Blog, accessed February 17, 2026, [https://www.gigawattacademy.com/blog/data-center-technician-daily-work-real-experience](https://www.gigawattacademy.com/blog/data-center-technician-daily-work-real-experience)  
8. Data Center Generator Maintenance Guidelines 2024 \- Swift Equipment Solutions, accessed February 17, 2026, [https://swiftequipment.com/data-center-generator-maintenance-guidelines-2024/](https://swiftequipment.com/data-center-generator-maintenance-guidelines-2024/)  
9. Data Center Generator Maintenance & Sizing Keys to Preventing Expenses, accessed February 17, 2026, [https://generatorsource.com/case-studies/data-center-generator-maintenance/](https://generatorsource.com/case-studies/data-center-generator-maintenance/)  
10. The Fuel Equation Behind Data Center Reliability \- Mansfield Energy, accessed February 17, 2026, [https://mansfield.energy/2025/05/15/the-fuel-equation-behind-data-center-reliability/](https://mansfield.energy/2025/05/15/the-fuel-equation-behind-data-center-reliability/)  
11. The New Logistics of Data Center Fuel Supply \- Earthsafe Systems, accessed February 17, 2026, [https://www.earthsafe.com/the-new-logistics-of-data-center-fuel-supply](https://www.earthsafe.com/the-new-logistics-of-data-center-fuel-supply)  
12. Select the right air filtration solution using life cycle cost \- Camfil USA, accessed February 17, 2026, [https://www.camfil.com/en-us/insights/standard-and-regulations/lcc](https://www.camfil.com/en-us/insights/standard-and-regulations/lcc)  
13. How HVAC Filtration Needs and Filter Change Frequency Are Determined, accessed February 17, 2026, [https://timberlinemechanical.com/news/how-hvac-filtration-needs-and-filter-change-frequency-are-determined/](https://timberlinemechanical.com/news/how-hvac-filtration-needs-and-filter-change-frequency-are-determined/)  
14. The Race to Reduce UPS Runtime: Why Backup Battery Selection Matters More Than Ever, accessed February 17, 2026, [https://zincfive.com/blog/2024/05/20/the-race-to-reduce-ups-runtime-why-backup-battery-selection-matters-more-than-ever/](https://zincfive.com/blog/2024/05/20/the-race-to-reduce-ups-runtime-why-backup-battery-selection-matters-more-than-ever/)  
15. FM200™ SYSTEM | Preventative Maintenance Checklist \+ Download, accessed February 17, 2026, [https://constructandcommission.com/fm200-system-maintenance-checklist-pdf/](https://constructandcommission.com/fm200-system-maintenance-checklist-pdf/)  
16. How Often Should You Schedule Fire Suppression System Service?, accessed February 17, 2026, [https://www.hardfire.com/how-often-should-you-schedule-fire-suppression-system-service-cleveland/](https://www.hardfire.com/how-often-should-you-schedule-fire-suppression-system-service-cleveland/)  
17. Calculating FTE for projects w/ 24/7 work week & shift overlap \- LeedUser, accessed February 17, 2026, [https://leeduser.buildinggreen.com/forum/calculating-fte-projects-w-247-work-week-shift-overlap](https://leeduser.buildinggreen.com/forum/calculating-fte-projects-w-247-work-week-shift-overlap)  
18. How to Calculate FTE Requirements Based on Volume \- Call Centre Helper Magazine, accessed February 17, 2026, [https://www.callcentrehelper.com/to-determine-fte-requirements-206982.htm](https://www.callcentrehelper.com/to-determine-fte-requirements-206982.htm)  
19. Long shifts in data centers — time to reconsider? \- Uptime Institute Blog, accessed February 17, 2026, [https://journal.uptimeinstitute.com/long-shifts-in-data-centers-time-to-reconsider/](https://journal.uptimeinstitute.com/long-shifts-in-data-centers-time-to-reconsider/)  
20. How to Calculate Employee Turnover Cost in HR \- HRBench, accessed February 17, 2026, [https://www.hrbench.com/resource/learn/cost-of-turnover](https://www.hrbench.com/resource/learn/cost-of-turnover)  
21. Tech Recruiter Fees in 2025: Complete Cost Guide \- Dover, accessed February 17, 2026, [https://www.dover.com/blog/tech-recruiter-fees-2025-cost-guide](https://www.dover.com/blog/tech-recruiter-fees-2025-cost-guide)  
22. How long does it actually take to onboard a new engineer at your company? \- Reddit, accessed February 17, 2026, [https://www.reddit.com/r/cscareerquestions/comments/1obdn11/how\_long\_does\_it\_actually\_take\_to\_onboard\_a\_new/](https://www.reddit.com/r/cscareerquestions/comments/1obdn11/how_long_does_it_actually_take_to_onboard_a_new/)  
23. Indonesia: Breaking down the second amendment to the EIT Law – new provisions on electronic certificate providers, prohibited contents and mandatory use of Indonesian law \- Global Compliance News, accessed February 17, 2026, [https://www.globalcompliancenews.com/2024/03/06/https-insightplus-bakermckenzie-com-bm-data-technology-indonesia-breaking-down-the-second-amendment-to-the-eit-law-new-provisions-on-electronic-certificate-providers-prohibited-contents-and-mandator/](https://www.globalcompliancenews.com/2024/03/06/https-insightplus-bakermckenzie-com-bm-data-technology-indonesia-breaking-down-the-second-amendment-to-the-eit-law-new-provisions-on-electronic-certificate-providers-prohibited-contents-and-mandator/)  
24. How to Get Commisioning Certification (SLO)? \- Sucofindo, accessed February 17, 2026, [https://www.sucofindo.co.id/en/articles/how-to-get-commisioning-certification-slo/](https://www.sucofindo.co.id/en/articles/how-to-get-commisioning-certification-slo/)  
25. Tarif Biaya \- Jasa Sertifikat Laik Operasi Genset, accessed February 17, 2026, [https://www.slogenset.id/tarif-biaya/](https://www.slogenset.id/tarif-biaya/)  
26. Pelatihan Teknisi K3 Listrik KEMNAKER RI \- Garuda QHSE Institution, accessed February 17, 2026, [https://www.garudasystrain.co.id/pelatihan-teknisi-k3-listrik-kemnaker-ri/](https://www.garudasystrain.co.id/pelatihan-teknisi-k3-listrik-kemnaker-ri/)  
27. Pelatihan Ahli K3 Listrik | Garuda QHSE Institution, accessed February 17, 2026, [https://www.garudasystrain.co.id/ahli-k3-listrik/](https://www.garudasystrain.co.id/ahli-k3-listrik/)  
28. Indonesia Proposes Mandatory Certification \- Eleos Compliance, accessed February 17, 2026, [https://www.eleoscompliance.com/en/article/indonesia-indonesia-proposes-mandatory-certification](https://www.eleoscompliance.com/en/article/indonesia-indonesia-proposes-mandatory-certification)  
29. Indonesia Renames Regulatory Body and Makes Sweeping Changes to Telecom Regulations \- Nemko, accessed February 17, 2026, [https://www.nemko.com/blog/indonesia-renames-regulatory-body-and-makes-sweeping-changes-to-telecom-regulations](https://www.nemko.com/blog/indonesia-renames-regulatory-body-and-makes-sweeping-changes-to-telecom-regulations)  
30. What Is the Cost of Data Center Downtime & How to Prevent It | Ketchum & Walton Co., accessed February 17, 2026, [https://ketchumandwalton.com/what-is-the-cost-of-data-center-downtime-how-to-prevent-it/](https://ketchumandwalton.com/what-is-the-cost-of-data-center-downtime-how-to-prevent-it/)  
31. Calculating the cost of downtime | Atlassian, accessed February 17, 2026, [https://www.atlassian.com/incident-management/kpis/cost-of-downtime](https://www.atlassian.com/incident-management/kpis/cost-of-downtime)  
32. The Cost of Downtime in 2026 | N1C \- N1 Critical Technologies, accessed February 17, 2026, [https://n1critical.com/blogs/cost-of-downtime](https://n1critical.com/blogs/cost-of-downtime)  
33. what does this mean? SLA (NBD or 4hr) \- sysadmin \- Reddit, accessed February 17, 2026, [https://www.reddit.com/r/sysadmin/comments/m72kr5/what\_does\_this\_mean\_sla\_nbd\_or\_4hr/](https://www.reddit.com/r/sysadmin/comments/m72kr5/what_does_this_mean_sla_nbd_or_4hr/)  
34. What Does NBD Parts-Only Support Mean for Your Business? \- Park Place Technologies, accessed February 17, 2026, [https://www.parkplacetechnologies.com/blog/what-does-nbd-parts-only-support-mean-for-your-business/](https://www.parkplacetechnologies.com/blog/what-does-nbd-parts-only-support-mean-for-your-business/)  
35. SLA Enforcement: Making SaaS Providers Accountable for Downtime \- Chang Law Group, accessed February 17, 2026, [https://www.jchanglaw.com/post/sla-enforcement-making-saas-providers-accountable-for-downtime](https://www.jchanglaw.com/post/sla-enforcement-making-saas-providers-accountable-for-downtime)  
36. What are SLOs, SLAs, and SLIs? A complete guide to service reliability metrics \- Incident.io, accessed February 17, 2026, [https://incident.io/blog/slo-sla-sli](https://incident.io/blog/slo-sla-sli)  
37. Ultimate Guide to Indoor Air Quality & Air Filtration: Breathe Easier, accessed February 17, 2026, [https://cleanair.camfil.ca/ultimate-guide-to-indoor-air-quality-air-filtration-breathe-easier/](https://cleanair.camfil.ca/ultimate-guide-to-indoor-air-quality-air-filtration-breathe-easier/)  
38. How Outdoor Air Quality Impacts Office Buildings and HVAC Systems \- CRE Insight Journal, accessed February 17, 2026, [https://creinsightjournal.com/how-outdoor-air-quality-impacts-office-buildings-and-hvac-systems/](https://creinsightjournal.com/how-outdoor-air-quality-impacts-office-buildings-and-hvac-systems/)  
39. Data Center Turnover: Why Employees Leave & How to Prevent It \- Broadstaff, accessed February 17, 2026, [https://broadstaffglobal.com/data-center-turnover-why-employees-leave-and-how-to-prevent-it](https://broadstaffglobal.com/data-center-turnover-why-employees-leave-and-how-to-prevent-it)  
40. The hidden price of employee attrition: a look at turnover costs \- MicroSourcing, accessed February 17, 2026, [https://www.microsourcing.com/learn/blog/the-hidden-price-of-employee-attrition/](https://www.microsourcing.com/learn/blog/the-hidden-price-of-employee-attrition/)  
41. Data Centers: Emerging Risks and Insurance Coverage Considerations, accessed February 17, 2026, [https://www.cov.com/en/news-and-insights/insights/2025/10/data-centers-emerging-risks-and-insurance-coverage-considerations](https://www.cov.com/en/news-and-insights/insights/2025/10/data-centers-emerging-risks-and-insurance-coverage-considerations)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG0AAAAYCAYAAADwF3MkAAABl0lEQVR4Xu2SgWoDMQxD+/8/vXFlHq6QbOUuK+vhB4HGfnK8do/HMAzDMEi+fs7wQXzsjxaL7/4DcC47HeivZB3ULHxrxcEaZrHHjsWSbODMqhxnH8fp6GZUvUA5u+qSbvlVnFmV4+zjOB3djKoXKGdXXdIt7xJznFnKcWc4ToWTPeN0+zt15byQH3EeZSf3ruDk8d0zONnsqDfZXXlYy2Cu86msArmPbpVzcfL47hmcbHbUm+yuPKxlMFf6Wc4SBrAfNbxjbRUnz/ZdpcridxIuezPfnc8Im3mg6k+uDGd3rCGdU/UC3JkdRdc/yE7nqzdxR0WXpewczhykc6pegDuzo+j6B9npfPUm7qjoshQ1HIPOcOZkql5QOWw+3g9YLWAzkOyoz0HU3DrCnHzH3hMU1GPYY06ATuUyMOfmHW/VwR0wi/dA1RE1k9V/yY1uOXYY6FQuA3Nu3vFWHdwBs3gPVB1RM1n9EtsHXgT3Ubup+i3Jv/yf/BdcAHeqdlP1W4JfSPXFvBvcqdpN1Yd/zPxowzAM9+MbBrGTexun4BIAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAZCAYAAABU+vysAAAAfElEQVR4Xu2T4QrAIAiEff+X3tjoh9y0blwxGn4QhJ56BZoVxeYcxFkKM4TRyDBDGI0E++2MRmJp8zeUEWQrI4xGpjdktClRPttCH8fcTRhspEWNKJ8NGxq5QFFXbM881kR31MtETZgH/NsIHibuQY3M1GYKnxqZ/q2F5wSs/miYxlitWwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAYCAYAAAB0kZQKAAAAgklEQVR4Xu2R4QqAQAiD7/1fuuifjW3kYXbBfSCYrs1ojM3mBxyJeh0X5naluCC3K8UFfH5E2wEXKqT9CFYttAcyljriKUrP5vbX4pKKCFHjeuV5m6GQvcDAMNUrTzZLo8LicwT1JaCpqqiJPe6nUKZYURN73E9TZpSl9CtmWeKIck5XwH6CJPDomQAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAYCAYAAACSuF9OAAAAj0lEQVR4Xu2SUQqAMAxDvf+l9UchhmSbrp1D9qBQm7h0sG1bLH7ObgphTXnCwQAX5uYprIVqcBi+kyFvhuHAzxZyYdMuhDUEF8bLKE8KtbCapnQ1L16ORWk6aZmXenf+bcZG9cNFy7zUu/PVrAsXjN8I+8PhAFfowZ71blwAF3qwZz2ElEOfkna7t0y3UDgHrQyFe93bwc8AAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAyCAYAAADhjoeLAAAFhElEQVR4Xu3X647kOgiF0Xn/l55RfiChPYAh6Vz7W5I1ZcAxdqX66Pz5AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADv8FcDAHAy/u4AD7P9KHX43Jtk54hyUc1TZX1WZ3jCGfWufT939vU0ejdX0+/H93FXT2+j9/eFO7yrb71Hf5939QTcLnv59UfyNlX/UezJon6jP2SexnR+hWrPrO8vmJ5L63V+tmy/6v36oiPnzNZ+4Q739r9nzaZat7cX4BOyl//tf2iq/qPYk0X9+vNl+Wp+hWrPrO8vmJ5L63V+tmy/6v36oiPnzNZ+4Q739r9nzaZat7cX4PWqF//NPwzfd3SGKPZkVb/Z96SxrO4sq71W+Tebnk3r7bvS+BmqPa7q4Sn2nHV1R6v8G+w9wxlrVnngczr/QVjln8z3HZ1D52eJ9jZZ3KvWm07N5ifqsrhn61e1q/ybHT1b5w6rfBb3ju7xRdOz/rY7nJ5jUt+5y80qD3xO54dxJf9jXY0OrbP55Bk/SffUeabTb6dm06nxtF7nmW4/X3b0/JP1WqvzDN/T/6b3Ma1/u+l5J/W8j0DiaT8O66czOrTO5pNn/CTdU+eZTr+dmk2nxtN6nWe6/XzZ0fNP1mutzjN8T/+b3se0/u2m553U8z4CiS//OKJzWezOc9vek/079auaVb5yVs9qsqZbdxV/R9XomtSavftM6u/2073q95ONyiqvJvWd/a+W9aN3Vo3MKq+m9RXt76znArusXqIqdwb/Yq/GSlYzecYZ9uzfqa9qsnjXGT1H+SiW6dbdaU+PkztQZ31PT3JFP9M9VvWa13llUnuVaU+T+s776PM6P0Kfo/O9frJH/GKrF0lzVh+t01w2rpLtFcWzHjWejS6t1Xmms09W041ltFbnmawfE+UtFg2vivmcxlZ5o3HNd03XRPXdvbVG55nV86Ncdi9RXGM6ohqjcR1RTRabmK5Z1ft81tskrnON6ejU6Kis8mpSv9pf89n8aDzLaawaJlsPjKxeHM1lL2SUy8ZVsr2ieNajxrPRpbU6z3T2yWq6sYzW6jyT9WOivMWi4VUxn9PYKm80rvmu6Zqovru31ug8s3p+lMvuJYprTEdUYzSuI6rJYhPTNat6n896m8R1rjEdnRodlVVeTepX+2s+mx+NZzmNVcNk64Fd9EXLXih9Ce3faPgao/Ofpj1E+2Wx1Xl83tN5JOtlk8W91fpodPOZqi6LR3Tf7Lka83P77NdG+ck8ik3mHdM11lc0MlU+i0d0v9VzfV7X6PD8XOu0XucW85+rsdeetbp31YfGqrl91mf5+aTGaJ2nc7XKq2n9xnrXoVZn1HWr+uizzaNY9FnnUR/AqfRl8y+95oy+tE+kfa1+XHee6er9rqRni+45+266c782q4nmmuvau+5Nsu/EVPdYrfOy7y1b231u5sjaDn1+Nffn1rjeSRQz1TxaH1nlM3vWdOhzo7n23L2jKBfF9HNWF8WBU/kXT19QHZYzT35htfdsWK25+kxX7nW16K6znNZoPMrbv51htUaf95tldxUNy5lVfTaMxqPh656o6jcaRmNaV+V1Hg2tiVS5O2i/qzMdGRuN6dAamxsfB063ekGjnHnyy6q9Z8NqzdVnunKvq0V3neW0RuNR3v7tDKs1+rzfLLuraFjOrOqzYTQeDV/3RFW/0TAa07oqr/NoaE2kyt1B+12d6cjYaEyH1tjc+DhwiS+/dG841xt6BPAt/N0BXiT6v4kv+Oq5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHuMfPcGLuyj3nwwAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABECAYAAAA89WlXAAAFQklEQVR4Xu3YW27kNhAF0NlWNpJ1ZP8/CQSMAs5NFUkpPf2wzwGETD1IyWq4Wc6PHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8Bv93VxdHQCAJ8uBLAezLg8AwJOthrFVHQCA36wbyPyfNQCAN9ENZd3AlvkunuVT5nKPrAMAfCvdMNQNSpnv4lk+ZS73yDoAwLewGoayNsa5NuMxd/57zI+6ONdnHwDAl7cagmb1zGd86NZnLuNTt/6Ku3vcXQcA8FCzoaTLn7Ke8SH3P+PszfjQ9V51d487awAAHm42zHT5U9YzPuT+3RCW8aHrveruHnfWAAA83GyY6fKHqpa5HNTO/2a+G8wyTtXazOU1qmpVDgDgpXJA2R1WqnrmZvtlreup7PafcfbmPXf3A+AD5Bd7fpnPasDj5e9ZF+fvZManzGUMwAfIgSy/zGc14PHy96yL83cy41PmMgbgQ6y+wFd14HHy9y3/aKqu3b5cA8AHmX15z2oAADzJbCiravlXev7FvvpLfiefe1T9AADfxmwYqmo5ROVAtRq0dvK5R9UPAPAtrIahrFUDVRWPuSru9h3/nf25H9eM73B2AQBvZnVAd/U83Ku+7BllPuPDbP2o6querer7nc77Vfesclc9Yo87/nK5nnD9+QOAf3WHfjdonLJe9WbPqcpXcdVXWfWc9d39HmV2r1lt19U9xnc6u1b+cLmedAHwU3dArw7vrFe92XOq8lVc9VVWPWd9d79Hmd1rVtt1dY/xnc6ulTxUXa7fdQHwU3dAzw7vKp+5MZ7VzjgHhuypVGuq5879V/UuN1P1j+uynvtmPOaq/kPGAMAXlQNBNRikqp651X5Zz95qTZrtXcXZn/fNa0f2jvFsr1WuWreKvyPv4GvwOQJ8YdVQcxgHpdkQlPGoy6fcY4yrZzitctW6rL+bVzxTdc/xva+uXXfW8KvZu88YgC+k+uI/dAfDKh51+ZR7jHH1DKdVrlqX9Xfzimeq7jm+99W1684afjV79xkD8IVUX/yHM5cHRB4Wmcvajlxb7dPFeY+s7Vyv9ojnubN2d03Xs7v+tNu/0/Md5XvJ+FDlAPgCdg/RRzjvNV786u47ufM+V2tWn9OsVtnt3+n5Trr3tpsD4IN1hwCvdfczufp57vTmnhmPzlpXP2R9jMf12Zeqeq7N+qvMnqXLp/y5Vj/jrAbAh/Gl/p7ufiZXP8+d3twz49FqiDhkfYzH9dmXqnquzfqrzJ6ly6f8uVY/46wGADzA3YP26iG905vDQXePzM36umuU8aHqzVxV61S1fKadnl3Zm/FMd68qd+j6AYAH2Tloc2iYXZ1Z7ZR7ZHzKXMaH3Wfq6lU++6ueTvZmfKru0fWu7LyDSremyh26fgDgQe4etFcP6VXvznDR9WR8GHPVmsP/yXc96cozH7I34yu6e8/Merva1XsAABfdPWivHtKr3p3houvJ+DDmqjWH/5PvetKVZz5kb8ZXdPeemfV2tav3AAAuunvQXj2kV72r+qEbQM54rHU94793+8941l8Z1+RVqfKz/plck3Gn6ls9w6oOANyQw8N47brTn/Leu8+RvdWaKs6+Knea7X2ocil7qv3GuOq/KvcfdflR/txX1gAAb+bOIX1nzafpBp0cgrJn1f8sV+91tR8AeKI7g8SdNZ+mG7JyAMueVf+zXL3X1X4A4M09e/j4BOM7efW7uXP/O2sAgA/gkP+vd3gnV5/haj8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8in8AFbLEuVTXV4EAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAYCAYAAACV+oFbAAABO0lEQVR4Xu2RgQrCMAxE/f+fVgZ2xMddm6iMTfNA6C53aRpvt6ZpmqZpltwLvyrVfMbzE8weml2WopLN+i7P7KGVhZFKNuu7PHxoXFJlYaSSzfouz1hKZcEx4/yqZ/RRYz3i7qKuPKeCA2aG5cOUX/WMPmqsR9xd1JXnFKjBMkPSwx5RY835HK6+6q0yZOZR/T9CNeN3xA3gNHUmKrsR72KduvJkcBnqrj9nVJ4dZeB3xDV1mjoTld2YPYK68mRwGequP2dUnp2lATi/uixzHt9Dc2dCfeZVqHmj7mBt5X+5yF26glnVh2flYU3BrPI5XUHfrO/A1Z2+w8GXAQGzqg/PysOaglnlc7qCvlnfgas7vXnCP66X/WXcQrls94uwxvrf4xbDpblfhDXWmzeIi+ylHkQv+UB62VfgAcxYTcENI/UFAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAS0lEQVR4Xt2PQQoAIAgE/f+nC4LA1ob0mAMeGnejzPoyYBANpgp6VregBXlckA9vxuCGAuRxcfVBOEoF8scn/SAaTBVSPG9SyoXfmbFbOsbu5iHjAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,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>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAYCAYAAACyVACzAAAA20lEQVR4Xu2RgQrEMAhD9/8/fceNCTmJTl3HyuoDIWZK22zbmqZpmiX4JKo58ELxvi2JF4j3bUm8IDoshRVEB0WwwuiwCBiKF5Dlz8Dtd/OC0URmniT6jjIdVoLMAThn7Yzyf1h3G+GLx779oQdPFw70PO6N0gL2ES0981BjIczb0UvmoELP494oLWAf0dIzDzUWwrxLeAcxLb143j7zUEdmkMy8nrsEHowXPyucR+2VoHWmojsC88pkL8HmUXslaJ2p6I7AvEepXGSqB9xN5Y9Vdl5B5eGVnWYGvo6fHPJ4XbZuAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAYCAYAAACV+oFbAAABN0lEQVR4Xu2RUWoEQQgF9/6XTuiPBlPU6zFhA7OMBULUcto1r9cwDMMwDJd8SZyg+19h0LH4CDoL00m+1ZlvWLfZSqd/e3hIg07yrc58w7rNVjr928NDVtKBO36tGazbbCX1d916t+E3x+v8oI6z6HqEezBuTV0yLcwfZM6m4yy6HuEejFtjS9Y8/Z3oOAt794p0VObGO/8pf/6GDaalmBsdZ2HfvyL5qb6wdyxnnOg4ig2mR5kbHWdh378i+am+sHcsZ5zoOIoNMt+keqXjLOzdK5Kf6ovOOx1ns92u/2PABmtOL/kWhP3kbeilmVNvc+qnesUc5gqX41DN6SXfgrCfvA29NHPqbU79VK+Yw/zR8Bh2sIXVLbd4PDyIHYY9Bp0KXfYfBQ9hB2GPQadCl/1hGIbhA/kG7GJkqj0uS4AAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAAAYCAYAAAAMLpqrAAACjklEQVR4Xu2T22rlQAwE8/8/vcG7ESi1rdvgxH5QgcBqtXrm2JyPj2VZlmVZlmVZluUB/lD4Ya7zfvvMZXk1v/2HaP0JzdSpN9O5Z+SJ9DfCb5LVG8juU+lqdgLz2BM/Z00Y72UL2exNnN7xZOdpsm+SzZ4gukuk30WVX82q/YpxRraQzd7E6R1Pdp4m+ybZ7Amiu0T6XVT51azarxhnZMZx2EOc3tHvnOw/QXbPt32v6C6RfhfVe4j0i2yvwu+OciJj9kP8bFpGpHOmdGoRUY7Beea98P5p3UWUlZ3Fu0xKQY/yql6Vmt9FdFbGxOvhzignMmaX54+blBHpnCmdWkSUY3CeeS+8f1p3EWVlZ/Euk1LQo7yqV6XmdxGdlTHxergzyuFFq2XOvD96NqJ830fP1itN0cmJdKJ0n3Fy1ik8t8rmzPujZ4P5HY/XFdSr/LuI7kk6Hk/kj/RvdC9leH9nV83ZG119kumhR+VcTHT2BnW1e4LldLO8v7Or5qpXmmKqX6j8Kdl+lZ+9p0qPKqVt/ILh1a6asze6+iTTQ4/KuZjo7A3qavcEy+lmeX9nV81VrzTFVL9Q+VOy/So/e0+VHlVKyySIdrze8VhvWvTs4Q9kkShT+X3P545feS6qc7uc7kY7vL+CHnWHyNP1V89Tsl11H08145y9R/n/4l+MrwncVRnsDerM6MzpU5oRzTKtM2N5D6FvAs85yeGuymBv0M8Mlqej+5nSTmB+lUtPVAZ1zi+y2X9DaSrgrspgb1BnRmdOn9KMaJZpnRnLewh9E3jOSQ53VQZ7g35msDwd3c+UdgLzq1x6ojKoc36RzZaXwI+kavkH34uqZVmWZVmWZVmWZVmWZVmW5dV8AvioSuDPrk9+AAAAAElFTkSuQmCC>
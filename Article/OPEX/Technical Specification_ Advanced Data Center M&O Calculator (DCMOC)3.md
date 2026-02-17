# **Spesifikasi Teknis: Kalkulator Maintenance & Operasional Data Center (DCMOC) v2.0**

## **1\. Ringkasan Eksekutif & Filosofi UX**

Alat ini bukan sekadar kalkulator biaya, melainkan **Mesin Simulasi Operasional**. Berbeda dengan kalkulator statis, sistem ini bersifat *bidirectional*: input CAPEX menentukan beban kerja awal, namun pengguna memiliki kontrol penuh untuk mengoreksi ("Edit Pencil") asumsi aset, yang kemudian memicu penghitungan ulang otomatis pada jadwal staf (Roster), stok suku cadang, dan profil risiko.

**Filosofi UI/UX:**

* **Visual:** Mengadopsi standar *resistancezero.com* dengan tema "Deep Blue/Glassmorphism".  
* **Interaksi Utama:** "Country-First Logic". Dropdown pemilihan negara adalah pemicu utama yang mengubah ribuan variabel di latar belakang (Biaya Tenaga Kerja, Regulasi Kepatuhan, Iklim/Filter Life, Kalender Libur Nasional).  
* **Navigasi:** Tabular Flow: *1\. Ingest CAPEX \-\> 2\. Asset Refinement \-\> 3\. Staffing & Roster \-\> 4\. Maint. Schedule \-\> 5\. Financial & Risk \-\> 6\. Reporting*.

## ---

**2\. Algoritma Inti & Input Dinamis**

### **2.1 "Country-First" Variable Engine**

Saat pengguna memilih negara (misal: Indonesia), sistem memuat variabel konstanta berikut:

* **Labor Rates:** Gaji pokok, tunjangan (THR untuk Indonesia), BPJS/Asuransi.  
* **Compliance:** Biaya & Frekuensi SLO (Sertifikat Laik Operasi), Riksa Uji K3 Listrik.  
* **Environmental Factor (![][image1]):** Indeks Polusi Udara (PM2.5) yang mempengaruhi umur filter (misal: Jakarta ![][image2], Singapore ![][image3]).1  
* **Calendar Data:** Daftar Libur Nasional (Public Holidays) untuk algoritma *Rostering*.

### **2.2 Integrasi & Penyempurnaan Aset (Pencil Mode)**

Sistem menarik data dari CAPEX Calculator, namun menyediakan *override* manual.

* **Logika Ingest:**  
  * *Input:* 1 MW IT Load, Tier III.  
  * *Auto-Generate:* 3 Genset (N+1), 4 Chiller, 100 Rak.  
* **User Action (Pencil Edit):**  
  * Pengguna mengubah "3 Genset" menjadi "4 Genset" (karena preferensi operasional).  
  * **Dampak:** Sistem otomatis menambah 1 baris jadwal maintenance, 1 set suku cadang (filter/oli), dan menambah beban kerja (man-hours) pada perhitungan staf.

## ---

**3\. Modul Manajemen Pemeliharaan (Maintenance Engine)**

### **3.1 Algoritma Penjadwalan Tugas (Task Frequency Matrix)**

Sistem menggunakan standar **SFG20** dan **ASHRAE** untuk menghasilkan *task list* granular.

| Aset | Frekuensi | Scope (Standard) | Durasi (Man-Hours) | Vendor vs In-House |
| :---- | :---- | :---- | :---- | :---- |
| **Genset** | Bulanan | Run Test (No Load), Cek Level Fluida 2 | 0.5 jam/unit | In-House |
|  | 6-Bulan | Fuel Polishing, Filter Inspection | 4.0 jam/unit | Vendor |
|  | Tahunan | **Pull-the-Plug (IST)**, Load Bank 4 Jam 3 | 12.0 jam/tim | Vendor \+ In-House |
| **Chiller** | 3-Bulan | Condenser cleaning, Oil analysis | 6.0 jam/unit | Vendor |
| **AHU/FCU** | Bulanan | Cek Belt, Drain Pan | 0.5 jam/unit | In-House |
|  | Variabel | Ganti Filter (Rumus: ![][image4]) | 0.5 jam/unit | In-House |
| **Fire** | Semester | FM200 Weighing, Nozzle Check 4 | 4.0 jam/zona | Vendor Specialist |

* **Logika Non-Concurrent:** Algoritma penjadwalan (Gantt Chart generator) diprogram untuk **mencegah** maintenance aset redundan (A/B) pada hari yang sama.  
  * *Rule:* IF Asset\_Type \== "CRITICAL" AND Redundancy\_Group \== Same, THEN Schedule\_Date\_B\!= Schedule\_Date\_A.

### **3.2 Suku Cadang (Spare Parts Inventory Model)**

Menggunakan model **Min-Max** berdasarkan *Criticality Matrix*.

![][image5]

* **Kategori:**  
  * *Critical Spares (On-site):* Controller UPS, Breaker Utama, Filter Genset.  
  * *Consumables:* Filter udara, Oli, Lampu.  
  * *Output:* Tabel biaya *holding inventory* vs biaya pengadaan ad-hoc.

## ---

**4\. Modul Staffing & Rostering (24/7 Precision)**

Ini adalah fitur kalkulator yang paling kompleks, menghitung kebutuhan manusia secara matematis.

### **4.1 Perhitungan FTE (Full Time Equivalent) & Floater**

Rumus untuk menghitung kebutuhan staf per posisi jaga (Seat) 24/7:

1. **Total Jam Setahun:** ![][image6].  
2. **Jam Kerja Efektif per Orang:**  
   ![][image7]  
   * *Cuti:* 12 hari (Standar Indonesia).  
   * *Libur Nasional:* \~15 hari.  
   * *Sakit (Rata-rata):* 5 hari.  
   * *Training:* 40 jam (1 minggu).5  
3. **FTE Murni:** ![][image8].  
4. **Floating Engineer (Buffer):**  
   * Untuk memitigasi risiko *burnout* dan turnover, sistem menambahkan **Ratio 1:5** (1 floater untuk setiap 5 shift engineer).  
   * **Total FTE per Posisi:** \~5.5 \- 6 Orang.

### **4.2 Generator Jadwal Shift (Roster Generator)**

Tombol "Generate Roster" membuat kalender 365 hari (Exportable to PDF/Excel).

* **Pilihan Model Shift:**  
  * *Model A: 4-on-4-off (12 Jam).* Favorit untuk *work-life balance*, mengurangi *handover error*.  
  * *Model B: 2-2-3 (Panama).* Rotasi lambat, libur akhir pekan bergantian.  
* **Visualisasi:** Kalender kode warna (Pagi/Malam/Off/Training/Cuti).

### **4.3 Struktur Organisasi Lengkap**

* **Chief Engineer:** 1 FTE (Day shift only).  
* **Duty Engineers:** (Jumlah Shift x FTE per Shift).  
* **Specialist:** BMS Operator (Dedicated jika Poin \> 5000), Security (Rasio gate/luas), Cleaner (Rasio per ![][image9] White Space vs Grey Space).6  
  * *Rumus Cleaner:* 1 FTE per 800 ![][image9] White Space (ISO Class 8 standard).

### **4.4 Analisis Biaya Turnover (Turnover Cost Logic)**

Menghitung kerugian finansial tersembunyi ("Hidden Costs").

![][image10]

* *Input:* Retention Rate (misal 85%).  
* *Output:* "Anda kehilangan IDR X juta per tahun karena turnover. Saran: Naikkan budget training sebesar Y untuk meningkatkan retensi.".8

## ---

**5\. Modul Smart Hands & Efisiensi Operasional**

### **5.1 Absorpsi Smart Hands (Revenue Offset)**

Jika tipe fasilitas adalah **Colocation**, teknisi shift tidak hanya menjadi beban biaya (Cost Center) tetapi juga penghasil pendapatan (Profit Center).

* **Input:** Jumlah Rak, Rata-rata Tiket Smart Hands/Bulan.  
* **Kalkulasi:**  
  ![][image11]  
  ![][image12]  
* **Impact:** Pendapatan ini dikurangkan dari Total OPEX Staffing di laporan akhir ("Net Operational Cost").

## ---

**6\. Modul Analisis Risiko & SLA Finansial**

Bagian ini memberikan justifikasi bisnis untuk memilih model maintenance yang lebih mahal (OEM/Premium).

### **6.1 SLA vs Downtime Risk**

Membandingkan risiko finansial antara Vendor SLA "4-Hour Response" vs "Next Business Day (NBD)".

* **Logic:**  
  1. User input: *Cost of Downtime* (misal $9,000/menit untuk Finance 9).  
  2. User select: Vendor SLA (NBD).  
  3. **Simulasi:** Jika part kritis rusak hari Jumat sore, NBD \= Senin pagi (Downtime \~60 jam).  
  4. **Output Narasi:** "Peringatan: Memilih SLA NBD menghemat $5k/tahun, namun mengekspos Anda pada risiko downtime senilai $32M. Disarankan upgrade ke 24/7 4h Response."

## ---

**7\. Output Pelaporan & Format PDF**

Laporan PDF yang dihasilkan bersifat modular dan dinamis.

### **7.1 Struktur Laporan (Halaman per Halaman)**

1. **Executive Summary:**  
   * Total OPEX Tahunan.  
   * *Dynamic Narrative:* Paragraf yang ditulis oleh algoritma. Contoh: *"Fasilitas Tier III Anda di Indonesia memiliki rasio staf 20% lebih tinggi dari benchmark regional karena penggunaan model 4-shift manual. Disarankan investasi pada BMS automation."*  
2. **Asset & Maintenance Register:**  
   * Tabel inventaris (Genset, Chiller, dll).  
   * **Visual:** Gantt Chart 1 Tahun (Zoomable di Web, Statis di PDF). Menunjukkan *Critical Path* di mana maintenance genset dan jalur PLN tidak boleh overlap.  
3. **Staffing & Roster:**  
   * Struktur Organisasi (Chart).  
   * **Roster Schedule:** Tabel kalender warna-warni untuk 1 bulan sampel (atau full year di lampiran) yang menunjukkan siapa yang masuk, siapa off, dan siapa *floater*.  
4. **Cost Breakdown & Analysis:**  
   * Pie Chart: Energy vs Staff vs Maint vs Admin.  
   * Analisis "In-House vs Outsourced vs Hybrid" (Side-by-side comparison).  
5. **Regulatory Dashboard (Indonesia Context):**  
   * Status SLO (Valid/Expiring).  
   * Jadwal Riksa Uji K3 (Tahunan).  
   * Sertifikasi Personil (Masa berlaku lisensi K3).

### **7.2 Fitur "Smart Narrative"**

Menggunakan *logic trees* untuk menyusun kalimat kesimpulan.

* *Input:* Lokasi=Indonesia, Filter\_Change=12M, AQI=150.  
* *Narrative Output:* "Lokasi fasilitas di area dengan polusi tinggi (AQI \> 100\) membuat jadwal penggantian filter tahunan (12M) **tidak memadai**. Risiko *overheating* tinggi. Rekomendasi: Ubah ke jadwal 3-Bulan."

## ---

**8\. Stack Teknologi & Implementasi UI**

* **Frontend:** React.js / Vue.js (untuk reaktivitas tinggi saat menggeser slider/dropdown).  
* **PDF Engine:** pdfmake atau jspdf (Client-side generation untuk privasi data).  
* **Chart:** Chart.js atau D3.js (untuk Gantt chart interaktif).  
* **Icons:** FontAwesome Pro (sesuai *resistancezero.com*).

Dokumen ini siap digunakan sebagai *Terms of Reference* (TOR) untuk pengembangan software kalkulator tersebut.

#### **Works cited**

1. How Data Center HVAC Teams Can Improve Indoor Air Quality and Cut Energy Costs with High-Efficiency Air Filters, accessed February 17, 2026, [https://cleanair.camfil.us/2025/03/10/how-data-center-hvac-teams-can-improve-indoor-air-quality-and-cut-energy-costs-with-high-efficiency-air-filters/](https://cleanair.camfil.us/2025/03/10/how-data-center-hvac-teams-can-improve-indoor-air-quality-and-cut-energy-costs-with-high-efficiency-air-filters/)  
2. Industrial Generator Preventative Maintenance Checklist \- GenServe, accessed February 17, 2026, [https://genserveinc.com/2022/09/14/industrial-generator-preventative-maintenance-checklist/](https://genserveinc.com/2022/09/14/industrial-generator-preventative-maintenance-checklist/)  
3. Erlang Calculator for Call Centre Staffing, accessed February 17, 2026, [https://www.callcentretools.com/tools/erlang-calculator/](https://www.callcentretools.com/tools/erlang-calculator/)  
4. FM200™ SYSTEM | Preventative Maintenance Checklist \+ Download, accessed February 17, 2026, [https://constructandcommission.com/fm200-system-maintenance-checklist-pdf/](https://constructandcommission.com/fm200-system-maintenance-checklist-pdf/)  
5. Data Center Staffing Levels: How Many People Does a Facility Need? \- Broadstaff, accessed February 17, 2026, [https://broadstaffglobal.com/data-center-staffing-levels-how-many-people-does-a-facility-need](https://broadstaffglobal.com/data-center-staffing-levels-how-many-people-does-a-facility-need)  
6. Data Center Physical Security Guidelines \- Open Compute Project, accessed February 17, 2026, [https://www.opencompute.org/documents/open-for-comment-ocp-physical-security-white-paper-1-pdf](https://www.opencompute.org/documents/open-for-comment-ocp-physical-security-white-paper-1-pdf)  
7. Data Center White Space vs. Gray Space: What's the Difference, accessed February 17, 2026, [https://blog.enconnex.com/data-center-white-space-gray-space-meet-me-room](https://blog.enconnex.com/data-center-white-space-gray-space-meet-me-room)  
8. (PDF) The Cost of Employee Turnover. \- ResearchGate, accessed February 17, 2026, [https://www.researchgate.net/publication/211392097\_The\_Cost\_of\_Employee\_Turnover](https://www.researchgate.net/publication/211392097_The_Cost_of_Employee_Turnover)  
9. UNDERSTANDING THE COST OF DATA CENTER DOWNTIME: \- Vertiv, accessed February 17, 2026, [https://www.vertiv.com/4a3537/globalassets/images/about-images/news-and-insights/articles/white-papers/understanding-the-cost-of-data-center/datacenter-downtime-wp-en-na-sl-24661\_51225\_1.pdf](https://www.vertiv.com/4a3537/globalassets/images/about-images/news-and-insights/articles/white-papers/understanding-the-cost-of-data-center/datacenter-downtime-wp-en-na-sl-24661_51225_1.pdf)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAYCAYAAADOMhxqAAAAOUlEQVR4XmNgGAXDAvzHgZHlUQC6QrwaMHRDAVka0G2CS2ADGBowBNAALnEUjfgwHKBL4MKjgPoAADPKMNB4uHyEAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAAAoklEQVR4Xu3R0QqFMAwDUP//p/XpQglJszkcys2BPqy2WzePIyIiPuksMar2sPgMNjCulZXeV1m5yErvq6xc5Hbvr7FGze+EM9T8LLaPhA/wd4+gitQwCj6iC0XVqHzH1rtNVV7BS7rosBpcO0P1biCVV/CSLjqsBtfOUD07qOq+PY3Nhmtnqh7/EIvd8Pxujtk8hQex2A3P7+aYzUdERETvAtJIn2F8cWPdAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAYCAYAAACldpB6AAAApklEQVR4Xu3RQQ7DMAhE0dz/0u2mtdAPA7YauY06T2IBgQQ7x2FmZrf0CLHqk9mfEJdfPUjWz/wWfAmQHaqS9TNPvQdjxPo3rezA/WO9xQv4u0tQDeqFCi+xi1kr/er9qq4fvKi6wkN2MeuKfuZDt5CqKzxkF7Ou6Gc+ZM1R9Wynbk/K+pmfxL+jYjd+v9qDdc5UswObs9iN36/2YJ0z1ayZmZmdPQEF5ahY1O0YwgAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK8AAAAVCAYAAAAww75mAAAB/klEQVR4Xu2SgWoDMQzF9v8/vXGDgFFlJ7mlVwYWBGpbeU63fn01TdM0TdMc45uNpvkv9I+3+VdcP9hxrB5Y72myt72TEztjBs8ud+99ir9815RZIGcz/wk+8YZT+079E09kPM3xN88COZv5T/CJN5za1z/eg8z+mOxX7juJe596Q9xxat+pt5/KeZKdN696v4xgW8CZOQM6OycjzjKfWdFhz04ku3sCy+Jb7FSeQWfnXLAeWO+CGfTszgxmpGRLbWbOgM7OyYizzGdWdNizE8nunsCy+BY7lWfQ2TkXrAfWu2AGPbszgxlL2PLRz8h8y6o861tv9Hed7PPAavPuYlmxthnv0InQHb0Tn0dtPdb06OxgeWXgiyx1ZMdnP7ub9VlbL8P8i2ofe3fJdkQ4M5/1IObf2WXQsUyrrXcX/S5V4IssdWTHZz+7m/VZWy/D/ItqH3t3yXZEODOf9SDm39ll0LFMq613F/0uVeCLjJqfV3xzLmI/euavZNKxz6TKGj2b71DdzbJtf/WdOB9YToU5Vmced2VuRekzdLagcjjjiQ6hZ307q86AtcH7WdYqzMiyZv04q7I4q5wVqpwBHfOtVzH1uGi2oHI444kOoWd9O6vOgLXB+1nWKszIsmb9OKuyOKucFaqcAR3zrVex6jWb8B9kp2mapmmapvkcP/aBmIQTgnHIAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAADgElEQVR4Xu3V7WrcMBBG4d7/Tbfoh8r08I4ke71kk54HzHo+NJJNcH79kiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJ+sdvJiRJX298nOt1xZ01r3jlrMlTc+565/58V3f2mv1X11E6A+NPl57hCSfzuHd3DsZ3PTWn4rnfsYck/Vj8aDJeeVdvktan3FVPzFhZzX/3P65udsrt3FlDnMH4O+je6St281b1Ve1VJ7NPegb2MZYkbew+nOkf1Myl2lDzXW933+H6Kc2eUp657v4Jq3lp39XZZszcStfLPOOBe7FnV0/Yw3hKs7veIdVWa1I+5ZJVX9qT8VR7u54ruHedzfu03yq/sqsnuzWsM05WzyZJP0b3sasxa8Mut7pnfKKec7WG9Xlff3m/msv6qrda1Wvt6v2pbk2aW5+Hv5TqXe9U59cccTb34Br2sYf900lPknq7PU/OxNodaT/+cs/qtJbs6sSzdPgMK6czJenH4Edv9yFnbpj51dphV99Zre/ilGfuSd3s+o54hnTfzdnp1p3ukXJVmtNJ9S7XzWV/qs31nJOc9NCVPWu9Sj2nVv1djfkU8+wTc3xWXjuz50rvSu3p+k/Pdsc7Z0vSX/zQ8OPHuGI8pNyQ8qvZlOrdep675lJ+/rJW1fW8Vro68905av6OtI7zuz14FmJ91TuwzrjqzsU1rPFMO6/2r/ZcPQPjK7p+zq2Yv7L/q/Xqyr7DrofP3PV3+Se8c7Yk/cWPDT9+u3hn9vC34twk1XkWxvU+7d+tSXvdlWatcuk8q/ur0jNz7/TLdTNf71kn1hkPnLnL7WakeEpzd9jXnWPE85pxyrN2ouvjnLRHvd/N6WLa1Sf2MabdOYf0XNXIzavGrHV93TUxlqS36T5E06rOeEr9jGuO+YTn4JoUd301X+up/1VpPvdhjjFzJ2dk/2pd15NiSus63T5VqnNdV0u51T6UchNncvar+Vrr7PqZX92nXuamlKt29YFn361hnXHVzeueL51h3nNOyjPHNZL0cZ76UNUPX7q+u6ef4RPf1+pMOsd399Xv72T/k56vUM+V3mX9m2WOMX+7nCR9lKc+UE/N+R+kfzhf7RPO9Aln+Kl8r5IkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZKkb+0P6jzDWQQMPTMAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQsAAAAXCAYAAAAcNmoGAAAC6ElEQVR4Xu2U0Y7kIAwE5/9/+k6sxMlb6jYmk51NLi6JB5rCGDSZ16tpmqZpmqZpmqZpmqZpmuY/4Y8YFXa8nbp3pvKOR5zMnVS9s/mNMx0776Xgfg7C9aOOYtf/UVQjlQYrztNQ78F3qjirvMKRPXfHvZXLHc5XuZrTozNx+WXhxWLGPFJxnoZ6D75TxVnlFY7suTvurVzucL7K1ZwenYnLLwsvFjPmk8pD3IWs/+wNqnD/Ts2qp+DenXPvirujyx3K53zi8ohzXH4r5mO5y8TcOcTVjLlymFfGLmof5ztk/XBNORM6mUvcHu6nR3/AtWxcgTN7WtXgWcrnfOLySFZTjQjXKmOb1eaYO4e4mmyWDvPK2EXt43yHrB+uKWdCJ3OJ28P99OgPuJaNK3BmT6saPEv5nE9cHslqqhHhWmVs4zaqnPMVFZ+OOnewm69469EMrOXquzyy059zXB5xjssH1b4G8R6VUSX6R/YrVjXcWuUOLidZjYlzzsq/UbnYalSgxxqqlsoGu/kKd/47sKarr3I1V57COcxjzVV9lw+yfYRnrUYV57u8wmqvW4t5xclQPfCNlDM4K/9GduCATalRgR5rqFoqG+zmK9z578Carr7K1Vx5CucwjzVX9V0+yPYRnrUaVZzv8gqrvW4t5hUnQ/XAN1LO4Kz8i2zR5ZGKE4m+uyRz5Qx2c4fyOa/g6hy9i5orT+GcmLt6We5Q/qdxPbh8hXuHiFuLecXJiD24nlY52c2/iIeooaCTuYQea6zGZDd3ZE61xoRnq/1cU86ETuZO6E6fWZZXnYnLPw37yPpZrQ92HedzTTkZymctVfes/B8UOBR0MpfQY43VmOzmjsyp1pjwbLWfa8qZ0MncCd3pM8vyqjNx+adhH1k/q/XBruN8riknQ/mspeqelf8al2iiaV4X+igW3KXPt+A/1SMu3dyCK/8O+b084rvhZR9x6eYWXPl3yO+lv5umaZqmaZqmaZ7GX1S0t3PywYGaAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAAFVElEQVR4Xu3Wi6rzNhBF4b7/S7e4IBgWeyT5Ejf5uz4w1lx0ceIczl9/SZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSdKr/mZCP+UT398n1pT0ef529arjhRvXm+q+vJJZbdjpqWa9Z9faxTVX+6TPZdb/tnq+ek7GV9yZu2v2uabzM35Ct2b3uV51Zy6ls63M+ma1u3jWs+funJl/pvcT+NzpPDXX9Twt7bM65647cztck7H0iv/qxeO+jA8jl2rVmfrsj8Hufk/pzpLyKfcNeCbGVzyxxsr4PLlXjWe1T0l7pHMmqefOXGIP407Xl87GONnpqbjP2fkV15o503vW2XVn/awx/pT0+TA+K635KW/tI/3rzZe7SvsyPqRcsupb1YfdvieMvbhnl/9G/B5/4cxDd1Y+D+NP6tbv8rTbl1yZuztnt++w03u2h/2Mf9GZZ+B7vHKm9y7uxfib/dJZ9QdIL1z34675bryr9qe5Y81ubea69dI6nHtIfU9Ka3bnSeeYxaxVKc9+xiO3g+t0uMeImR81xsztWM3p9q9SnfFVXCftNdQ8e+pzcA3GMzt9q55uv5Gbna17hmRVp65/tifjQ9c3ct14OFNf2e07zHpZG2fYOeu4p/ouzuU6rFesMR5qvhtXXT7Z7ZNu48vWvfzpBef4jDF3NY/1bs+6Xlo3nTmZ1Q7co9uPUr2eaZYbWKv7pjOwP41XPStjjbT/gfm0Z5er9zFOewzsXbnak3JXcB3GCXtmcfoMZ3b6xncwLtbqOMWcyzUOKUc7PVXq5xnSubrc0PVd6a1SjnZ6hq435Xnmu8+yI+3BmOtzDu9jzJj5rmeM07pVl5cex5eNLyt19dQ7k34EXIM/pJrjPPZVrDEeVuvcwXV5/i5XMTfrT7WdHo5XVvOOXL1YS2rvan1K++xIc1LukPJ8Tl4J84x31Dnd/Fl+dq2wpzvLbD3mGQ88G6+ZVU+qjdysVtVcNx66ejce6vOma4Z1xlV3jp3xGWkNrpV6aszcYTWn3jlm3I2rLi89ii98iqmrp94O9xk5Yi7NO4zcqt7FQ5evxh7pmmG9xvX8zNU45dKYcVq/xlybfZ00bxZXq9q4c70VzpmZrc24mtXO4DqMB+a7c7PvcPXzSFjn3ow5TvNTbsdu32HW253hzJkP3fPu9s7GnZ2eQzrHbK9U4xrd+AzOS3swptTTnXnk6j2NGadx1eWl22YvYPey8j4wz3on9V3JpX3P5qqUewrX5llm8cil+8A872fGaf8k9TDXxcxXtYdnq3dKvTNdP+eu4qu4DuOBeX4+/FzSs3CNZNXDOvdhzPzq3uWSVb2a9aba1TPXOK3BcY27/pk7fTwTY46Z45wrOD/F3HeWr2Pex5hzR37cWWct6fLSbfWlTC8a6+nlZZx6E667mpfyaQ7HnMcc60OXf8JYOz03z8Z6zde4SvVZrpvf1auub5VjvsM+XrtWvd2a3C/Vn5DW4b6p55B6Un/KdVZ9ac+K9XquWh8Yd7lkp+eQzlOl3KGbx3jkUrzby372dFZ9dT1eVYq7Pl5XdPMZH7jf6GE8MJf6zszhnkmXl74eX3T+GM64Ou+qt/d7Q/dMXb7id7gz5wlv7XPFN5/trl96tl8661m7z7bb91/g3403/3686U98JumUt3/cb+/3ael5ao61b/Gt56p+4Yz6PX/yPzV/Mr8v/e+9/SN4a7+39jmkP/4p901+4XxP+8Sa+k2+C7/F70uSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEnS1/oHUyhG8jYISPEAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAAAYCAYAAAAh+eI4AAADbElEQVR4Xu2U227dQAwD8/8/3cIPG6hTUtL6guO0GkBAliK1sp3k62sYhmEYhmEYhmH4j/hFYRiG4S7mH8wwvITjj5G1C/PVrLs8jo6f88/c8wm4b1UO+jJvRXeG83TzB3ft/BS7e/F5qiy9VS2o310S13C6w/mpq2W4pPIcOD3S8SjOZD4N35ui6mX9Hbpz7rjzav5JOt8kQt+ZfObN5u3oPEeU/xvXcLrD+amrZfgSlOfA6ZGOR3Em82n43hRVL+vv0J1zx51X80/S+SYR+s7kM282b0fnOaL837iG0x30u0udHnEep0c6nsjy72Tegts56s5zcOdzd+fcceeZfOc7V/2MmN2ZQ19nz4jyxnM2b0dX56Up/x/EJUpzgyzPe9R9Sjtw+iLrOTozVWU9+g6cfgXO7Mymt8rQ5zLxTJ+rhdIIs5U/Qp/LK61LzN4xp5uP/rPZDpy/k/0r1A4asjzvUfcp7cDpi6zn6MxUlfXoO3D6FTizM5veKkOfy8Qzfa4WSiPMVv4IfS6vtC4xe8ecbj76z2Y7cH47G01bwYQs7+Zz8czjyHoON1Pp3M39vKA/6nfAOequjMqvetTiM8Z5arY6Z35H17fI/Nz7DMxembebVX6eHSrroK+ddSand8iybrGodzyKrKdY81RO6TxHdvxO75Ltvej0HXE+i0TdeRZVL+sfdDwKPoOb43QH56nqsOuPqBzPDpV1ZL50jms4vUOWdctEveNRZD3FmqdySuc5suN3epds70Wn74jzWSTqzrOoeln/oONR8BncHKc7OE9Vh11/ROV4dqisI/Olc1zD6RmdF+X6Ue94Ik6PKA/PC/cc8ex+jlCPM9X8Lp1s5cl6C+epniOer/xM1F0dXGbNY11lZ47zOZ3s3EV2spkvncOX68xZb7HrcX72lCdS9Q84q8rQx4rwvKDOGexnMFdVRdejKpJpmR57SlN0PJ+Cz6Z2VTr9ykPoY2XQy4qwV5WEJmfOeotdj/OzpzyRqn/AWVWGPlaE5wV1zmA/g7mqKroeVZFMy/TYU5qi4/kUfDa1q9LpVx5CHyuDXlaEvapu4bZBN/G2fXbhR1L1BE/NfZIn38fwYd76cd+401t5+p/WE/zEnYcTvPUjv3Gnt/IT/1h/4s7DP8T84g3DMAzDMAzDMAzD8FZ+A6Nq7T36ReabAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAAAZUlEQVR4Xu3SQQrAMAhE0dz/0i1dCHbyDYYmoQsfuIiiQ6GtlbcLajk6rO/PjoR4FLiUP74taGuI/lldgA6zNUWXszXFL9EBfT+oN3QkxESL1Kdeii7SVxmbRfOQLoyO/DuklMJuqHxSrnu+oD4AAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAAFJ0lEQVR4Xu3W227jOBBF0f7/n56BHgpT2HOKpBzbidN7AYJYF14kK0D+/JEkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSTf8w4T0RembSrnf7G973r/G9cP2SxnfU3pfjN9hdZ7ktO834rtK7yHlXoVn4fWoO3Pv9L5C2j+9h9SXsI/xI3ieZ6x5Ytoz5U6dzN3V73jWOqdqv+nddexZ9d5xsg733PXf9ez19M2mH3TK7zw671OkP6qUezfuvzvTqnbXM9d6xN3907th/C7cdxd/ktOzs49xmfLvxDOkb+lV0j4pd6rmpjVS7q6+xjPWu4P7MSbWn/G7ns5/xl4rr1xbb7T6UJifeitX9anvt0jPxnfQpdyl53t96t/hnBRzn2nM3p5POdZ6PI27qWfqp5OebtU/7ZnyzE3jO9K82of79dqdHM859abaZcrTIz2rtXfnvjDPmFhjTKxzfcbMTWPGrFWOen/dU1/CuYVxqbW5V9qTNc6hKX+Z8iucw3in9/MZupTvz3pi15f2uKR8yl1STh/m5EfkBzCNS8r9NPVM6dphf83hPY3ZM91rfHKeks7U8z3ueV7sSfeTMdeb1mDMPHuSXZ1qzX5Vvt/LdMZ+T7mTs9PUn9bc7V04t1+93secU6Zxsqtf2MN4Z/ccHCdp/qT243sp01rsX40Zp3GZ6qmXpv40l7mKV/NYY7wbdyc9dHLGUuebzpnuu75pL1r1pT36eJcrKacPc/IjsocfCGOqHvZ+qvQM0zuYxqVyvHN8Ypqb3n8fJ1ON665MvRzzbJVP445z0zqTXQ/rjLt0Vt5Prc6f8mnvKb5M52J8Sb3sS/HqSphnfFmtMeV6PvXQSc+FfYwL86t4GjNm7ZJyF76DJK2d5qS1Uv/Uw/EUM0cnPZTOcHeNC+dMMe8n2JvOnMZpHnNlyuuDTD9i/+jYs4p3Nda/S50lXTupp3J9Da7Heal31b8yzWW+rOopd2E+9XRT72rvkvpXTnrKat8L64w71iruz3jH1M99Uo5j9l/Sue72doxpV7+wh3GZzpH6WU89dNJzYV+K056reBpTqqVcWdUu3Ded+5LyFXON7rRWUq5L59hJZ+AajIn7Mu65aY/JtFbduW/H+pS7pJw+zPQjTh9J/xjS3Kk2rVFxz6cr1StXUq3XX4V79hzPN91P+lc4j3E31XknzpnW4bjH071wzcr1e7KqUepNZ+93zmFPjftVuX7fmfpSnufa7ZvGac40TvvtPNLDuEx73zn/5KSnsId79bVY66baaV9JuQv3T1hn3LHWn5M5xuks0zz2lZOelX4GzmdMqc7z9Kty/T5Jda5d97Tmbn5JOX0gfmz8Ye/kGRfmKu53rtPHU8z5vJ6Ja6c9mGPvV/sp9TLHq3oK91ntybXSeqs4zUu5rtcmu/qFe3HfssrtainH/oT9nMO4THMYV66PK36kN81JHu3hPmm/Xa2PWe9YY9yl/XgOXuzp8arGfHm0Rqm3z0m1Kcd6t5o3xTTldziv71f31b4l1ae5Pc8asTfNWeWmfDLlpf/hx1Jxz6cx79OY619S7ic6OWf9IfZL//kJ72N3Bv5+u/6f7uT8Jz2X074Tn/5uX3F2fnev2OMnSs+Zcq/E9/4d7//d+0m/znf84eq5/rbf8JXP+9V1X3m2d6nzP/Is3/XPgH42vwdJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJT/UvvqSDtYw5/h8AAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAADMUlEQVR4Xu3W2YrjMBAF0Pn/n57BDwJxqZLlHiftdJ8DJqpFiyFE+fMHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+MX+ZuIhnnouAArHj/Z43mHeL5/fJN89n7lv/vxOecY8652urJ3nuTL3Dmd7Zb07X5e/aneN3T4AHuRdP97zPt34p8t3XcVjnD07vjJnR6575Y/GTl/1/juyN+NXWe2Tte7duvFXXJl/pReAb3blwv0fucedl9QnyXc9iw9VbuVq/xW59u73Z6fnkN+Lr8wbcebeLffPd6vGVfwq79oHgBvkj3Z30c35bnzFak6uOeLMz7WU+W7+ocrnnlm/S7fuvGf1HrPsPTtzla9ylezLfTKec905O2f1WdWXe835jPMze4asVT2HLj9U+3fxodqzOkuu29WGKgfAA+UP/DzuLohqfFU1Jy+Vao8uN+yuMeS46s/xMPdXz45V3845qlr2VKp5O87esTvDKs7a0OUrVe9qj6zN585aNR5x5oZVPtfM3oyHPOdslc/cbFUD4EHy8qjGQ1evele6S2Tkq3rGh67v6hrVOOOs3WW17qjl55Dv2vV15jm7sj/jQ7VuxkPVe6hyK1X/nMv6qjZUZ8tc1ocuP6zWyHjYmdPlO2d1AB5gvnx2LqKuXvWuVP25/2y3ttvX5ap6NR7G/O7ZseobtW7NKneocpVu/kr2d3GXn+Pd3h05J9+tqlfjEXdnO5zVD1W+2zN7Mx525nT5zlkdgG/S/ejPl9CIq88h81lf6Xozv1q7OmuO5zjzhyNXzc38yL3Cat3q7Nlf1fKzUs3bkb25zrx31uZ81rozZ9zJvitxjru4WiNzQ5XPdatxFQ87c7p856wOwDcZl0x12WRt94LI3k639tDVz3q7/Nkah+wffVXuTrl+7pG16lwZz2tkPKvyVW52tk/3zOZc9p3lO9m7mpM91Z4Zr/JzLnW5nL/Kz7JejbuejGcZA/AL5KVRXRCf4lPP/VPld+oTvlvOBwAv9Al/Bni+p3+Hnn4+AGiNS8yfNu7w1O/QU88FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAH+AdMmX2fCM2CswAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAkCAYAAAA0AWYNAAAC60lEQVR4Xu3WUW7jMAwFwL3/pXfhDwHEAyk7qdut2xnAiERStJwAVv78AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAj/k7XHe5u9939lnf4U7eM6/fJJ/9I99Drjnrlfc7q3/XZ/UF4IHuPBDu6vMkX/nM9V75u33lPv633XPn/Iqp31mvzOdvAgBvywPlzkPmrj5Pced3dybvczb/yXZ/qnL+qlfWd7VdDABelgdKN88Dcc2z9jDls0+N1avK2NW6pcanmjtN/bv4tLfpGc/s6rNfvUe3bopd6ZHzJeu7mkMX72KTqXa675rXzxx36zpZk+u63mv8rm5/2bsbA/Aw9YU/vfRzvltTx7U+41NuGtd5NdXVz4yluqfuuqqr3e0jY3V912unq+967vbw6nzqkbH8zHG6WteZ6qeeH9lnWr3qVXM57u79qq7vGue8GwPwENPLezp4Vq5+LtOhMI1z/uo455k7nOXv1PWfvqvDbm853zlqu/oV7/I5XzL+To9Dl6uxLl9197vibE327erP8pOptn5/9f5T/TvOnmuXA+Cby5f8MsWX7sDJNbWmi3fzK2tynPN0lj+sPtN1RVdbY5k77PaW852pdhefcoe656muy+2e53CWr7r+V0xrar+zfZzlJ1Pt9Cxd7FVXn2uXA+Cb2724M7c7FNahsctlPMd1Pq3J++zq6ueS9R/V3bvKvXafS9crayZTXcbP+nb5rO1qlm5dfi45r7o+V3X1Ryx7Tvs6ZO1Vu9qu566+yv0vGd89V9YB8ADrxZ4v/GqqyXE3z3UZm+JV5uqaKmtqvqu903TfaqrJ+sxlfSd7Z/2Uy7ol62osc1m37Oq7eOpyXSxl/1yTuZXfzfOaXKnLmrzOTLXZJ69aU8fZBwBGDo1zeQA/9Tt76r6r/B3ufKbse3d/AHiLA+n38FsDwIM5yH++9fv6rQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4Af4B9+raLREgJG8AAAAAElFTkSuQmCC>
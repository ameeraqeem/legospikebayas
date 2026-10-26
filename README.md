# Kawalan Robot SPIKE

App untuk mengawal robot LEGO® SPIKE™ Prime melalui Bluetooth dari iPhone/iPad. Ia boleh:

1. **Sambung Bluetooth** terus ke hub (tiada laptop atau gateway).
2. **Pandu gaya dron**: kayu kiri untuk depan/belakang, kayu kanan untuk kiri/kanan (dua jari serentak). Kelajuan 10–100% (🐢–🐇).
3. **Motor fleksibel**: hub mengesan sendiri port A–F. Boleh guna lebih dari satu motor bagi setiap sisi. Motor ke-3 menjadi **Lengan** (butang ungu Naik/Turun) untuk penyepit/pengangkat.
4. **Sensor jarak (ultrasonik)**: papar jarak halangan, dan robot **berhenti automatik sebelum langgar** (jarak boleh diset di Tetapan).
5. **Sensor tekan**: bila ditekan, boleh IMBAS warna atau hentikan robot (pilih di Tetapan).
6. **Butang IMBAS**: bila robot sampai di kad warna, tekan IMBAS. Pautan warna itu dibuka. Disokong 10 warna SPIKE: Merah, Oren, Kuning, Hijau, Biru Muda, Biru, Ungu, Merah Jambu, Putih, Hitam. Pautan ditetapkan di tab **Tetapan**.
7. **Pautan dibuka dalam app**: video, kuiz atau Google Form dipaparkan di atas skrin kawalan, dengan butang **Tutup** besar. Robot kekal bersambung. Ia tutup sendiri bila video YouTube habis atau Google Form dihantar. Kuiz buatan sendiri boleh menutupnya dengan `parent.postMessage('spike-robot:close', '*')`.

```
iPhone/iPad (pelayar Bluefy) ──Bluetooth LE──▶ Hub SPIKE Prime (firmware Pybricks)
   app ini (web/)                                program hub/robot_control.py
   • arahan  D kiri kanan / S / M port…          • motor kiri + kanan
   • terima  C warna / B bateri / E ralat        • sensor warna, watchdog 600 ms
```

---

## 1. Persediaan hub (sekali sahaja, di MacBook)

1. Buka **Chrome** di Mac dan pergi ke <https://code.pybricks.com>.
2. Pasang firmware: klik ikon ⚙︎, pilih **Install Pybricks Firmware**, kemudian ikut arahan (perlu kabel USB). Untuk kembali ke firmware LEGO, sambung hub ke app LEGO SPIKE.
3. Pasang program kawalan:
   - Buat fail baharu di code.pybricks.com.
   - Tampal isi `hub/robot_control.py`. Kod ini juga boleh disalin melalui butang **Salin kod program** dalam app.
   - Sambung hub, kemudian tekan **Run ▶**. Program akan disimpan dalam hub.
4. Tekan **Disconnect** di code.pybricks.com. Hub hanya boleh bersambung dengan satu peranti pada satu masa.

**Jenis robot (tab Tetapan):**

| Jenis | Motor | Kayu kiri | Kayu kanan |
|---|---|---|---|
| 🚙 Kereta 2 roda | roda kiri + roda kanan (+ lengan) | depan/belakang | belok (satu roda laju, satu perlahan) |
| 🏎️ Kereta stereng | motor tolak (belakang) + motor stereng (depan) | depan/belakang | pusing stereng |
| 🤖 Humanoid | 2 motor kaki + motor tangan | jalan depan/belakang | pusing badan |

Untuk kereta stereng, luruskan tayar depan **sebelum** sambung robot. Kedudukan itu dikira sebagai tengah. Sudut stereng boleh dilaras di Tetapan.

Butang **Uji** pada setiap port memusingkan motor itu sekejap, supaya mudah tahu motor mana di port mana.

**Port:** tidak perlu ditetapkan dalam kod. Hub mengesan semua peranti. Susunan automatik: 2 motor yang sama saiz = roda/kaki, motor lain = lengan/tangan (hub kenal saiz motor melalui ID). Untuk kereta stereng: motor besar = tolak, motor kecil = stereng. Boleh diubah di tab **Tetapan**.

---

## 2. Letak app di internet (HTTPS diperlukan)

Bluetooth dalam pelayar **hanya berfungsi pada alamat HTTPS**. Cara paling mudah ialah menggunakan GitHub Pages:

1. Buat repo baharu di GitHub dan muat naik **seluruh folder ini**, termasuk `.github/`.
2. Pergi ke repo **Settings → Pages → Source: GitHub Actions**.
3. Setiap kali anda push ke `main`, app akan dibina dan diterbitkan secara automatik di `https://<nama>.github.io/<repo>/`.

Alternatif lain ialah Vercel. Tetapkan Root Directory kepada `web`, dan tiada tetapan lain diperlukan.

---

## 3. Guna di iPhone / iPad

1. Pasang **Bluefy – Web BLE Browser** dari App Store (percuma). Safari dan Chrome di iOS tidak menyokong Bluetooth web.
2. Dalam Bluefy, buka pautan GitHub Pages anda.
3. Pada tab **Robot**, tekan **Sambung Robot** dan pilih *Pybricks Hub*. App akan memulakan program hub sendiri, dan status akan bertukar kepada **Sedia**.
4. Pada tab **Kawalan**, tekan dan tahan anak panah untuk bergerak. Robot berhenti sebaik sahaja jari dilepaskan. Butang merah ialah STOP.
5. Pada tab **Warna**:
   - Isi pautan bagi setiap warna, kemudian tekan **Uji** untuk menyemak.
   - Tekan **Buka tetingkap pautan** sekali sebelum mula.
   - Selepas itu, setiap imbasan warna akan membuka pautan di tetingkap tersebut, manakala app kawalan kekal bersambung.

Di MacBook, Chrome boleh terus digunakan, termasuk melalui `./scripts/start-web.sh` (localhost dikira selamat). Papan kekunci juga boleh digunakan: anak panah atau W/A/S/D untuk bergerak, dan Space untuk STOP.

---

## 4. Ciri keselamatan

- **Tahan untuk gerak:** robot hanya bergerak selagi butang ditekan.
- **Watchdog 600 ms di hub:** jika app senyap (iPhone dikunci, Bluetooth terputus), motor akan berhenti sendiri.
- **Berhenti automatik** bila app ditutup atau bertukar ke app lain.
- **Sambung semula automatik** sehingga 5 kali jika sambungan terputus, kemudian program disemak semula.

---

## 5. Penyelesaian masalah

| Masalah | Tindakan |
|---|---|
| "Bluetooth tidak tersedia" | Buka app dalam **Bluefy** melalui pautan **https**, bukan dalam Safari |
| Hub tiada dalam senarai | Hidupkan hub; putuskan sambungan dari code.pybricks.com atau peranti lain; pastikan firmware Pybricks sudah dipasang |
| "Program kawalan: Belum dipasang" | Ulang Langkah 1.3. Jika program lain sedang berjalan, tekan **Cuba mula program** |
| Robot berpusing bila tekan ke depan | Tetapan → hidupkan atau matikan **Terbalik** pada satu motor |
| Robot bergerak ke belakang bila tekan ke depan | Tukar **Terbalik** pada kedua-dua motor |
| "Motor E: Tidak dikesan" | Semak kabel, atau pilih port yang betul dalam Tetapan |
| Pautan tidak dibuka sendiri | Tekan **Buka tetingkap pautan** semula. Jika tetingkap ditutup, app akan papar butang **Buka** setiap kali warna dikesan |
| Warna salah dikesan | Jarak sensor ke kad ≈ 1 cm, dan elakkan cahaya terang terus |

---

## 6. Ujian yang dijalankan

- **Program hub:** 6 ujian (`cd hub && python3 -m pytest tests`) menggunakan modul Pybricks tiruan. Ia meliputi arahan pandu, had ±100, arahan rosak, watchdog, tukar port, port bertindih, dan penapis kestabilan warna. Kod juga berjaya dikompil oleh `mpy-cross` MicroPython.
- **App:** diuji hujung ke hujung dalam Chromium terhadap hub tiruan peringkat protokol Pybricks. Ujian menggunakan bait sebenar `0x01` START, `0x06` STDIN, dan event `0x00`/`0x01`, termasuk stdout yang dipecah-pecah. Aliran yang diuji:
  - Sambung, program dimulakan automatik, dan konfigurasi `M E F 1 0 C` dihantar.
  - Tahan ke depan menghantar `D 50 50` berulang setiap 150 ms; lepas menghantar `S`.
  - Pusing kanan pada 100% menghantar `D 60 -60`.
  - Imbasan merah membuka pautan di tetingkap kedua.
  - Bila tetingkap ditutup, banner "Buka" dipaparkan.
  - Jarak masa ulang berfungsi.
  - Sambung semula automatik berfungsi.
  - Keadaan program tiada dikesan dengan betul.
  - Tiada ralat konsol.
- **Belum diuji:** hub fizikal sebenar dan Bluefy di iPhone sebenar, kerana tiada di persekitaran pembinaan.

Sumber protokol: [Pybricks BLE profile](https://github.com/pybricks/technical-info/blob/master/pybricks-ble-profile.md) · [Pybricks: komunikasi dengan komputer](https://pybricks.com/projects/tutorials/wireless/hub-to-device/pc-communication/)

LEGO dan SPIKE ialah tanda dagangan LEGO Group. Projek ini tidak bergabung dengan LEGO Group atau Pybricks.

---

© 2026 ameermustaqeem. Hak cipta terpelihara.

# Ritual Infernet DApp Starter

Starter ini berisi frontend statis dan contoh contract consumer untuk membuat request compute ke pola Ritual Infernet.

## Isi project

- `index.html`, `styles.css`, `app.js`: UI DApp untuk connect wallet, kirim prompt, dan baca hasil callback.
- `contracts/RitualInferenceConsumer.sol`: contoh smart contract consumer.
- `scripts/serve.mjs`: static server kecil untuk development lokal.

## Jalankan frontend

```bash
npm run dev
```

Kalau `npm` belum tersedia di PATH, jalankan langsung:

```bash
node scripts/serve.mjs
```

Buka `http://localhost:5173`, connect MetaMask, lalu isi alamat contract consumer yang sudah kamu deploy.

## Deploy contract

Contract contoh memakai interface coordinator minimal. Untuk deploy sungguhan, sesuaikan `IInfernetCoordinator.request(...)` dengan SDK Ritual Infernet yang kamu pakai dan alamat coordinator untuk testnet/jaringan EVM target.

Langkah umumnya:

1. Install Foundry jika belum ada.
2. Install SDK resmi Ritual:

```bash
forge install ritual-net/infernet-sdk
```

3. Ganti interface minimal di `contracts/RitualInferenceConsumer.sol` dengan import dan call resmi dari SDK.
4. Deploy dengan constructor:

```text
initialCoordinator = alamat coordinator Ritual/Infernet
initialContainerId = bytes32 id container/model yang dijalankan node Infernet
```

## Catatan Ritual testnet

Dokumentasi publik Ritual menyebut Ritual Chain private testnet/early access, sedangkan Infernet adalah jalur yang tersedia untuk membawa compute AI ke smart contract EVM. Jadi untuk benar-benar live di testnet, kamu butuh salah satu dari:

- akses early/private testnet Ritual Chain, atau
- jaringan EVM yang didukung Infernet + alamat coordinator + container/model yang tersedia.

Kalau kamu sudah punya RPC, chain ID, coordinator address, dan container ID, masukkan detailnya ke contract ini dan frontend bisa langsung dipakai.

Lihat `deployments/example.json` untuk format catatan deployment yang bisa kamu isi setelah contract live.

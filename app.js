const CONTRACT_ABI = [
  "function requestInference(string prompt) payable returns (uint256 requestId)",
  "function latestResult(uint256 requestId) view returns (address requester, string prompt, bytes output, bool fulfilled)",
  "event InferenceRequested(uint256 indexed requestId, address indexed requester, string prompt)",
  "event InferenceFulfilled(uint256 indexed requestId, bytes output)"
];

const state = {
  provider: null,
  signer: null,
  account: null,
  chainId: null
};

const POLYMARKET_MARKETS_URL =
  "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=6&order=volume24hr&ascending=false";
const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,chainlink,near,render-token&order=market_cap_desc&per_page=6&page=1&sparkline=false&price_change_percentage=24h";

const els = {
  menuToggle: document.querySelector("#menuToggle"),
  mainMenu: document.querySelector("#mainMenu"),
  connectWallet: document.querySelector("#connectWallet"),
  walletStatus: document.querySelector("#walletStatus"),
  networkStatus: document.querySelector("#networkStatus"),
  accountStatus: document.querySelector("#accountStatus"),
  requestForm: document.querySelector("#requestForm"),
  contractAddress: document.querySelector("#contractAddress"),
  prompt: document.querySelector("#prompt"),
  sendRequest: document.querySelector("#sendRequest"),
  readResult: document.querySelector("#readResult"),
  requestId: document.querySelector("#requestId"),
  txLink: document.querySelector("#txLink"),
  output: document.querySelector("#output"),
  refreshMarkets: document.querySelector("#refreshMarkets"),
  predictionList: document.querySelector("#predictionList"),
  predictionStatus: document.querySelector("#predictionStatus"),
  marketUpdated: document.querySelector("#marketUpdated"),
  refreshCrypto: document.querySelector("#refreshCrypto"),
  cryptoList: document.querySelector("#cryptoList"),
  cryptoStatus: document.querySelector("#cryptoStatus"),
  cryptoUpdated: document.querySelector("#cryptoUpdated")
};

function setMenuOpen(isOpen) {
  document.body.classList.toggle("menu-open", isOpen);
  els.menuToggle?.setAttribute("aria-expanded", String(isOpen));
}

function requireWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask atau wallet EIP-1193 belum terpasang.");
  }
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerTxUrl(chainId, hash) {
  const explorers = {
    1: "https://etherscan.io/tx/",
    11155111: "https://sepolia.etherscan.io/tx/",
    84532: "https://sepolia.basescan.org/tx/"
  };
  return explorers[Number(chainId)] ? `${explorers[Number(chainId)]}${hash}` : "#";
}

function setBusy(isBusy) {
  els.sendRequest.disabled = isBusy;
  els.readResult.disabled = isBusy;
  els.connectWallet.disabled = isBusy;
}

function parseArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }
  return `${Math.round(numeric * 100)}%`;
}

function formatUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    notation: numeric >= 1000000 ? "compact" : "standard",
    style: "currency"
  }).format(numeric);
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: numeric >= 1 ? 2 : 6,
    style: "currency"
  }).format(numeric);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function getYesOutcome(market) {
  const outcomes = parseArray(market.outcomes);
  const prices = parseArray(market.outcomePrices);
  const yesIndex = outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes");
  const index = yesIndex >= 0 ? yesIndex : 0;

  return {
    label: outcomes[index] || "Outcome",
    probability: Number(prices[index] || market.lastTradePrice || 0)
  };
}

function marketUrl(market) {
  if (market.slug) {
    return `https://polymarket.com/market/${encodeURIComponent(market.slug)}`;
  }
  return "https://polymarket.com/markets";
}

function renderMarkets(markets) {
  if (!els.predictionList) {
    return;
  }

  if (!markets.length) {
    els.predictionList.innerHTML = `
      <article class="prediction-card">
        <h3>Belum ada market aktif yang bisa ditampilkan.</h3>
        <p class="market-note">Coba refresh lagi beberapa saat lagi.</p>
      </article>
    `;
    return;
  }

  els.predictionList.innerHTML = markets
    .map((market) => {
      const yes = getYesOutcome(market);
      const probability = Math.max(0, Math.min(1, yes.probability || 0));
      const category = market.category || market.events?.[0]?.category || "Market";
      const endDate = market.endDateIso || market.endDate;
      const volume = market.volume24hr || market.volumeNum || market.volume;
      const liquidity = market.liquidityNum || market.liquidity;

      return `
        <article class="prediction-card">
          <div class="market-category">
            <span>${escapeHtml(category)}</span>
            <span>Ends ${formatDate(endDate)}</span>
          </div>
          <h3>${escapeHtml(market.question || "Prediction market")}</h3>
          <div class="probability-row">
            <div class="probability-top">
              <strong>${formatPercent(probability)}</strong>
              <span>${escapeHtml(yes.label)}</span>
            </div>
            <div class="probability-bar" aria-hidden="true">
              <span style="--probability: ${Math.round(probability * 100)}%"></span>
            </div>
          </div>
          <div class="market-stats">
            <div>
              <span>24h Volume</span>
              <strong>${formatUsd(volume)}</strong>
            </div>
            <div>
              <span>Liquidity</span>
              <strong>${formatUsd(liquidity)}</strong>
            </div>
          </div>
          <a class="market-link" href="${marketUrl(market)}" target="_blank" rel="noreferrer">
            Open market
          </a>
        </article>
      `;
    })
    .join("");
}

async function loadPredictionMarkets() {
  if (!els.predictionList) {
    return;
  }

  els.refreshMarkets.disabled = true;
  els.predictionStatus.textContent = "Mengambil data market real...";

  try {
    const response = await fetch(POLYMARKET_MARKETS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const markets = await response.json();
    const displayMarkets = markets
      .filter((market) => parseArray(market.outcomePrices).length)
      .slice(0, 6);

    renderMarkets(displayMarkets);
    els.predictionStatus.textContent = `${displayMarkets.length} market aktif ditampilkan`;
    els.marketUpdated.textContent = `Updated ${new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    })} WIB`;
  } catch (error) {
    els.predictionStatus.textContent = "Gagal mengambil data market";
    els.predictionList.innerHTML = `
      <article class="prediction-card">
        <h3>Data prediction market belum bisa dimuat.</h3>
        <p class="market-note">${error.message}. Coba refresh lagi, atau buka Polymarket langsung.</p>
        <a class="market-link" href="https://polymarket.com/markets" target="_blank" rel="noreferrer">
          Open Polymarket
        </a>
      </article>
    `;
  } finally {
    els.refreshMarkets.disabled = false;
  }
}

function renderCryptoMarkets(coins) {
  if (!els.cryptoList) {
    return;
  }

  if (!coins.length) {
    els.cryptoList.innerHTML = `
      <article class="crypto-card">
        <h3>Belum ada market cap yang bisa ditampilkan.</h3>
        <p class="market-note">Coba refresh lagi beberapa saat lagi.</p>
      </article>
    `;
    return;
  }

  els.cryptoList.innerHTML = coins
    .map((coin) => {
      const change = Number(coin.price_change_percentage_24h || 0);
      const isNegative = change < 0;
      const changeLabel = `${isNegative ? "" : "+"}${change.toFixed(2)}%`;

      return `
        <article class="crypto-card">
          <div class="crypto-head">
            <div class="crypto-identity">
              <img src="${escapeHtml(coin.image)}" alt="${escapeHtml(coin.name)} logo" />
              <div>
                <strong>${escapeHtml(coin.name)}</strong>
                <span>${escapeHtml(coin.symbol)}</span>
              </div>
            </div>
            <span class="rank-pill">#${coin.market_cap_rank || "-"}</span>
          </div>

          <div class="crypto-price">
            <strong>${formatPrice(coin.current_price)}</strong>
            <span class="change-pill ${isNegative ? "negative" : ""}">${changeLabel} 24h</span>
          </div>

          <div class="crypto-stats">
            <div>
              <span>Market Cap</span>
              <strong>${formatUsd(coin.market_cap)}</strong>
            </div>
            <div>
              <span>24h Volume</span>
              <strong>${formatUsd(coin.total_volume)}</strong>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadCryptoMarkets() {
  if (!els.cryptoList) {
    return;
  }

  els.refreshCrypto.disabled = true;
  els.cryptoStatus.textContent = "Mengambil market cap dari CoinGecko...";

  try {
    const response = await fetch(COINGECKO_MARKETS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`CoinGecko API error ${response.status}`);
    }

    const coins = await response.json();
    renderCryptoMarkets(coins);
    els.cryptoStatus.textContent = `${coins.length} aset crypto ditampilkan`;
    els.cryptoUpdated.textContent = `Updated ${new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    })} WIB`;
  } catch (error) {
    els.cryptoStatus.textContent = "Gagal mengambil data CoinGecko";
    els.cryptoList.innerHTML = `
      <article class="crypto-card">
        <h3>Data market cap belum bisa dimuat.</h3>
        <p class="market-note">${escapeHtml(error.message)}. Coba refresh lagi, atau buka CoinGecko langsung.</p>
        <a class="market-link" href="https://www.coingecko.com/" target="_blank" rel="noreferrer">
          Open CoinGecko
        </a>
      </article>
    `;
  } finally {
    els.refreshCrypto.disabled = false;
  }
}

async function connectWallet() {
  requireWallet();

  state.provider = new ethers.BrowserProvider(window.ethereum);
  state.signer = await state.provider.getSigner();
  state.account = await state.signer.getAddress();

  const network = await state.provider.getNetwork();
  state.chainId = Number(network.chainId);

  els.walletStatus.textContent = "Terhubung";
  els.networkStatus.textContent = `${network.name || "Unknown"} (${state.chainId})`;
  els.accountStatus.textContent = shortAddress(state.account);
  els.connectWallet.textContent = "Wallet connected";
}

function getContract() {
  if (!state.signer) {
    throw new Error("Connect wallet dulu.");
  }
  const address = els.contractAddress.value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error("Alamat contract tidak valid.");
  }
  return new ethers.Contract(address, CONTRACT_ABI, state.signer);
}

async function sendInferenceRequest(event) {
  event.preventDefault();
  setBusy(true);
  els.output.textContent = "Mengirim transaksi...";

  try {
    const contract = getContract();
    const prompt = els.prompt.value.trim();
    const tx = await contract.requestInference(prompt);
    els.txLink.textContent = tx.hash;
    els.txLink.href = explorerTxUrl(state.chainId, tx.hash);

    const receipt = await tx.wait();
    const iface = new ethers.Interface(CONTRACT_ABI);
    const requested = receipt.logs
      .map((log) => {
        try {
          return iface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "InferenceRequested");

    if (requested) {
      const requestId = requested.args.requestId.toString();
      els.requestId.value = requestId;
      els.output.textContent = `Request #${requestId} terkirim. Tunggu node Infernet memenuhi callback, lalu klik "Baca hasil".`;
      return;
    }

    els.output.textContent = "Transaksi berhasil, tapi event request tidak ditemukan di receipt.";
  } catch (error) {
    els.output.textContent = error.shortMessage || error.message;
  } finally {
    setBusy(false);
  }
}

async function readResult() {
  setBusy(true);
  els.output.textContent = "Membaca hasil...";

  try {
    const contract = getContract();
    const requestId = BigInt(els.requestId.value.trim());
    const result = await contract.latestResult(requestId);
    const decodedOutput = ethers.toUtf8String(result.output);

    els.output.textContent = JSON.stringify(
      {
        requester: result.requester,
        prompt: result.prompt,
        fulfilled: result.fulfilled,
        output: decodedOutput
      },
      null,
      2
    );
  } catch (error) {
    els.output.textContent = error.shortMessage || error.message;
  } finally {
    setBusy(false);
  }
}

els.connectWallet.addEventListener("click", () => {
  connectWallet().catch((error) => {
    els.output.textContent = error.message;
  });
});
els.menuToggle?.addEventListener("click", () => {
  setMenuOpen(!document.body.classList.contains("menu-open"));
});
els.mainMenu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    setMenuOpen(false);
  }
});
els.refreshMarkets?.addEventListener("click", loadPredictionMarkets);
els.refreshCrypto?.addEventListener("click", loadCryptoMarkets);
els.requestForm.addEventListener("submit", sendInferenceRequest);
els.readResult.addEventListener("click", readResult);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

loadCryptoMarkets();
loadPredictionMarkets();
